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
- [x] Rate limiting on all auth endpoints (in-memory; Redis upgrade tracked for Phase 6)
- [ ] Account lockout after repeated failures + admin unlock

### 1.3 Design system (`packages/ui`)
- [x] Tokens from `docs/07-design-system.md` (color, type scale, spacing, radius, glass materials, motion durations/easings) as Tailwind preset + CSS variables
- [x] First component set: Button, Field(Input), Card, GlassPanel, Badge, Skeleton, EmptyState
- [ ] Remaining components: Select, Sheet/Modal, Toast, Stepper, ProgressBar, Avatar
- [ ] Storybook (or ladle) with light/dark + reduced-motion states
- [ ] Accessibility pass: focus rings, ARIA, contrast ≥ 4.5:1

### Acceptance
- [x] Three seeded users (patient/provider/admin) sign in; each lands in a role-correct portal; provider/admin forced through MFA setup; role boundaries enforced — verified by 7-test Playwright suite (`apps/web/e2e/auth.spec.ts`), green locally
- [ ] Same suite green on hosted staging + Lighthouse a11y ≥ 95 on auth pages (pending deploy)

---

## Phase 2 — The funnel: marketing site, questionnaire, signup (~2 weeks)

**Goal: the complete ad-click → screener → signup → (stub) booking funnel. This is the revenue path — highest polish bar on web.**

### 2.1 Marketing site `(marketing)`
- [x] Landing page system: shared template + per-condition pages (`/adhd`, `/anxiety`, `/depression`, `/weight-loss`, `/sleep`) with condition-specific copy, pricing, provider credentials, FAQ, testimonials placeholder
- [ ] Home, How-it-works, Pricing, About, Contact
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
- [ ] Crisis path verified by manual QA script; a11y audit of screener passes

---

## Phase 3 — Care delivery: scheduling, video, scribe, messaging, portals (~3–4 weeks)

**Goal: a patient can book, attend a video visit, get an AI-drafted signed note, and message their provider. 🚦 Before real patients: hosting/vendor BAAs signed, security checklist (launch plan §pre-launch) complete.**

### 3.1 Scheduling
- [x] Provider availability templates → timezone-correct slot generation, DST-tested (exceptions/time-off UI still open)
- [x] Matching: state licensure (verified, unexpired) ∩ acceptingNew ∩ availability (condition-specialty filter still open)
- [x] Patient booking flow (pick provider → pick slot), cancel with late-cancel window; advisory-lock double-booking protection (reschedule UI still open)
- [x] Creates `CareRelationship` on first booking
- [ ] Reminders: email + SMS (Twilio) at T-24h and T-1h; ICS calendar attachment; PHI-free message content
- [ ] No-show + late-cancel handling; provider-initiated cancel/rebook

### 3.2 Video visits
- [x] `VideoProvider` interface; Zoom Video SDK JWT implementation + Daily.co implementation (flag-selected); dev vendor for local/CI — real-vendor keys + BAA still required 🚦
- [ ] Pre-join device check (camera/mic/permissions), waiting room, in-visit UI (mute, camera, leave, connection quality indicator)
- [x] Visit lifecycle `SCHEDULED → IN_PROGRESS → COMPLETED` (join/complete endpoints; vendor webhooks still open)
- [ ] 🚦 Zoom (or Daily) BAA signed before production visits

### 3.3 AI Scribe
- [x] Consent step at visit start (recorded to `Appointment.scribeConsentAt`; transcript ingest hard-refuses without it)
- [x] Transcript ingest pipeline → storage seam (`VisitTranscript`); Deepgram streaming + S3 land with vendor keys (local blob store for dev/CI)
- [x] Claude SOAP-draft generation via AI gateway (purpose `scribe-soap`, faithfulness rules in system prompt, AiInteraction logging); deterministic mock in dev/CI
- [x] Provider note editor: section-by-section edit, sign (locks + sha256 hash, API refuses post-sign edits); diff view + amendments UI still open
- [ ] Eval set: ≥ 20 synthetic visit transcripts → SOAP drafts rated for faithfulness (no hallucinated meds/symptoms — automated Claude-as-judge + human spot check) 🚦 clinical reviewer approves quality bar before scribe defaults on

### 3.4 Messaging
- [x] Threads, send/receive, read receipts along active CareRelationships (attachments still open — needs S3)
- [x] Provider inbox (recency-ordered, unread badges; SLA timers still open)
- [ ] Notifications: in-app + PHI-free push/email ("New message from your care team")
- [x] 10s polling in place; realtime upgrade tracked

### 3.5 Patient portal
- [x] Dashboard: onboarding nudge, appointments shortcut, check-in card (AI Therapist card lands with Phase 5)
- [x] Appointments (upcoming, join, cancel) + Care page (signed after-visit plan summaries); reschedule UI, check-in cadence charts, billing, settings still open

### 3.6 Provider portal
- [ ] Today view (queue + one-click join), calendar + availability manager
- [ ] Patient chart: intake summary, score trends, notes history, meds list, messages
- [ ] Notes queue (unsigned drafts), inbox, panel list with safety-flag alerts

### 3.7 Admin portal
- [x] User management (search, suspend/reactivate, reset MFA) — all audited
- [ ] Provider onboarding: create provider, license records + expiry alerts, credential verification checklist, availability oversight
- [x] Audit log search UI + feature-flag console with software-enforced sign-off gate on ai-therapist (dashboards still open)
- [ ] Audited impersonation ("View as user") with visible banner + auto-expiry

### Acceptance
- [ ] E2E on staging: seeded patient books with seeded provider → both join real video session → scribe (consented) produces transcript + SOAP draft → provider edits + signs → patient sees after-visit summary → two-way messaging with notifications
- [ ] Security checklist from launch plan §pre-launch passes (authz matrix tests: patient A cannot read patient B; provider without CareRelationship gets 403; every clinical access audited)
- [ ] Load sanity: 50 concurrent bookings without double-booked slots (row-level locking test)

---

## Phase 4 — Mobile apps (iOS + Android, Expo) (~3 weeks)

**Goal: App-Store-quality native apps sharing the v1 API. The iOS experience is a flagship product surface — see design doc for the liquid-glass bar.**

- [ ] `apps/mobile` Expo scaffold (expo-router, TypeScript); EAS Build + Submit pipelines (internal → TestFlight/internal track)
- [ ] RN design system in `packages/ui`: glass materials (expo-blur/Skia), motion (reanimated spring presets, shared-element transitions), haptics vocabulary (see design doc §mobile)
- [ ] Auth (incl. Sign in with Apple — **required** by App Store when offering Google sign-in), secure token storage (Keychain/Keystore), biometric app-lock re-entry
- [ ] Patient surface parity: dashboard, questionnaires (native one-question flow), booking, appointments, messaging, billing (⚠️ App Store: telehealth services are physical-world services → Stripe is allowed, no IAP required; document this in review notes)
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
- [ ] **Safety eval suite in CI**: ≥ 200 adversarial prompts (crisis language, med-seeking, diagnosis-seeking, jailbreaks, minors) — required pass rate 100% on crisis-escalation cases, ≥ 98% on scope cases; regressions block merge
- [ ] 🚦 **Launch gate: clinical + legal sign-off required to flip the `ai-therapist` flag for any real cohort.** Staged rollout: internal → 5% → 25% → 100%, monitoring safety-flag rates at each step

---

## Phase 6 — Hardening & launch (~2 weeks)

- [ ] Full security review (`/security-review` + manual authz matrix + dependency audit + secrets scan)
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
