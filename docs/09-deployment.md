# 09 — Deployment

## Live now

- **Landing + working check-in funnel (public, shareable):**
  https://claude.ai/code/artifact/8e84e20d-98d5-4d0d-b7f7-84cdbfaf0f37 —
  the Calm Point front door (Calm Glass design, both themes) with a live
  per-condition screener that runs one-question-per-screen, keyboard-navigable,
  with the real crisis-divert safety path (988 / Crisis Text Line) and
  non-diagnostic result framing. Source: `apps/web/public/demo/landing.html`.
  This is the marketing/funnel surface deployed as a self-contained page; the
  full backend app (auth, DB, booking, video, messaging) deploys to Vercel per
  the steps below.

## Current state (updated 2026-07-04)

| Piece | Status |
|---|---|
| **Database** | ✅ **LIVE** — Supabase project `gmfhkkvqvzilnjvsbxao` (us-east-1), all tables in the isolated **`calm_point` schema**, migrated + seeded (dev users, PHQ-9/GAD-7/ASRS content, flags). Reversible with `DROP SCHEMA calm_point CASCADE`. ⚠️ Shares the free-tier project "adpilot" because the org's 2-free-project limit is reached — move to a dedicated project (or paid org) before real PHI. 🚦 Supabase HIPAA add-on + BAA required before production PHI. |
| **Web app hosting** | ⏳ one-time human step required (below) |
| **Auto-deploy** | ✅ ready — `.github/workflows/deploy.yml` deploys on every push once secrets exist |

## Build-readiness (verified)

- `packages/db` runs `prisma generate` on `postinstall`, so a fresh Vercel/CI
  install produces the Prisma client with no extra build step.
- `apps/web` build command is `next build`; framework auto-detected as Next.js.
- Vercel project settings for this monorepo: **Root Directory = `apps/web`**,
  install runs from repo root (pnpm workspace auto-detected). `apps/web/vercel.json`
  carries the reminder cron.
- ⚠️ The existing Vercel project named `calmpoint` is linked to a *different*
  repo (`johnmatveyev-lab/CalmPoint`, an older prototype) — do **not** reuse it.
  Create a new Vercel project pointed at `Calm-Point/calm-point`.

## The one-time human step (pick either path)

### Path A — GitHub secrets (recommended: enables fully autonomous deploys)
1. Create a token at vercel.com/account/tokens.
2. In the Vercel dashboard create (or reuse) a project for this repo — set **Root Directory = `apps/web`** — and copy its Project ID (Settings → General).
3. Add three GitHub repo secrets (Settings → Secrets and variables → Actions):
   `VERCEL_TOKEN`, `VERCEL_ORG_ID` = `team_CWFHuApyeVOOzrPcMa3XZmbO`, `VERCEL_PROJECT_ID`.
4. Every push now deploys automatically; the build agent monitors via the Vercel connector and fixes failures.

### Path B — Vercel git integration
Vercel dashboard → Add New Project → import `Calm-Point/calm-point` → Root Directory `apps/web` → deploy. Pushes auto-deploy through Vercel's own integration.

## Vercel project environment variables (both paths)

| Var | Value |
|---|---|
| `DATABASE_URL` | `postgresql://postgres.gmfhkkvqvzilnjvsbxao:<DB_PASSWORD>@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&schema=calm_point` — password: Supabase dashboard → project `adpilot` → Settings → Database (reset it if unknown) |
| `DIRECT_URL` (optional, for migrations) | same but host port `5432` via `db.gmfhkkvqvzilnjvsbxao.supabase.co` and no `pgbouncer` params |
| `AUTH_SECRET` | any random 32+ bytes (`openssl rand -base64 32`) |
| `AUTH_URL` | the deployment URL, e.g. `https://<project>.vercel.app` |

Do **NOT** set `ALLOW_DEV_VIDEO` / `ALLOW_LOCAL_STORAGE` / `ALLOW_MOCK_AI` in any real deployment — those are local/CI test-mode opt-ins. Without vendor keys the video/scribe surfaces will correctly refuse rather than silently degrade. Vendor keys (Zoom, Deepgram, Anthropic, Twilio, Stripe) are added as they're procured, per `.env.example`.

## Seeded logins (synthetic data — no PHI)

`patient@calmpoint.dev` / `provider@calmpoint.dev` / `provider2@calmpoint.dev` / `admin@calmpoint.dev` — password `CalmPoint-Dev-2026!`. Provider/admin will be walked through TOTP enrollment on first login. **Rotate or delete these before real launch** (tracked in launch plan §pre-launch).

## Compliance reminders (docs/05)

Hosted staging with synthetic data is fine. Before ANY real patient data: Vercel BAA-capable plan 🚦, Supabase HIPAA add-on + BAA 🚦, S3 storage wired (local blob storage is refused in production), and the launch-plan §pre-launch checklist.
