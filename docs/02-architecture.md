# 02 — Architecture & Stack Decisions

## Guiding constraints

1. **PHI everywhere** → every vendor in the data path must sign a BAA (HIPAA Business Associate Agreement). This constraint drives most choices below.
2. **One team, three surfaces** (web, iOS, Android) → maximize shared code: TypeScript end-to-end, React everywhere, shared validation/types package.
3. **A single agent builds this** → boring, well-documented, convention-heavy technology beats clever technology.

## Stack (decided)

| Layer | Choice | Why |
|---|---|---|
| Monorepo | **Turborepo + pnpm** | Standard, fast, first-class Next.js/Expo support |
| Web app | **Next.js (App Router) + TypeScript + Tailwind** | Marketing pages (static/ISR, fast LCP for ads) and app portals in one deployable; server actions/route handlers for API |
| API style | **Next.js route handlers + zod-validated JSON** (REST-ish), shared zod schemas in `packages/shared` | Simple, debuggable, mobile app consumes the same API; tRPC intentionally avoided to keep the mobile contract explicit |
| DB | **PostgreSQL + Prisma** | Relational fits clinical data; Prisma migrations = auditable schema history |
| Hosting | **Vercel (web) + managed Postgres** — both under BAA. Vercel offers HIPAA-eligible plans (Enterprise w/ BAA); alternative if BAA economics fail: AWS (ECS/Fargate + RDS) with the same codebase via Docker | Fastest path that can be made compliant; decision checkpoint in Phase 1 |
| Auth | **Auth.js (NextAuth v5)** with credentials + Apple + Google, Prisma adapter, JWT sessions; **MFA (TOTP) mandatory for provider/admin** | Self-hosted auth keeps identity data inside our BAA boundary (vs. sending PHI-adjacent data to a third-party IdP) |
| Video | **Zoom Video SDK** (primary — user preference; HIPAA-eligible w/ BAA) with a thin `VideoProvider` abstraction; **Daily.co** as the tested fallback (also BAA-eligible, simpler webhooks + built-in HIPAA mode) | Abstraction keeps vendor swap a config change |
| Transcription | **Deepgram** (BAA available) streaming STT for scribe; fallback: AWS Transcribe Medical | Accuracy + streaming latency |
| AI notes / triage / text therapy / safety | **Claude API (claude-fable-5 / claude-sonnet-5)** via Anthropic (BAA + zero-retention available for healthcare) | Best clinical-writing quality; one safety-critical brain |
| AI voice therapy | **Gemini Live API** (native voice-to-voice, low latency) + **xAI Grok voice** as second engine, behind an `AiVoiceEngine` abstraction | Per product requirement; engine choice is a runtime flag per user cohort |
| Payments | **Stripe** (subscriptions + one-off) — Stripe never sees PHI (metadata carries opaque IDs only) | Industry default |
| Email | **Postmark or SES** (transactional, BAA for SES; PHI-free templates regardless) | Deliverability |
| SMS | **Twilio** (BAA available) — appointment reminders, MFA fallback | Standard |
| Push | **Expo Push / APNs / FCM** — payloads are PHI-free ("You have a new message"), content fetched in-app | Compliance rule for push |
| Realtime (messaging, presence) | **Pusher/Ably w/ BAA** or self-hosted WebSocket on the API host; Phase 2 decision — start with SWR polling + escalate | Don't block MVP on realtime infra |
| File storage | **S3 (or R2) with SSE, signed URLs, private buckets** | Attachments, consent recordings, transcripts |
| Mobile | **Expo (React Native, TypeScript)** + expo-router; native modules for video SDK; `react-native-reanimated` + `expo-blur`/`@shopify/react-native-skia` for liquid-glass | One codebase → iOS + Android; EAS Build/Submit for store pipelines |
| Analytics | **PostHog self-hosted or w/ BAA** for product analytics; marketing pixels ONLY on non-PHI marketing pages (see compliance §tracking) | OCR guidance on tracking tech is strict |
| Errors/observability | **Sentry (BAA available, PII-scrubbed)** + structured logs; uptime checks | |
| CI/CD | **GitHub Actions**: lint, typecheck, unit, integration (Postgres service), Playwright smoke, AI safety evals; deploy previews per PR | |

## System diagram

