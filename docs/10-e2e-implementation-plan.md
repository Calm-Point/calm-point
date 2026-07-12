# 10 — End-to-End Implementation Plan (patient funnel → provider system)

**Status:** proposed 2026-07-12 · awaiting owner go-ahead + credentials
**Owner decisions locked:** validated instruments · Claude+Gemini ensemble analysis ·
real production app · Vercel + Stripe(test) + Gemini keys provided · Resend (email) +
Twilio (SMS) chosen by build agent.

This doc is the single source of truth for the end-to-end lead→patient→visit pipeline
and the provider system the owner specified. It extends `04-build-plan.md` (which stays
the phase status board) and obeys `05-compliance.md` (HIPAA) and `06-ai-features.md`
(AI safety). **Nothing here diagnoses or prescribes — the AI is decision-support; a
licensed provider reviews, diagnoses, and signs.**

---

## 0. Vendor stack (all behind abstractions; swappable)

| Concern | Vendor | Why | Needs from owner | BAA? |
|---|---|---|---|---|
| Hosting | **Vercel** | Next.js native, already build-ready | token (have) | 🚦 before real PHI |
| DB | **Supabase Postgres** | already live, isolated `calm_point` schema | — | 🚦 HIPAA add-on before PHI |
| Payments | **Stripe** (Billing + Payment Intents) | only compliant option; kept outside PHI boundary | `pk_test`/`sk_test` (have) | not needed (zero PHI sent) |
| Email | **Resend** | fastest DX, React email, generous free tier | create acct + `re_…` key (fast) | 🚦 BAA (Resend offers) |
| SMS | **Twilio** | industry standard, verification + reminders | acct SID + auth token + number | 🚦 BAA + A2P 10DLC reg |
| Video | **Daily.co** (primary), Zoom Video SDK (fallback) | HIPAA-eligible 1:1, token-gated rooms | API key | 🚦 **BAA required before real visits** |
| AI analysis | **Claude + Gemini ensemble** | cross-checked clinical summary | Gemini key (have); Claude via gateway | 🚦 BAA (Anthropic/Google) |
| Imagery | **Gemini (image gen)** | brand/hero art, illustrations | Gemini key (have) | n/a (no PHI) |
| Storage (ID/insurance photos) | **Supabase Storage / S3** | encrypted at rest, signed URLs | — | 🚦 same BAA umbrella |

**Compliance rule (hard):** build + test on **synthetic data**. No real patient PHI flows
through any vendor until that vendor's BAA is signed. SMS production sending needs Twilio
A2P 10DLC brand/campaign registration (days of lead time) — we build against test creds first.

---

## 1. The patient pipeline (lead → booked → treated)

Each step is a real, resumable state machine persisted server-side (an `IntakeSession`
row tracks `stage`), so a lead can leave and return. Funnel stages:

### 1.1 Lead capture (ad → landing)
- Ad-traffic landing + per-condition pages (anxiety/depression/ADHD/sleep/weight).
- CTA → **screener** (short 3–5 item taster) → account creation → **full intake**.
- Marketing pages carry **no PHI and no third-party pixels** on any page past the screener
  (consent-gated analytics only, per `05-compliance.md`).

### 1.2 The clinical questionnaire (~45 items, validated)
- **Battery (validated instruments, clinically-defined cutoffs — never invented):**
  - **PHQ-9** (depression, 9) + item-9 suicide-risk safety divert
  - **GAD-7** (anxiety, 7)
  - **ASRS v1.1** (adult ADHD, 6 screener + 12 follow-up as needed)
  - **PCL-5** (PTSD screen, subset) / **MDQ** (bipolar screen) / **PSS-4** (stress) /
    **ISI** (insomnia) / **AUDIT-C** + **DAST** (substance) — assembled to land at 40–50 items
  - Demographics + brief history (meds, allergies, prior care, presenting concern)
- **Engine:** data-driven (already scaffolded in `packages/shared/content`), one-question-per-screen,
  keyboard-navigable, progress, save-and-resume, **server-side scoring** (thresholds locked).
- **Safety:** any suicidal-ideation item triggers the crisis divert (988 / Crisis Text Line)
  and flags the session `URGENT` for provider review.
