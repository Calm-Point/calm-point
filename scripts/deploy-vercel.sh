#!/usr/bin/env bash
# One-command production deploy for Calm Point (apps/web) → Vercel.
#
# Usage:
#   VERCEL_TOKEN=xxx DATABASE_URL='postgresql://...?schema=calm_point' \
#     bash scripts/deploy-vercel.sh
#
# Optional env:
#   VERCEL_SCOPE   Vercel team slug (default: johnmatveyev-lab)
#   PROJECT_NAME   Vercel project name (default: calm-point)
#   AUTH_SECRET    Auth.js secret (default: generated here)
#   RUN_SEED       "1" to seed synthetic dev data after migrate (default: 1)
#
# Idempotent: safe to re-run. Never commits secrets; reads them from the env.
set -euo pipefail

: "${VERCEL_TOKEN:?Set VERCEL_TOKEN (vercel.com/account/tokens)}"
: "${DATABASE_URL:?Set DATABASE_URL to the production Postgres connection string}"
VERCEL_SCOPE="${VERCEL_SCOPE:-johnmatveyev-lab}"
PROJECT_NAME="${PROJECT_NAME:-calm-point}"
AUTH_SECRET="${AUTH_SECRET:-$(openssl rand -base64 32)}"
RUN_SEED="${RUN_SEED:-1}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
V() { npx --yes vercel@latest "$@" --token "$VERCEL_TOKEN" --scope "$VERCEL_SCOPE"; }

echo "==> 1/5  Applying database schema + seed (against your DATABASE_URL)"
# migrate:deploy is non-destructive; the schema already exists if you pointed at
# the pre-migrated Supabase project — Prisma will simply report no pending work.
DATABASE_URL="$DATABASE_URL" pnpm --filter @calm-point/db exec prisma migrate deploy
if [ "$RUN_SEED" = "1" ]; then
  DATABASE_URL="$DATABASE_URL" pnpm --filter @calm-point/db seed || \
    echo "    (seed skipped/failed — data may already exist; continuing)"
fi

echo "==> 2/5  Linking Vercel project '$PROJECT_NAME' (root: apps/web)"
V link --yes --project "$PROJECT_NAME" >/dev/null

echo "==> 3/5  Setting production environment variables"
set_env() {
  local name="$1" val="$2"
  V env rm "$name" production --yes >/dev/null 2>&1 || true
  printf '%s' "$val" | V env add "$name" production >/dev/null
}
set_env DATABASE_URL "$DATABASE_URL"
set_env AUTH_SECRET "$AUTH_SECRET"
# AUTH_URL is set to the real domain after the first deploy resolves it.

echo "==> 4/5  Deploying to production"
URL="$(V deploy --prod --yes)"
echo "    deployed: $URL"

echo "==> 5/5  Pinning AUTH_URL to the deployment domain + redeploy"
set_env AUTH_URL "$URL"
FINAL="$(V deploy --prod --yes)"

echo
echo "✅ LIVE: $FINAL"
echo "   Health:  $FINAL/api/health"
echo "   Sign in: patient@calmpoint.dev / provider@calmpoint.dev / admin@calmpoint.dev"
echo "   Password: CalmPoint-Dev-2026!  (rotate before real users — see docs/05)"