```
                        ┌─────────────────────────────────────────────┐
  Ads / SEO ──────────► │  Next.js  apps/web                          │
                        │  ├── (marketing)  landing pages  [no PHI]   │
  Patient (web) ──────► │  ├── (patient)    portal                    │
  Provider ───────────► │  ├── (provider)   portal                    │
  Admin ──────────────► │  ├── (admin)      portal                    │
  Mobile app ─────────► │  └── /api/v1/*    route handlers (zod)      │
                        └───────┬─────────────────────────┬───────────┘
                                │ Prisma                  │ server-side only
                        ┌───────▼────────┐   ┌────────────▼─────────────────┐
                        │ Postgres (BAA) │   │ Vendors (all under BAA):     │
                        │ + AuditEvent   │   │  Zoom Video SDK / Daily      │
                        └────────────────┘   │  Deepgram (STT)              │
                        ┌────────────────┐   │  Anthropic (notes/safety)    │
                        │ S3 (BAA)       │   │  Gemini Live / xAI (voice)   │
                        │ recordings,    │   │  Twilio (SMS)  SES (email)   │
                        │ attachments    │   │  Stripe (no PHI)             │
                        └────────────────┘   └──────────────────────────────┘
```

## Key design decisions

### D1 — Single Next.js app, four route groups
`(marketing)`, `(patient)`, `(provider)`, `(admin)` route groups share one deployment. Marketing routes are static/ISR and carry **zero** auth or PHI code. Portals are dynamic behind middleware that enforces role. Split into separate deployments only if/when scale demands.

### D2 — API versioned under `/api/v1` from day one
The mobile app ships to stores and can't be force-updated; a stable versioned contract is mandatory. All request/response schemas live in `packages/shared` (zod) and are the single contract for web, mobile, and tests.

### D3 — RBAC + ownership model
`User.role ∈ {PATIENT, PROVIDER, ADMIN}`. Every handler runs `requireRole(...)` then `requireOwnership(...)` (patient sees self; provider sees only patients with an active `CareRelationship`; admin actions all audit-logged). Central `authorize.ts` — no inline permission checks scattered in handlers.

### D4 — Audit log as first-class infrastructure
`AuditEvent(actorId, action, resourceType, resourceId, ip, userAgent, metadata, createdAt)` written for every clinical read/write via a single helper. Append-only (no update/delete grants). This is required for HIPAA §164.312(b) and is also the debugging story.

### D5 — Vendor abstractions for the risky seams
`VideoProvider` (Zoom/Daily), `AiVoiceEngine` (Gemini/xAI), `SttProvider` (Deepgram/Transcribe), `NotificationChannel` (email/SMS/push). Each is an interface + config-selected implementation. These are exactly the vendors most likely to change; nothing else gets speculative abstraction.

### D6 — Questionnaire engine is data-driven
Questionnaires (PHQ-9, GAD-7, ASRS, intake, follow-ups) are **rows, not code**: `Questionnaire → Question → AnswerOption` with scoring rules (`ScoringRule`) evaluated server-side. Admins can publish new versions; responses pin the version they answered. Clinical thresholds live in seeded data with tests asserting the canonical cutoffs.

### D7 — Pre-auth questionnaire capture
The screener runs before account creation (funnel-critical). Responses persist under an anonymous `IntakeSession` (cookie token, 30-day TTL); at signup they're atomically linked to the new `User`. PHI collected pre-auth is minimized (no name/DOB until signup).

### D8 — AI calls are server-side only, logged, and behind one gateway module
`packages/shared` defines the AI task types; `apps/web/src/server/ai/` implements a single gateway that: applies zero-retention headers, strips identifiers where feasible, records an `AiInteraction` row (model, purpose, token counts, safety flags — not raw PHI beyond what's needed), and enforces per-user rate limits. No component calls a model API directly.

## Environments

| Env | Purpose | Data |
|---|---|---|
| `local` | dev, Postgres via docker-compose | seeded synthetic data only |
| `preview` | Vercel PR previews | synthetic only — previews must never connect to prod DB |
| `staging` | pre-release, full vendor sandbox keys (Stripe test, Zoom sandbox) | synthetic |
| `production` | real users | PHI — access via break-glass procedure only |

`.env.example` documents every variable; secrets in the platform secret manager, never in the repo.

## Repo conventions

- `apps/web/src/server/` — all server-only logic (db access, ai, vendors). Route handlers are thin.
- `packages/shared/src/schemas/` — zod schemas (API contracts, questionnaire content types).
- `packages/db` — Prisma schema, migrations, seed scripts (synthetic patients/providers, questionnaire content).
- `packages/ui` — headless-first components styled per `docs/07-design-system.md`; web now, RN variants in Phase 4.
- Feature flags: `FeatureFlag` table + typed accessor; evaluated server-side.
