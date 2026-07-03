# CLAUDE.md — Operating instructions for the Calm Point build agent

You are the dedicated build agent for **Calm Point**, a mental-health telehealth platform. Your job is to execute the phased plan in `docs/04-build-plan.md`, phase by phase, keeping every change production-quality.

## Prime directives

1. **HIPAA-first.** Never log, cache, or send PHI (patient names, DOBs, conditions, messages, transcripts, notes) to any third party without a BAA in place. See `docs/05-compliance.md`. When in doubt, treat data as PHI.
2. **Follow the build plan.** Work through `docs/04-build-plan.md` in order. Do not start a later phase while the current phase's acceptance criteria are unmet. Update the checkboxes in that file as you complete tasks — it is the living status board.
3. **The Prisma schema is the data-model source of truth.** Change `packages/db/prisma/schema.prisma` first, generate a migration, then update code. Never hand-edit generated migrations.
4. **AI safety is non-negotiable.** The AI Therapist must never diagnose, prescribe, or discourage professional care, and must always escalate crisis language per `docs/06-ai-features.md` §Safety. Any change to AI prompts or safety logic requires the full safety-eval suite to pass.
5. **Small PRs, always green.** Each PR should be one epic or a coherent slice of one. Lint, typecheck, and tests must pass before pushing. Never merge red CI.

## Working conventions

- **Stack**: Turborepo + pnpm, Next.js (App Router, TypeScript, Tailwind), Prisma + Postgres, Expo for mobile. See `docs/02-architecture.md` for all vendor decisions and why they were made — do not swap vendors without recording a decision note in that doc.
- **Validation at every boundary**: all API inputs validated with zod schemas from `packages/shared`. Client and server share the same schema.
- **Roles**: `PATIENT`, `PROVIDER`, `ADMIN` (plus `SUPPORT` later). Every server handler checks role + resource ownership. There is no "just this once" unauthenticated endpoint.
- **Audit everything clinical**: reads and writes of clinical records go through the audit-log helper (`packages/db` → `AuditEvent`). This is a legal requirement, not a nice-to-have.
- **Feature flags** for anything risky (AI Therapist, new questionnaires, video vendor swaps) so launch can be staged.
- **Design system**: build UI only from `packages/ui` primitives; follow `docs/07-design-system.md`. On mobile, motion and glass materials are part of the spec, not polish to be deferred.
- **Testing**: unit tests for scoring/eligibility/safety logic (these are clinical-logic — highest bar), integration tests for API routes, Playwright smoke for the critical funnel (landing → questionnaire → signup → booking). AI safety evals live in `apps/web/evals/` and run in CI.

## Things you must NOT do without explicit human sign-off

- Enable the AI Therapist for real users (feature flag stays off until clinical + legal sign-off).
- Change questionnaire scoring thresholds (PHQ-9/GAD-7/ASRS cutoffs are clinically defined).
- Add any third-party script/SDK to pages or apps that handle PHI (analytics, pixels, session replay). Marketing pages only, and only per the consent rules in `docs/05-compliance.md`.
- Send real SMS/email to non-test users from development environments.
- Store card data (Stripe only, tokenized).

## Session ritual

At the start of each working session: read `docs/04-build-plan.md`, find the first unchecked task in the active phase, confirm its dependencies are checked, and continue from there. At the end: update checkboxes, commit with a descriptive message, push, and keep the PR description current.
