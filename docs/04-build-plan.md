# 04 — Build Plan (living status board)

This is the execution plan for the dedicated build agent. Work phases **in order**; a phase is done when every acceptance criterion passes. Check boxes as you go — this file is the status board. Estimates assume one focused agent working continuously; treat them as sequencing weights, not promises.

**Human sign-off gates are marked 🚦 — the agent stops and requests owner/clinical/legal approval before crossing them.**

---

## Phase 0 — Foundation (this PR) ✅

- [x] Documentation set (product spec, architecture, data model, compliance, AI features, design system, launch plan)
- [x] Prisma schema (full domain model)
- [x] Monorepo scaffold (Turborepo + pnpm + Next.js app + shared packages)
- [x] CLAUDE.md agent operating instructions

---

## Phase 1 — Platform core (~1–2 weeks)

**Goal: a deployed skeleton with auth, roles, CI, and the design system — the rails everything else runs on.**

### 1.1 Infrastructure
- [x] `docker-compose.yml` for local Postgres; `pnpm db:migrate` + seed pipeline working
- [x] GitHub Actions CI: lint, typecheck, unit tests, integration tests (Postgres service container), build
- [x] Deploy pipeline ready: production Postgres LIVE on Supabase (migrated + seeded, isolated calm_point schema) + auto-deploy workflow (.github/workflows/deploy.yml); one-time Vercel credential step documented in docs/09-deployment.md 🚦 BAA before real PHI
- [ ] Staging + production environments, secret management, `.env.example` complete
- [ ] Error tracking (Sentry, PII scrubbing rules) + structured request logging + health endpoint

### 1.2 Auth & RBAC
- [x] Auth.js: email/password (argon2id) credentials sign-in + signup
- [ ] Email verification + password reset flows (needs email vendor wiring)
- [ ] Apple + Google OAuth
- [x] Session middleware; route-group protection for `(patient)`, `(provider)`, `(admin)`
- [x] `authorize.ts`: `requireRole`, `requireOwnership`, CareRelationship-scoped provider access
- [x] TOTP MFA — enforced for PROVIDER and ADMIN before portal access
- [x] Audit helper writing `AuditEvent` for auth events (login, failed login, MFA, password reset)
- [x] Rate limiting on all auth endpoints — Redis-backed (fixed window) when `REDIS_URL` is set, falling back to the original single-instance in-memory sliding window otherwise or on any Redis error
- [ ] Account lockout after repeated failures + admin unlock

### 1.3 Design system (`packages/ui`)
- [x] Tokens from `docs/07-design-system.md` (color, type scale, spacing, radius, glass materials, motion durations/easings) as Tailwind preset + CSS variables
- [x] First component set: Button, Field(Input), Card, GlassPanel, Badge, Skeleton, EmptyState
- [x] Remaining components: Select, Sheet/Modal, Toast, Stepper, ProgressBar, Avatar — wired into real screens (admin invite form, portal mobile nav, intake progress) and live-verified in light + dark mode
- [ ] Storybook (or ladle) with light/dark + reduced-motion states
- [x] Accessibility pass: fixed a hydration bug (Toast/Sheet portals mismatching SSR), added missing focus-visible rings on intake/inbox buttons, added keyboard 1–9 question selection (docs/07 §3), swept 6 screens off Tailwind-default colors onto design tokens (dark-mode contrast), added ARIA progressbar semantics to the intake progress bar, added a mobile nav (PortalShell had none below `sm`)

### Acceptance
- [x] Three seeded users (patient/provider/admin) sign in; each lands in a role-correct portal; provider/admin forced through MFA setup; role boundaries enforced — verified by 7-test Playwright suite (`apps/web/e2e/auth.spec.ts`), green locally
- [ ] Same suite green on hosted staging + Lighthouse a11y ≥ 95 on auth pages (pending deploy)

---

## Phase 2 — The funnel: marketing site, questionnaire, signup (~2 weeks)

**Goal: the complete ad-click → screener → signup → (stub) booking funnel. This is the revenue path — highest polish bar on web.**

### 2.1 Marketing site `(marketing)`
- [x] Landing page system: shared template + per-condition pages (`/adhd`, `/anxiety`, `/depression`, `/weight-loss`, `/sleep`) with condition-specific copy, pricing, provider credentials, FAQ, testimonials placeholder
- [x] Home, How-it-works, Pricing (static, in sitemap); About/Contact still open
- [x] Legal pages: Privacy Policy, Terms, Telehealth Consent, HIPAA Notice of Privacy Practices (🚦 legal review before launch — templates drafted now)
- [x] SEO: metadata, OpenGraph, sitemap, robots; static/ISR rendering; LCP < 1.8s on 4G
- [x] UTM capture → `IntakeSession.utm` (pixels deferred until analytics vendor + consent banner land)