- Answers are PHI → stored encrypted, audit-logged, attached to the patient's chart.

### 1.3 AI analysis → provider notes (ensemble, decision-support)
On questionnaire completion, the AI pipeline runs server-side:
1. **Deterministic scoring** first (authoritative severities/cutoffs) — the AI never overrides scores.
2. **Claude** drafts a structured clinical summary: presenting concerns, instrument scores +
   severity bands, risk flags (esp. suicidality/safety), symptom clusters, relevant history,
   and **suggested areas to explore** (never a diagnosis, never a prescription).
3. **Gemini** independently drafts the same from the raw answers.
4. **Reconciler** (Claude) cross-checks the two, surfaces agreements/disagreements, and produces
   one **provider-facing analysis** with a confidence note and an explicit
   "AI-generated draft — provider must review, diagnose, and sign" banner.
5. Output stored as an `AiAnalysis` record linked to the intake + patient; **safety-eval suite**
   must pass on any prompt/logic change; feature-flagged.
6. **Forwarded to the assigned provider** (in-portal + email overview) before the visit.

### 1.4 Identity, insurance & consent capture
After the questionnaire, a guided multi-step capture:
- **Personal info** (legal name, DOB, address, phone, emergency contact) — prefilled from onboarding.
- **Driver's license / photo ID** upload (front) — image to encrypted storage, never a public URL.
- **Insurance**: carrier, member ID, group; **front + back card photos**; self-pay option.
  (v1 = capture; real-time eligibility via a clearinghouse is a later, optional integration.)
- **Consents**: Telehealth Informed Consent, Notice of Privacy Practices, Terms — explicit
  checkboxes writing `ConsentRecord` rows (versioned, timestamped, immutable).
- **Submit** → validation, virus/type scan on uploads, `IntakeSession.stage = SUBMITTED`.

### 1.5 Scheduling (in-platform, real availability)
- After submit → **Schedule** page showing **real open slots** for the provider(s) licensed
  in the patient's state, generated from `AvailabilityBlock` with **transactional slot
  locking** (no double-book) and correct timezone/DST handling.
- Patient picks a slot → creates a `pending` `Appointment` (held) → payment.

### 1.6 Payment & subscription (Stripe)
- **Per-visit** charge via Payment Intents ($95 first / $75 follow-up) tied to `Appointment.id`.
- **Membership** via Stripe Billing ($49/mo) — optional, for between-visit care.
- Only **opaque Stripe IDs + generic labels** stored; **no diagnosis/PHI** ever sent to Stripe.
- Signature-verified, idempotent webhooks reconcile `Subscription`/`Payment` rows.
- Successful payment → `Appointment.status = scheduled`.

### 1.7 Verification & reminders (email + SMS)
- On booking: **confirmation email + SMS to patient AND provider** (appointment details, add-to-calendar `.ics`).
- **Email/phone verification** (double opt-in) via signed tokens.
- **Reminder jobs** (durable queue, cron): 24h before, **5 minutes before** — email + SMS to
  both parties with a **secure one-tap join link** (short-lived, role-checked token).
- All templates PHI-minimal (no diagnosis in email/SMS body).

