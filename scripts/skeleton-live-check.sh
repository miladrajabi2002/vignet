#!/usr/bin/env bash
# Smoke-test the streamed skeleton of a dashboard route with a minted session.
# Usage: bash scripts/skeleton-live-check.sh <path> <phone>   e.g. /contacts 0912…
# The phone picks WHICH account the 5-minute session is minted for — it is
# required so the check never silently signs in as the oldest (owner) account.
set -euo pipefail
cd "$(dirname "$0")/.."

ROUTE="${1:-/contacts}"
USER_PHONE="${2:-${SKELETON_CHECK_PHONE:-}}"
if [ -z "$USER_PHONE" ]; then
  echo "usage: bash scripts/skeleton-live-check.sh <path> <phone>" >&2
  exit 1
fi

TOKEN=$(NODE_ENV=production npx tsx --tsconfig scripts/tsconfig.skeleton-check.json scripts/mint-session.ts "$USER_PHONE" | tail -n 1)

HTML=$(curl -s -m 30 -H "Host: vigent.ir" -H "Cookie: __Secure-authjs.session-token=$TOKEN" "http://127.0.0.1:3003$ROUTE")

echo "bytes: ${#HTML}"
for pat in 'skeleton-shimmer' 'ui-fbar' 'ui-seg' 'spatial-surface' 'md:hidden' 'hidden md:block'; do
  printf '%-20s %s\n' "$pat" "$(printf '%s' "$HTML" | grep -o "$pat" | wc -l)"
done