### 2.2 Questionnaire engine
- [x] Seed PHQ-9, GAD-7, ASRS v1.1, intake-core content + `ScoringRule` rows (unit tests assert canonical cutoffs)
- [x] Screener runtime: one-question-per-screen, progress bar, keyboard navigable, autosaves per answer to `IntakeSession`, branching by condition + `meta` rules
- [x] Server-side scoring + severity; results routed per rules (never shown as a diagnosis to the patient — "your results suggest a visit would help" framing)
- [x] **Safety item handling**: positive answer → immediate, warm crisis interstitial (988 Suicide & Crisis Lifeline, Crisis Text Line, emergency guidance) + funnel exit + flag for admin review
- [x] State-eligibility gate at booking (licensed-provider matching by patient state; empty-state messaging for uncovered states)
- [ ] Admin CRUD for questionnaires (create version, edit draft, publish) — published versions immutable

### 2.3 Signup + linking
- [x] Account creation mid-funnel; atomic `IntakeSession → PatientProfile` linking (test: answers survive signup, double-submit safe)
- [x] Patient onboarding: DOB, state confirmation, emergency contact, pharmacy, consents (versioned ConsentRecord rows with timestamp + IP)

### 2.4 Payments (Stripe)
- [ ] Stripe products/prices from config; Checkout for plan purchase; customer portal for self-service
- [ ] Webhook handler (signature-verified) → `Subscription` state machine; dunning emails
- [ ] Test-mode E2E: card success, decline, cancel, past-due

### Acceptance
- [x] Playwright: funnel E2E green (landing → screener → safety-branch divert → signup with intake linking); pay + onboarding steps pending Stripe keys
- [ ] Funnel analytics events firing (PostHog): page → start → complete → signup → paid, with UTM attribution
- [x] Crisis path verified by automated E2E (funnel screener + signed-in check-in both divert on safety item); a11y audit of screener still open

---

## Phase 3 — Care delivery: scheduling, video, scribe, messaging, portals (~3–4 weeks)

**Goal: a patient can book, attend a video visit, get an AI-drafted signed note, and message their provider. 🚦 Before real patients: hosting/vendor BAAs signed, security checklist (launch plan §pre-launch) complete.**

### 3.1 Scheduling
- [x] Provider availability templates → timezone-correct slot generation, DST-tested (exceptions/time-off UI still open)
- [x] Matching: state licensure (verified, unexpired) ∩ acceptingNew ∩ availability (condition-specialty filter still open)
- [x] Patient booking flow (pick provider → pick slot), cancel with late-cancel window (confirm sheet + toast warning when inside 24h), reschedule (in-place move via slot picker, collision + notice re-checked server-side); advisory-lock double-booking protection
- [x] Creates `CareRelationship` on first booking
- [x] Reminder engine: T-24h/T-1h tiers (unit-tested windows), deduped in-app notifications, cron endpoint + vercel.json schedule, ICS download (PHI-light, escaping tested); email/SMS delivery slots in when SES/Twilio keys + BAAs exist
- [x] No-show + late-cancel handling: provider Today page surfaces past-due unattended visits with a "Mark no-show" action; provider-initiated cancel already supported by the existing cancel endpoint

### 3.2 Video visits
- [x] `VideoProvider` interface; Zoom Video SDK JWT implementation + Daily.co implementation (flag-selected); dev vendor for local/CI — real-vendor keys + BAA still required 🚦
- [x] Pre-join device check: live camera preview, mic level meter (Web Audio analyser), camera/mic device pickers — live-verified with Chromium's fake media devices; never hard-blocks joining on permission/hardware failure. Waiting room + in-visit mute/camera/connection-quality controls still open (blocked on a real vendor SDK)
- [x] Visit lifecycle `SCHEDULED → IN_PROGRESS → COMPLETED` (join/complete endpoints; vendor webhooks still open)
- [ ] 🚦 Zoom (or Daily) BAA signed before production visits

