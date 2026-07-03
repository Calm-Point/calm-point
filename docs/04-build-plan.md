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
- [ ] `docker-compose.yml` for local Postgres; `pnpm db:migrate` + seed pipeline working
- [ ] GitHub Actions CI: lint, typecheck, unit tests, integration tests (Postgres service container), build
- [ ] Deploy `apps/web` to hosting (Vercel to start; 🚦 confirm BAA-capable plan before any real PHI — see architecture D-hosting)
- [ ] Staging + production environments, secret management, `.env.example` complete
- [ ] Error tracking (Sentry, PII scrubbing rules) + structured request logging + health endpoint

### 1.2 Auth & RBAC
- [ ] Auth.js: email/password (argon2), email verification, password reset
- [ ] Apple + Google OAuth
- [ ] Session middleware; route-group protection for `(patient)`, `(provider)`, `(admin)`
- [ ] `authorize.ts`: `requireRole`, `requireOwnership`, CareRelationship-scoped provider access
- [ ] TOTP MFA — enforced for PROVIDER and ADMIN before portal access
- [ ] Audit helper writing `AuditEvent` for auth events (login, failed login, MFA, password reset)
- [ ] Rate limiting on all auth endpoints; account lockout with admin unlock

### 1.3 Design system (`packages/ui`)
- [ ] Tokens from `docs/07-design-system.md` (color, type scale, spacing, radius, glass materials, motion durations/easings) as Tailwind preset + CSS variables
- [ ] Core components: Button, Input, Select, Card, GlassPanel, Sheet/Modal, Toast, Stepper, ProgressBar, Avatar, Badge, Skeleton, EmptyState
- [ ] Storybook (or ladle) with light/dark + reduced-motion states
- [ ] Accessibility pass: focus rings, ARIA, contrast ≥ 4.5:1

### Acceptance
- [ ] Three seeded users (patient/provider/admin) can sign in on staging; each lands in a role-correct empty portal; MFA required for provider/admin; CI green; Lighthouse a11y ≥ 95 on auth pages.

---

## Phase 2 — The funnel: marketing site, questionnaire, signup (~2 weeks)

**Goal: the complete ad-click → screener → signup → (stub) booking funnel. This is the revenue path — highest polish bar on web.**

### 2.1 Marketing site `(marketing)`
- [ ] Landing page system: shared template + per-condition pages (`/adhd`, `/anxiety`, `/depression`, `/weight-loss`, `/sleep`) with condition-specific copy, pricing, provider credentials, FAQ, testimonials placeholder
- [ ] Home, How-it-works, Pricing, About, Contact
- [ ] Legal pages: Privacy Policy, Terms, Telehealth Consent, HIPAA Notice of Privacy Practices (🚦 legal review before launch — templates drafted now)
- [ ] SEO: metadata, OpenGraph, sitemap, robots; static/ISR rendering; LCP < 1.8s on 4G
- [ ] UTM capture → `IntakeSession.utm`; consent-gated marketing pixels on marketing pages ONLY (per compliance §tracking)

### 2.2 Questionnaire engine
- [ ] Seed PHQ-9, GAD-7, ASRS v1.1, intake-core content + `ScoringRule` rows (unit tests assert canonical cutoffs)
- [ ] Screener runtime: one-question-per-screen, progress bar, keyboard navigable, autosaves per answer to `IntakeSession`, branching by condition + `meta` rules
- [ ] Server-side scoring + severity; results routed per rules (never shown as a diagnosis to the patient — "your results suggest a visit would help" framing)
- [ ] **Safety item handling**: positive answer → immediate, warm crisis interstitial (988 Suicide & Crisis Lifeline, Crisis Text Line, emergency guidance) + funnel exit + flag for admin review
- [ ] State-eligibility gate (states with licensed providers, from `ProviderLicense`); graceful waitlist capture for other states
- [ ] Admin CRUD for questionnaires (create version, edit draft, publish) — published versions immutable

### 2.3 Signup + linking
- [ ] Account creation mid-funnel; atomic `IntakeSession → PatientProfile` linking (test: answers survive signup, double-submit safe)
- [ ] Patient onboarding: DOB, state confirmation, emergency contact, pharmacy, consents (telehealth consent + NPP acknowledgment recorded with timestamp + version)

### 2.4 Payments (Stripe)
- [ ] Stripe products/prices from config; Checkout for plan purchase; customer portal for self-service
- [ ] Webhook handler (signature-verified) → `Subscription` state machine; dunning emails
- [ ] Test-mode E2E: card success, decline, cancel, past-due

### Acceptance
- [ ] Playwright: full funnel (landing → screener → safety branch test → signup → pay test-mode → onboarding) green in CI
- [ ] Funnel analytics events firing (PostHog): page → start → complete → signup → paid, with UTM attribution
- [ ] Crisis path verified by manual QA script; a11y audit of screener passes

