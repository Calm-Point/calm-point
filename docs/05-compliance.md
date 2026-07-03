# 05 — Compliance, Legal & Safety

> ⚠️ **Not legal advice.** This doc frames the obligations so engineering builds compliantly by default. Engage healthcare counsel and a compliance consultant before public launch (budget line item — this is not optional for a telehealth company).

## 1. HIPAA

Calm Point is (or serves) a covered entity; everything downstream of intake is PHI.

**Engineering obligations (Security Rule):**
- **Access control** (§164.312(a)): unique accounts, RBAC + CareRelationship scoping, MFA for provider/admin, automatic session timeout (15 min portals), break-glass procedure for prod data access.
- **Audit controls** (§164.312(b)): append-only `AuditEvent` for every clinical read/write. Retained ≥ 6 years.
- **Integrity** (§164.312(c)): signed-note hashing, append-only amendments, no hard deletes of clinical records.
- **Transmission security** (§164.312(e)): TLS 1.2+ everywhere, HSTS, encrypted S3 (SSE-KMS), encrypted DB at rest, signed short-lived URLs for objects.
- **Administrative** (§164.308): documented risk assessment before launch, workforce access reviews (quarterly), incident-response + breach-notification plan (breach ≥ 500 people = HHS + media notification; any breach = individual notice ≤ 60 days).

**BAA matrix — no PHI flows to a vendor without a signed BAA:**

| Vendor | Data | BAA status to obtain |
|---|---|---|
| Hosting (Vercel Enterprise or AWS) | everything | required before real PHI |
| Postgres host | everything | required |
| Zoom Video SDK (HIPAA plan) / Daily | AV streams | required |
| Deepgram / AWS Transcribe Medical | visit audio | required |
| Anthropic (healthcare/zero-retention) | transcripts, messages for drafting | required |
| Google (Gemini via Vertex AI — BAA-eligible path; the consumer Gemini API is NOT) | therapist voice sessions | required — **must use Vertex AI** |
| xAI | therapist voice sessions | required — **verify availability; if xAI will not sign a BAA, the engine ships dark** 🚦 |
| Twilio | phone numbers, reminder timing | required |
| SES/Postmark | email addresses | required (keep bodies PHI-free anyway) |
| S3/R2 | files | required (AWS standard) |
| Sentry | scrubbed errors | required + aggressive PII scrubbing |
| PostHog | product events | self-host or BAA; **no PHI in event properties ever** |
| Stripe | payment only | no BAA needed if no PHI shared — enforce opaque IDs |

## 2. Tracking technologies (this kills telehealth companies — take it seriously)

Per HHS OCR guidance and FTC actions (GoodRx, BetterHelp, Cerebral precedents):
- **No Meta Pixel, Google Ads tag, TikTok pixel, or session replay on any authenticated page or any page that reveals health status.**
- Marketing pixels allowed only on generic marketing pages, behind a consent banner. The *fact that someone completed the anxiety screener* is health information — conversion events sent to ad platforms must be stripped to non-health signals, or use privacy-safe conversion APIs with counsel's sign-off.
- The questionnaire pages are health-status-revealing: first-party analytics only (BAA'd PostHog), no third-party tags. CI should include a check that marketing-script components cannot be imported into `(patient)`/`(provider)`/`(admin)`/questionnaire routes.

## 3. Telehealth practice law

- **Licensure**: providers must be licensed in the **patient's state at time of visit** — enforced in code via `ProviderLicense` matching + state attestation at booking.
- **Corporate practice of medicine**: most states require the clinical entity to be physician-owned (MSO/friendly-PC structure). Business/legal setup, but the product must model the provider group correctly on legal pages and consent documents. 🚦 counsel before launch.
- **Informed consent for telehealth**: state-specific consent captured at onboarding (versioned, timestamped) — already modeled.
- **Medical record retention**: state-dependent (6–10 years typical); drives the no-hard-delete policy.

## 4. Controlled substances (ADHD is the hard one)

Stimulants (Adderall etc.) are Schedule II. The Ryan Haight Act + current DEA telemedicine rules (in flux — extensions have repeatedly moved; **verify current rule at build time**) govern whether they can be prescribed without an in-person exam. Precedent: Cerebral/Done DOJ scrutiny.

**Product stance at launch: we do not prescribe controlled substances.** ADHD funnel offers evaluation, therapy, non-stimulant options (provider's clinical judgment), and coaching. Revisit with counsel + DEA-registered pharmacy/eRx partner (DoseSpot supports EPCS) as a deliberate, gated post-launch project. The marketing pages must not promise stimulant prescriptions.

## 5. AI-specific obligations

- **Scribe**: two-party consent to recording/transcription where required (some states are all-party consent — capture both parties' consent always, simplest safe rule). Provider remains the author of record: AI drafts, human signs. Never auto-file an unsigned note.
- **AI Therapist**: it is a wellness companion, not a medical device and not therapy. Guardrails in `docs/06-ai-features.md`. Legal must review the naming ("AI Therapist" itself may need softening to "AI companion" in some jurisdictions — several states now regulate AI mental-health chatbots; e.g., Illinois' 2025 law restricts AI "therapy" — 🚦 counsel review of naming + state availability matrix).
- **Disclosure**: users always know they're talking to AI; no dark patterns implying a human.
- **Minors**: platform is 18+; age gate at signup; AI Therapist refuses and redirects if a user indicates they're a minor.
- **FDA**: staying on the wellness side of the line (no diagnosis, no treatment claims, provider-in-the-loop for all clinical decisions). Marketing copy review required — claims language is what triggers device classification.

## 6. Crisis safety protocol (product-wide)

Trigger points: safety questionnaire item positive, crisis language in messaging (classifier), crisis language in AI Therapist (classifier), provider manual flag.

Response ladder:
1. Immediate in-product interstitial: 988 Suicide & Crisis Lifeline (call/text), Crisis Text Line (text HOME to 741741), 911 guidance — warm, non-clinical tone.
2. Care-team alert (provider + admin queue) with SLA.
3. Logged (`flaggedSafety` / `AiInteraction.safetyFlag` / audit) — never silently dropped.
4. AI Therapist: stops normal conversation mode, stays present ("I'm here with you"), repeats resources, offers human handoff; does not resume skills-practice mode in that session.

## 7. App-store health rules (summary; details in launch plan)

- Apple: HealthKit not required; health apps must not use data for ads; privacy nutrition labels must declare health data collection; Sign in with Apple required alongside Google; telehealth = physical service → external payment (Stripe) permitted.
- Google Play: Health apps declaration + data-safety form; account-deletion requirement (in-app path to request deletion — implement as deactivate + legal-retention explanation flow, reviewed by counsel).

## 8. Engineering security baseline (enforced in CI/review)

Argon2id password hashing; strict CSP; CSRF protection on portal mutations; rate limits (auth, messaging, AI); dependency audit + secret scanning in CI; least-privilege DB roles (app role cannot UPDATE/DELETE AuditEvent); quarterly access review; prod access via SSO + audit; no PHI in logs (log scrubber + lint rule for `console.*` in server code); encrypted backups + restore drills.
