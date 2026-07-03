# Calm Point

**A production-grade mental-health telehealth platform** — web, iOS, and Android — connecting patients with licensed providers for ADHD, anxiety, depression, weight management, and related conditions. Includes AI-assisted intake, AI visit scribing, secure messaging, video visits, and a standalone AI Therapist companion experience.

> ⚕️ **This is a healthcare product.** Every feature that touches patient data must be built HIPAA-first. Read [`docs/05-compliance.md`](docs/05-compliance.md) before writing any code that stores, transmits, or displays patient information.

---

## What we are building

| Surface | Description |
|---|---|
| **Marketing site + landing pages** | Ad-traffic landing pages, condition-specific funnels, sign-up, SEO content |
| **Patient web portal** | Intake questionnaire, appointment scheduling, video visits, secure messaging, care plan, billing |
| **Provider portal** | Panel/caseload view, calendar, video visits, AI-drafted visit notes (SOAP), messaging, intake review |
| **Admin portal** | User/provider management, credentialing records, audit logs, content management, analytics |
| **iOS + Android apps** | Expo/React Native apps with an Apple-quality "liquid glass" design language |
| **AI Therapist** | Post-onboarding voice + text companion (Gemini Live + xAI voice; Claude for text/safety), gated behind clinical sign-off |
| **AI Scribe** | Real-time transcription of visits → structured SOAP note drafts for provider review/sign-off |

## Documentation map (read in order)

1. [`docs/01-product-spec.md`](docs/01-product-spec.md) — product vision, personas, user journeys, feature inventory
2. [`docs/02-architecture.md`](docs/02-architecture.md) — tech stack, system design, service boundaries, vendor choices
3. [`docs/03-data-model.md`](docs/03-data-model.md) — database schema narrative (source of truth: `packages/db/prisma/schema.prisma`)
4. [`docs/04-build-plan.md`](docs/04-build-plan.md) — **the phased implementation plan** with epics, tasks, and acceptance criteria
5. [`docs/05-compliance.md`](docs/05-compliance.md) — HIPAA, telehealth law, controlled substances, AI safety guardrails
6. [`docs/06-ai-features.md`](docs/06-ai-features.md) — AI Therapist, AI Scribe, intake triage — design + safety architecture
7. [`docs/07-design-system.md`](docs/07-design-system.md) — "Liquid glass" design language, motion, components
8. [`docs/08-launch-plan.md`](docs/08-launch-plan.md) — App Store / Play Store / web launch checklist, ads funnel, ops runbook

## Repository layout (monorepo)

```
calm-point/
├── apps/
│   ├── web/            # Next.js — marketing site + patient/provider/admin portals
│   └── mobile/         # Expo (React Native) — iOS + Android (scaffolded in Phase 4)
├── packages/
│   ├── db/             # Prisma schema + client (source of truth for the data model)
│   ├── ui/             # Shared design-system components (scaffolded in Phase 1)
│   └── shared/         # Shared types, validation schemas (zod), constants
├── docs/               # All planning + compliance documentation
└── CLAUDE.md           # Operating instructions for the dedicated build agent
```

## Getting started (development)

```bash
corepack enable                 # enables pnpm
pnpm install
cp .env.example .env            # fill in secrets — see docs/02-architecture.md §Environments
pnpm db:generate                # generate Prisma client
pnpm dev                        # runs apps/web on http://localhost:3000
```

## Status

Greenfield. The plan, schema, and scaffold in this PR are Phase 0. Execution begins with Phase 1 in [`docs/04-build-plan.md`](docs/04-build-plan.md).
