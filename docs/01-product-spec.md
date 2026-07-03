# 01 — Product Specification

## Vision

Calm Point makes high-quality mental-health care feel effortless: a patient clicks an ad, completes a clinically validated intake in minutes, books a video visit with a licensed provider, and leaves every visit with a clear plan — supported between visits by secure messaging and (once clinically approved) an AI Therapist companion. Providers get back the hours they lose to documentation because an AI scribe drafts their notes.

**Conditions in scope at launch**: ADHD, anxiety, depression, weight management (behavioral), insomnia/sleep, general talk-therapy needs.
**Explicitly out of scope at launch**: active psychosis, active suicidality (routed to crisis resources, not treated on-platform), substance-use disorder treatment, patients under 18.

## Personas

1. **Patient ("Maya", 29)** — found us through an Instagram ad about anxiety. Wants care without phone calls or waiting rooms. Judges us in the first 90 seconds: the landing page, the questionnaire, and how fast she can get an appointment.
2. **Provider ("Dr. Rivera", psychiatric NP)** — sees 12–20 patients/day across platforms. Cares about: a clean schedule, complete intake data *before* the visit, notes that write themselves, and messaging that doesn't become a second inbox.
3. **Admin/Operator** — manages provider onboarding/credentialing records, watches funnel + utilization dashboards, handles support escalations, manages content (questionnaires, landing pages).
4. **Developer/Owner** — needs admin superpowers (impersonation with audit trail, feature flags, environment health) without ever touching PHI casually.

## Core user journeys

### J1 — Acquisition → first appointment (the money funnel)
1. Patient clicks ad → **condition-specific landing page** (e.g. `/adhd`, `/anxiety`) with clear value props, pricing, provider credentials, social proof.
2. CTA → **screener questionnaire** (2–3 min, engaging one-question-per-screen flow). Uses validated instruments: PHQ-9 (depression), GAD-7 (anxiety), ASRS v1.1 (ADHD screen), plus intake questions (state of residence, meds, history) and safety screening (C-SSRS style item; crisis path if positive).
3. **Eligibility gate**: state licensure match + clinical exclusions. Ineligible users get a kind, useful off-ramp (crisis line, referral resources).
4. **Account creation** (email/password + Apple/Google sign-in) — questionnaire answers captured pre-auth are linked to the account at creation.
5. **Plan selection + payment** (Stripe): subscription or per-visit, insurance later.
6. **Book first visit**: provider matched by state, condition, availability; patient picks a slot.
7. Confirmation + reminders (email/SMS), calendar file, what-to-expect content.

**Funnel KPIs**: landing→screener start ≥ 35%, screener completion ≥ 60%, screener→signup ≥ 40%, signup→booked ≥ 70%, booked→attended ≥ 85%.

### J2 — The visit
1. Patient joins from web or app; provider joins from provider portal. Video via embedded SDK (no external app required).
2. Pre-visit: provider sees intake summary, questionnaire scores + trends, prior notes, meds.
3. During: **AI Scribe** transcribes (with recorded patient consent) in real time.
4. After: AI drafts a SOAP note; provider edits and **signs** it (note locks, amendments tracked). Patient gets an after-visit summary and any follow-up tasks.

### J3 — Between visits
- **Secure messaging** patient ↔ care team (threaded, read receipts, provider SLA timers, attachments).
- **Check-in questionnaires** re-administered on cadence (PHQ-9 every 2 weeks, etc.) — scores charted for provider.
- Refill requests, scheduling changes, billing self-service.

### J4 — AI Therapist (separate, gated feature)
After sign-up and clinical onboarding, patients gain access to an **AI Therapist companion** — voice conversations (Gemini Live API; xAI/Grok voice as a second engine) and text chat (Claude). It is explicitly a *supportive companion*, not a clinician: skills practice (CBT-style reframing, journaling prompts, grounding exercises), reflection, psychoeducation. Full safety architecture in `docs/06-ai-features.md`. **Feature-flagged off until clinical/legal sign-off.**

### J5 — Provider day-in-the-life
Calendar with availability management → today's queue → one-click join visit → AI-drafted note to sign → inbox with SLA ordering → panel view with score trends and flags.

### J6 — Admin
Provider onboarding (license/state records, NPI, availability templates), user support tools (audited impersonation), questionnaire/content management, dashboards (funnel, utilization, revenue, message SLA), audit log search, feature flags.

## Feature inventory (launch scope = ✅, fast-follow = ⏩, later = 🔮)

| Area | Feature | Scope |
|---|---|---|
| Marketing | Landing pages per condition, pricing page, FAQ, legal pages | ✅ |
| Marketing | Blog/SEO engine, referral program | ⏩ |
| Intake | Multi-step screener w/ validated instruments, scoring, crisis off-ramp | ✅ |
| Auth | Email+password, Apple, Google; patient/provider/admin roles; MFA for provider+admin | ✅ |
| Scheduling | Availability templates, state+condition matching, booking, reschedule/cancel, reminders | ✅ |
| Video | Embedded 1:1 video visits, waiting room, device check | ✅ |
| AI Scribe | Consent capture, live transcription, SOAP draft, provider sign-off | ✅ (draft-quality bar) |
| Messaging | Secure threads, attachments, SLA timers, push/email notifications | ✅ |
| Payments | Stripe subscriptions + one-time visits, receipts, dunning | ✅ |
| Insurance | Eligibility checks, claims | 🔮 |
| eRx | e-prescribing integration (DoseSpot/Photon) | ⏩ (see compliance doc — controlled substances have hard constraints) |
| AI Therapist | Voice (Gemini Live, xAI) + text (Claude), safety layer, session memory | ✅ build / 🚦 gated launch |
| Mobile | iOS + Android apps (Expo), liquid-glass design, push notifications | ✅ (after web core) |
| Admin | User/provider mgmt, credential records, audit log, flags, dashboards | ✅ |
| Check-ins | Recurring questionnaires + trend charts | ✅ |
| Group visits, care plans library, wearables | | 🔮 |

## Pricing model (initial hypothesis — owner to confirm)

- **Membership**: $49–99/mo (messaging + AI Therapist + check-ins) with visits billed per-encounter ($95 initial / $75 follow-up), or bundled plans per condition. Stripe products configured per-plan; keep pricing in config, not code.

## Non-functional requirements

- **Availability** 99.9% for booking/messaging; video vendor SLA inherited.
- **Performance**: landing page LCP < 1.8s (it's an ads funnel — speed is revenue); portal TTI < 3s.
- **Accessibility**: WCAG 2.2 AA everywhere; the intake flow must be fully keyboard + screen-reader usable.
- **Security/priv**: see `docs/05-compliance.md`. SOC 2 posture from day one even before certification.
- **Observability**: every clinical action audited; error budget + alerting from Phase 1.