---

## Phase 3 — Care delivery: scheduling, video, scribe, messaging, portals (~3–4 weeks)

**Goal: a patient can book, attend a video visit, get an AI-drafted signed note, and message their provider. 🚦 Before real patients: hosting/vendor BAAs signed, security checklist (launch plan §pre-launch) complete.**

### 3.1 Scheduling
- [ ] Provider availability templates (`AvailabilityBlock`) + exceptions/time-off; timezone-correct slot generation (test DST boundaries)
- [ ] Matching: state licensure ∩ condition specialty ∩ acceptingNew ∩ availability
- [ ] Patient booking flow (pick provider or "first available"), reschedule/cancel with policy windows
- [ ] Creates `CareRelationship` on first booking
- [ ] Reminders: email + SMS (Twilio) at T-24h and T-1h; ICS calendar attachment; PHI-free message content
- [ ] No-show + late-cancel handling; provider-initiated cancel/rebook

### 3.2 Video visits
- [ ] `VideoProvider` interface; **Zoom Video SDK** implementation (server-issued session tokens, never client-side secrets); Daily.co implementation behind flag as fallback
- [ ] Pre-join device check (camera/mic/permissions), waiting room, in-visit UI (mute, camera, leave, connection quality indicator)
- [ ] Visit lifecycle: `SCHEDULED → IN_PROGRESS → COMPLETED` driven by join/leave events + webhooks
- [ ] 🚦 Zoom (or Daily) BAA signed before production visits

### 3.3 AI Scribe
- [ ] Consent step at visit start (both parties; recorded to `Appointment.scribeConsentAt`; scribe hard-disabled without it)
- [ ] Audio → Deepgram streaming STT → transcript assembled server-side → encrypted S3 (`VisitTranscript`)
- [ ] Claude SOAP-draft generation via AI gateway (purpose `scribe-soap`); draft attached as `ClinicalNote(AI_DRAFT)`
- [ ] Provider note editor: section-by-section edit, diff vs. AI draft, **sign** (locks + hashes), amendments
- [ ] Eval set: ≥ 20 synthetic visit transcripts → SOAP drafts rated for faithfulness (no hallucinated meds/symptoms — automated Claude-as-judge + human spot check) 🚦 clinical reviewer approves quality bar before scribe defaults on

### 3.4 Messaging
- [ ] Threads, send/receive, attachments (signed-URL upload, AV scan or type/size allowlist), read receipts
- [ ] Provider inbox with SLA ordering (oldest unanswered first, SLA timer badge)
- [ ] Notifications: in-app + PHI-free push/email ("New message from your care team")
- [ ] Start with 10s SWR polling; upgrade to realtime (Pusher/Ably w/ BAA or WS) when UX demands

### 3.5 Patient portal
- [ ] Dashboard: next appointment, tasks, check-in due, message shortcut, AI Therapist card (flag-gated)
- [ ] Appointments (upcoming/past, join, reschedule), Care page (after-visit summaries, plan), check-in questionnaires on cadence with trend charts, billing self-service, profile/settings

### 3.6 Provider portal
- [ ] Today view (queue + one-click join), calendar + availability manager
- [ ] Patient chart: intake summary, score trends, notes history, meds list, messages
- [ ] Notes queue (unsigned drafts), inbox, panel list with safety-flag alerts

### 3.7 Admin portal
- [ ] User management (search, view, suspend, unlock, reset MFA) — all audited
- [ ] Provider onboarding: create provider, license records + expiry alerts, credential verification checklist, availability oversight
- [ ] Audit log search UI; feature-flag console; dashboards (funnel, utilization, SLA, revenue) from PostHog + DB rollups
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

- [ ] AI gateway hardening: per-user rate limits, budget caps, `AiInteraction` logging, zero-retention headers
- [ ] **Safety layer first** (blocking all engines): crisis/self-harm classifier on every user turn (fast Claude call or classifier) → escalation UX (warm handoff: 988, crisis text, offer to message care team, provider alert on flag); jailbreak resistance; hard scope rules (no diagnosis, no medication advice, no discouraging professional care)
- [ ] Text therapist: Claude with system prompt encoding supportive-companion scope, CBT-style skills, session memory (summaries carried forward, patient-visible + deletable)
- [ ] Voice: `AiVoiceEngine` interface → **Gemini Live API** implementation (WebRTC/WS streaming, barge-in, voice persona config); **xAI Grok voice** implementation behind cohort flag
- [ ] Session summaries → S3 + `AiTherapySession`; optional share-with-provider toggle (default OFF, explicit patient consent)
- [ ] Disclosure UX: first-run explains it's AI, not a clinician, not for emergencies; persistent indicator during sessions
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