### 3.3 AI Scribe
- [x] Consent step at visit start (recorded to `Appointment.scribeConsentAt`; transcript ingest hard-refuses without it)
- [x] Transcript ingest pipeline → storage seam (`VisitTranscript`); Deepgram streaming + S3 land with vendor keys (local blob store for dev/CI)
- [x] Claude SOAP-draft generation via AI gateway (purpose `scribe-soap`, faithfulness rules in system prompt, AiInteraction logging); deterministic mock in dev/CI; drafting logic extracted to `draftSoapNote()` (`apps/web/src/server/visits.ts`) so the eval harness exercises the exact production path
- [x] Provider note editor: section-by-section edit, sign (locks + sha256 hash, API refuses post-sign edits); diff view + amendments UI still open
- [x] Eval set: 20 synthetic visit transcripts (`apps/web/evals/scribe-faithfulness/`) covering fabrication, dropped/inverted denials, ruled-out diagnoses, dosage fidelity, and safety-relevant omissions → Claude-as-judge scores each SOAP draft + a keyword guard as defense-in-depth; wired into CI (`pnpm --filter @calm-point/web evals`, gated on `secrets.ANTHROPIC_API_KEY` — skips cleanly without it rather than reporting a false pass off mock output). Mechanically verified end-to-end via mock model output (20/20). Human spot check + clinical reviewer sign-off before scribe defaults on 🚦 still required

### 3.4 Messaging
- [x] Threads, send/receive, read receipts along active CareRelationships (attachments still open — needs S3)
- [x] Provider inbox (recency-ordered, unread badges; SLA timers still open)
- [ ] Notifications: in-app + PHI-free push/email ("New message from your care team")
- [x] 10s polling in place; realtime upgrade tracked

### 3.5 Patient portal
- [x] Dashboard: onboarding nudge, appointments shortcut, check-in card (AI Therapist card lands with Phase 5)
- [x] Appointments (upcoming, join, cancel) + Care page (signed after-visit plan summaries); reschedule UI, check-in cadence charts, billing, settings still open

### 3.6 Provider portal
- [x] Today view (queue + one-click join + real unsigned-notes/inbox-unread counts), recurring weekly availability manager (`/provider/availability` — per-day hours + slot size, replaces the template atomically) — live-verified incl. persistence across reload
- [x] Patient chart (`/provider/patients/[patientId]`, CareRelationship-scoped via `requirePatientAccess`): score trends, visit history, signed-notes summary, medications, message-thread entry point — live-verified with real seeded data; reachable from Today and the intake inbox
- [x] Notes queue (unsigned drafts), inbox, panel list with safety-flag alerts

### 3.7 Admin portal
- [x] User management (search, suspend/reactivate, reset MFA) — all audited
- [x] Provider onboarding: create provider, license records, credential verification checklist (`/admin/providers` — invite form, temp password, license status badges, verify-licenses action) — live-verified end-to-end; expiry alerts + availability oversight still open
- [x] Audit log search UI + feature-flag console with software-enforced sign-off gate on ai-therapist (dashboards still open)
- [ ] Audited impersonation ("View as user") with visible banner + auto-expiry

### Acceptance
- [ ] E2E on staging: seeded patient books with seeded provider → both join real video session → scribe (consented) produces transcript + SOAP draft → provider edits + signs → patient sees after-visit summary → two-way messaging with notifications
- [ ] Security checklist from launch plan §pre-launch passes (authz matrix tests: patient A cannot read patient B; provider without CareRelationship gets 403; every clinical access audited)
- [ ] Load sanity: 50 concurrent bookings without double-booked slots (row-level locking test)

---

## Phase 4 — Mobile apps (iOS + Android, Expo) (~3 weeks)

**Goal: App-Store-quality native apps sharing the v1 API. The iOS experience is a flagship product surface — see design doc for the liquid-glass bar.**

- [x] `apps/mobile` Expo SDK 57 scaffold (expo-router, TypeScript, expo-glass-effect available) in the workspace, typecheck in CI; EAS Build/Submit pipelines need owner Apple/Google accounts 🚦
- [ ] RN design system in `packages/ui`: glass materials (expo-blur/Skia), motion (reanimated spring presets, shared-element transitions), haptics vocabulary (see design doc §mobile)
- [x] Credentials + TOTP sign-in against the shared /api/v1 contract (cookie session via native networking); Sign in with Apple + biometric app-lock still open
- [x] First patient surfaces: dashboard, appointments list, messaging (10s polling), AI companion with disclosure + crisis banner — Calm Glass theme mirrored natively (questionnaires, booking, billing still open) (⚠️ App Store: telehealth services are physical-world services → Stripe is allowed, no IAP required; document this in review notes)
- [ ] Video visits in-app (Zoom Video SDK RN / Daily RN; requires Expo dev-client custom build)
- [ ] Push notifications (Expo push; PHI-free payloads; deep links into threads/appointments)
- [ ] Offline-tolerant: cached dashboard, queued questionnaire answers, graceful reconnect
- [ ] App Store + Play Store assets: icons, splash, screenshots, privacy manifests/labels, data-safety forms (see launch plan §stores)

