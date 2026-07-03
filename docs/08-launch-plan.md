# 08 — Launch Plan

Covers: pre-launch gates, web launch, App Store, Play Store, the ads funnel go-live, and the first-90-days operating rhythm. Execute top-to-bottom in Phase 6; every 🚦 requires named human sign-off.

## 1. Pre-launch gates (hard blockers)

### Legal / clinical 🚦
- [ ] Corporate structure for clinical practice (PC/MSO or equivalent) established with healthcare counsel
- [ ] Providers credentialed; licenses verified per launch state; malpractice coverage confirmed
- [ ] Launch-state list finalized (start with 3–5 states where we have licensed providers — do NOT launch "nationwide")
- [ ] Legal pages approved by counsel: Privacy Policy, HIPAA NPP, Terms, Telehealth Consent, AI-feature disclosures
- [ ] AI Therapist naming + state availability matrix reviewed (state AI-therapy laws, e.g. Illinois)
- [ ] Controlled-substance stance locked: **not prescribing at launch**; marketing copy audited for compliant claims

### Security / compliance 🚦
- [ ] All BAAs signed (matrix in `docs/05-compliance.md` §1) — verified list stored with counsel
- [ ] HIPAA risk assessment documented; policies adopted (incident response, breach notification, access review)
- [ ] External penetration test complete; criticals/highs remediated
- [ ] Authz matrix test suite green (patient↔patient isolation, provider scoping, admin auditing)
- [ ] Backup restore drill executed successfully; PITR enabled
- [ ] Tracking-tech audit: zero third-party pixels on health-status pages (automated CI check + manual sweep)

### Product
- [ ] Playwright E2E green on production config; full staging dress rehearsal (real video visit, scribe, note signing, messaging, payment in live-mode test)
- [ ] Load test passed (booking contention, webhook bursts)
- [ ] On-call rota + alert runbook active; status page live
- [ ] Support inbox + macros ready; refund/cancellation policy published

## 2. Web launch

1. Domain + DNS, TLS, HSTS preload; production env freeze 48h before.
2. Soft launch: friends-and-family cohort (~25 real users) for 1 week — watch funnel analytics, video join success rate (>97%), message SLA.
3. Fix-forward window, then open registration for launch states.
4. SEO baseline: submit sitemap, condition pages indexed, Core Web Vitals green.

## 3. Ads funnel go-live

- Channels: Meta + Google Search first (Google requires **LegitScript certification for telehealth advertisers** — start that application early, it takes weeks 🚦).
- One campaign per condition → matching landing page (`/adhd`, `/anxiety`, ...) → UTM-attributed funnel dashboards per campaign.
- Conversion signals sent to ad platforms must be privacy-safe (no health terms in event names/params; counsel-approved conversion API config) — see compliance §2.
- Budget ramp: small daily caps until funnel conversion + CAC stabilize; weekly creative review; kill-switch documented (pausing ads must not orphan mid-funnel users — waitlist capture stays on).

## 4. App Store (iOS)

**Account/prep**
- [ ] Apple Developer **Organization** account (D-U-N-S) — not individual; health apps from individual accounts get rejected under 5.1.1(ix)-adjacent scrutiny
- [ ] App Store Connect: app record, bundle id, TestFlight internal → external beta

**Review-critical checklist**
- [ ] Sign in with Apple offered (required alongside Google OAuth)
- [ ] Privacy nutrition labels: declare Health & Fitness, Contact Info, Identifiers; health data NOT used for tracking/ads
- [ ] `NSCameraUsageDescription` / `NSMicrophoneUsageDescription` strings written for video visits (vague strings = rejection)
- [ ] Account deletion path in-app (Apple requirement) — deactivation + records-retention explanation flow
- [ ] Payment: telehealth = real-world service → Stripe permitted, no IAP; state this in App Review notes with guideline reference (3.1.3(e)/3.1.5)
- [ ] App Review notes: demo patient + provider credentials on staging-like sandbox, video-visit test instructions, explanation of AI features + safety measures
- [ ] Crisis resources reachable within the app (reviewers check mental-health apps for this)
- [ ] Age rating 17+/18+ (medical); `com.apple.developer.healthkit` NOT claimed (we don't use HealthKit at launch)
- [ ] Expect 1–2 rejection cycles; budget 2–3 weeks calendar time

**Assets**: icon set, 6.7"/6.1"/iPad screenshots (real UI, no health claims in copy), preview video optional, App Store description with compliant claims language (counsel-reviewed).

## 5. Google Play (Android)

- [ ] Play Console org account; app signing by Google
- [ ] **Health apps declaration** + Data safety form (health data collected, encrypted in transit/at rest, deletion path, no ad use)
- [ ] Account-deletion requirement (same flow as iOS)
- [ ] Permissions: CAMERA/RECORD_AUDIO with prominent in-app disclosure before request
- [ ] Internal testing → closed track (20 testers) → production with staged rollout (10% → 50% → 100%)
- [ ] Target latest API level; review 1–7 days typical

## 6. Launch-day runbook

T-1d: freeze, dress rehearsal, on-call briefed. T-0: flip registration flag → smoke test real signup+payment → enable ads at low budget → monitor dashboard (funnel, errors, video join rate, webhook failures, safety-flag queue) hourly. T+1d/+3d/+7d: metrics review vs KPI targets (product spec §J1); triage; decide budget ramp. Rollback plan: registration flag off + ads paused + status-page note (existing patients unaffected — their surfaces stay up).

## 7. First 90 days operating rhythm

- **Weekly**: funnel + CAC review per condition; provider utilization + note-signing compliance; message SLA; AI safety-flag sample review (clinical advisor); top-3 UX fixes shipped.
- **Biweekly**: check-in questionnaire outcomes (are PHQ-9/GAD-7 scores improving? this is the product's real KPI); pricing/plan iteration.
- **Monthly**: access review (HIPAA), dependency/security patch sweep, restore drill (quarterly), roadmap re-rank (post-launch list in build plan).
- **Growth experiments queue**: landing-page A/B (headline, social proof, price anchoring), screener length variants, condition expansion, state expansion as licensure grows.

## 8. Numbers to watch (day-1 dashboard)

Funnel: visit→screener start / completion / signup / paid / booked / attended (targets in product spec). Care: video join success >97%, note signed <72h = 100%, message first-response <1 business day. Trust/safety: crisis-flag response time, AI safety-flag rate/1k sessions, complaint rate. Business: CAC by channel+condition, LTV proxy (m1/m2 retention), visit gross margin. Tech: error rate, p95 API latency, crash-free sessions >99.5%, webhook failure rate ~0.