### 1.8 The visit (video) + AI scribe
- Join link → **Daily.co** room, token minted server-side against the `CareRelationship`.
- Optional **AI scribe** (consented): live/near-live transcription → **SOAP note draft**.
- Provider reviews/edits/**signs** the `ClinicalNote`; amendments tracked.

### 1.9 Post-visit
- On visit end: AI compiles the visit into an **after-visit summary + care plan** for the
  patient and a **provider note overview emailed to the provider**.
- Care plan tasks, next check-ins, follow-up booking, secure messaging continue in-app.

---

## 2. Provider system

### 2.1 Provider onboarding workflow
- **Invite → apply → credential → activate:** admin (or self-serve application) invites a
  provider; provider completes profile, uploads **license(s) + NPI + DEA (if applicable)**,
  malpractice, and **state licensure** (drives which patients they can see).
- Credentialing review + admin approval gate; `ProviderProfile` + `ProviderLicense` rows.
- On activation the system **provisions the provider's backend**: account, role, MFA enrollment,
  a **login/sign-up link**, default `AvailabilityBlock`s, and their **dashboard**.

### 2.2 Provider dashboard (per provider)
- Today's schedule + join buttons; patient panel/caseload.
- **Intake review inbox**: the AI analysis + scores + safety flags per new patient.
- Chart view, message threads, note-signing queue, availability editor, payments/payout view.
- Everything **CareRelationship-scoped** + audit-logged.

### 2.3 Admin console
- Provider credentialing, user management, audit-log viewer, feature flags, content/questionnaire
  management, analytics (non-PHI).

---

## 3. Aesthetics & motion track (award-winning aim)

Runs in parallel with every phase (informed by the design panel that scored the demo 4→ now rising):
- **Gemini-generated imagery**: a signature hero visual (calm, organic), condition illustrations,
  provider/marketing photography-style art, empty-state art — all self-hosted, theme-aware.
- **Motion**: scroll-linked reveals, parallax hero, spring page transitions, a breathing brand
  orb, tasteful micro-interactions — all respecting `prefers-reduced-motion`.
- **Display typeface** for headlines (self-hosted/embedded to satisfy CSP) → distinct brand voice.
- **Seamless flow**: unify landing, funnel, patient app, and provider portal into one design
  language (Calm Glass) with continuous, "high-end app" transitions.
- Continuous re-scoring against the jury rubric until we're in award-tier range.

---

## 4. Data-model additions (Prisma — schema is source of truth)

New/confirmed models (some already exist): `IntakeSession(stage)`, `AiAnalysis`,
`IdentityDocument`, `InsurancePolicy`, `ConsentRecord`✓, `VerificationToken`, `ReminderJob`,
`ProviderInvite`, `ProviderApplication`, `Payout`, plus flags. Every clinical read/write goes
through the `AuditEvent` helper.

---

## 5. Delivery phases (each: build on synthetic data → test → deploy → 🚦 BAA before PHI)

- **P1 — Deploy + foundations (now):** run Vercel deploy with token; wire Resend + Stripe test +
  Gemini keys as env vars; email verification + password reset; error tracking. *Acceptance:* live
  URL, health green, seeded logins work, verification email sends.
- **P2 — Questionnaire engine (45 validated items) + scoring + save/resume.** *Acceptance:* unit
  tests assert every instrument cutoff; crisis divert fires; answers persist to chart.
- **P3 — AI ensemble analysis → provider notes** (flagged, safety-evals green). *Acceptance:* analysis
  generated, provider-facing, "review & sign" posture, safety suite passes.
- **P4 — Identity/insurance/consent capture + secure uploads.** *Acceptance:* files encrypted, signed
  URLs only, consents versioned.
- **P5 — Scheduling + Stripe payments/subscription + webhooks.** *Acceptance:* no double-book, payment
  gates booking, webhooks reconcile.
- **P6 — Notifications: email+SMS verification + 24h/5-min reminders + join links.** *Acceptance:* both
  parties notified, reminders fire, links role-checked.
- **P7 — Video visit (Daily) + AI scribe + post-visit summary/notes email.** *Acceptance:* real 1:1
  call, note draft, provider signs. 🚦 BAA before real patients.
- **P8 — Provider onboarding + per-provider dashboard + login/signup + admin console.**
- **P9 — Aesthetics/motion polish + Gemini imagery across landing/app/provider** (continuous).
- **P10 — Hardening, launch checklist, BAAs, go-live.** 🚦

---

## 6. To start, I need from you

1. **Vercel token** (paste) → I deploy immediately.
2. **Stripe test keys** (`pk_test_…`, `sk_test_…`) → I wire payments.
3. **Gemini API key** → imagery + analysis.
4. **Resend**: create a free account at resend.com and paste an API key (`re_…`). (I'll build
   the templates + sending; you just supply the key + verify a sending domain when ready.)
5. **Twilio** (optional now): SID + auth token + a number, when you want real SMS (else I simulate
   SMS in dev and swap in later). Production US SMS needs A2P 10DLC registration — start early.
6. **Daily.co** API key + signed **BAA** before any real patient video (I build against it now).

**Keys are set as environment variables / Vercel secrets and never committed.** Paste **test-mode**
keys only in chat.