### Acceptance
- [ ] TestFlight + Play internal builds: full patient journey on real devices (booking → video visit → messaging), 60fps transitions on iPhone 12-class hardware, reduced-motion respected; crash-free rate > 99.5% in beta

---

## Phase 5 — AI Therapist (build during 3–4, launch gated) (~2–3 weeks build)

**Goal: the standalone AI Therapist feature — voice + text — with a safety architecture strong enough to defend. Detail: `docs/06-ai-features.md`.**

- [x] AI gateway: per-user rate limits, daily turn caps, `AiInteraction` logging (zero-retention headers land with the Anthropic healthcare key)
- [x] **Safety layer first**: two-layer classifier (always-on lexical + Claude haiku union) on every turn → crisis mode locks the session, 988/Crisis-Text handoff, care-team+admin alerts, audited escalations; med-seeking/minor redirects; scope rules in persona prompt
- [x] Text therapist: Claude persona (supportive-companion scope, CBT-style skills), transcript-scoped context, end-of-session summaries (deletable-summary UI still open)
- [ ] Voice: `AiVoiceEngine` interface → **Gemini Live API** implementation (WebRTC/WS streaming, barge-in, voice persona config); **xAI Grok voice** implementation behind cohort flag
- [ ] Session summaries → S3 + `AiTherapySession`; optional share-with-provider toggle (default OFF, explicit patient consent)
- [x] Disclosure UX: first-run acknowledgment gate + persistent AI/crisis indicator
- [x] Safety eval suite in CI: 28 adversarial cases at 100% on the always-on lexical layer (a failure blocks merge); grow to ≥200 incl. model-layer + jailbreak cases before launch 🚦
- [ ] 🚦 **Launch gate: clinical + legal sign-off required to flip the `ai-therapist` flag for any real cohort.** Staged rollout: internal → 5% → 25% → 100%, monitoring safety-flag rates at each step

---

## Phase 6 — Hardening & launch (~2 weeks)

- [x] App-layer security pass: authz audit (every PHI route enforces role + CareRelationship ownership; only the anonymous rate-limited screener-start is public), append-only audit log, argon2id, MFA, security headers, gated-flag sign-off. External `/security-review` + dependency/secret scan still to run in CI.
- [x] S3 object storage implemented (`@aws-sdk/client-s3` behind the existing `putText`/`putBinary`/`getText`/`appendText` seam — callers unchanged): SSE-KMS when `S3_KMS_KEY_ID` is set, else SSE-S3; local blob storage remains the dev/CI path and is still refused in production without `ALLOW_LOCAL_STORAGE=1`. 🚦 Needs a real bucket + IAM role/KMS key provisioned — untestable without AWS credentials, so this is code-complete but not live-verified against real S3.
- [x] MFA-secret (and reused insurance member/group ID) encryption key: KMS migration path documented in docs/09-deployment.md §Key management — the derive-from-`AUTH_SECRET` scheme is a stopgap 🚦 rotate to a real KMS-managed key before production PHI
- [ ] Penetration test (external vendor) 🚦 findings triaged before public launch
- [ ] HIPAA Security Rule risk assessment documented (required §164.308); policies: incident response, breach notification, access review, backup/restore drill executed
- [ ] Performance: k6 load tests (booking contention, messaging fan-out, webhook bursts); DB indexes verified against slow-query log
- [ ] Observability: alert runbook (paging on auth failures spike, webhook failures, video join errors, safety-flag rate anomaly)
- [ ] App Store + Play submissions (expect 1–2 review cycles; health apps get extra scrutiny — see launch plan §stores)
- [ ] Launch checklist in `docs/08-launch-plan.md` executed top to bottom 🚦 owner go/no-go

---

## Post-launch roadmap (roll-as-we-go)

1. **eRx integration** (DoseSpot/Photon) — non-controlled first; controlled substances only after DEA/Ryan Haight analysis (compliance doc §controlled-substances) 🚦
2. Insurance eligibility + superbills → claims
3. Realtime messaging upgrade, typing indicators, provider mobile app
4. Care programs (structured CBT courses, weight-management program content)
5. Referral program, blog/SEO engine, A/B testing framework for landing pages
6. Group visits, family accounts, wearable integrations
7. SOC 2 Type II certification track

## Standing definition of done (every task)

Typed + linted + tested; authz enforced + audited if clinical; a11y checked if UI; docs/status board updated; deployed to staging and smoke-tested.
