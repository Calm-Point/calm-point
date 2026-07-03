# 03 — Data Model

**Source of truth: [`packages/db/prisma/schema.prisma`](../packages/db/prisma/schema.prisma).** This doc explains the shape and the reasoning; if they disagree, the schema wins and this doc must be updated.

## Domain map

```
User (role: PATIENT | PROVIDER | ADMIN)
 ├─ PatientProfile ──┬─ CareRelationship ──── ProviderProfile ─┬─ ProviderLicense (per state)
 │                   ├─ QuestionnaireResponse → Answer          └─ AvailabilityBlock
 │                   ├─ Appointment ─┬─ VisitTranscript (S3 pointer)
 │                   │               ├─ ClinicalNote (SOAP, sign/lock) → NoteAmendment
 │                   │               └─ Payment
 │                   ├─ Subscription
 │                   └─ AiTherapySession
 ├─ MessageParticipant → MessageThread → Message
 ├─ Device (push tokens)
 └─ AuditEvent (append-only, actor side)

Questionnaire (versioned) → Question → AnswerOption ; ScoringRule
IntakeSession (anonymous pre-auth funnel) → QuestionnaireResponse
FeatureFlag ; Notification ; AiInteraction ; OAuthAccount
```

## Design notes (the non-obvious parts)

1. **`CareRelationship` is the authorization boundary.** A provider can access a patient's records *only* through an active (endedAt = null) relationship. Every provider-side query joins through it. This is what makes "provider sees only their patients" enforceable rather than aspirational.

2. **Questionnaires are versioned rows, not code (D6).** `(slug, version)` unique; responses pin the exact version answered so historical scores stay interpretable after content edits. Clinical cutoffs (PHQ-9: 0–4 minimal, 5–9 mild, 10–14 moderate, 15–19 moderately severe, 20–27 severe; GAD-7: 0–4/5–9/10–14/15–21; ASRS Part A: ≥4 shaded boxes = positive screen) live in `ScoringRule` seed data with unit tests asserting them. **Scoring runs server-side only** — never trust client-computed scores.

3. **`IntakeSession` carries the pre-auth funnel (D7).** Anonymous token cookie → responses accumulate → linked atomically to `PatientProfile` at signup. Also carries UTM attribution so ad-spend ROI is measurable per condition funnel. Expired unlinked sessions are purged by a cron (data minimization).

4. **Safety flags short-circuit everything.** `Question.isSafetyItem` + `QuestionnaireResponse.flaggedSafety`: a positive safety answer ends the funnel into the crisis path (988, resources, "we're not the right fit right now" messaging) and is never silently ignored. Same flag drives provider-side alerts on check-ins.

5. **Heavy PHI lives in object storage, pointers in Postgres.** Transcripts, recordings, attachments, AI session summaries → encrypted S3 objects (`storageKey`), served via short-lived signed URLs after an authorization check. Keeps the DB small and access controllable.

6. **Notes have a lifecycle with tamper evidence.** `AI_DRAFT → IN_REVIEW → SIGNED (content locked, sha256 stored) → AMENDED (append-only NoteAmendment)`. Providers must be able to prove what they signed.

7. **`AuditEvent` is append-only.** Application role has INSERT/SELECT only. Every clinical read and write, every admin impersonation, every note signature goes through the single audit helper.

8. **`AiInteraction` gives cost + safety observability** for every model call (purpose, model, tokens, latency, safety flag) without duplicating conversation content into the DB.

9. **Stripe never sees PHI.** `Subscription`/`Payment` store Stripe IDs; Stripe metadata carries only opaque cuids.

10. **Deletion policy.** Clinical records (notes, transcripts, responses linked to care) are retained per medical-records law (state-dependent, typically 6–10 years) — account "deletion" deactivates and de-identifies what is legally allowed, never hard-deletes the chart. Marketing/funnel data (unlinked IntakeSessions) is genuinely deleted on TTL.

## Migration discipline

- Every schema change = one Prisma migration, reviewed in PR, never edited after merge.
- Seeds: `packages/db/seed/` — questionnaire content (PHQ-9/GAD-7/ASRS/intake), synthetic patients/providers for dev/staging, feature flags (all risky flags default **off**).
- Before Phase 3 (real PHI), enable Postgres PITR backups + quarterly restore drills (see launch plan).
