#!/usr/bin/env bash
# Smoke-test the streamed skeleton of a dashboard route with a minted session.
# Usage: bash scripts/skeleton-live-check.sh <path>   e.g. /contacts
set -euo pipefail
cd /var/www/vigent.ir/public/vignet

ROUTE="${1:-/contacts}"
DBURL=$(grep '^DATABASE_URL=' .env | cut -d'"' -f2 | sed 's/?.*//')
ROW=$(psql "$DBURL" -t -A -F' ' -c 'SELECT id, phone FROM "User" ORDER BY "createdAt" LIMIT 1')
USER_ID=$(echo "$ROW" | cut -d' ' -f1)
USER_PHONE=$(echo "$ROW" | cut -d' ' -f2)
echo "user phone: $USER_PHONE"

TOKEN=$(NODE_ENV=production npx tsx --tsconfig scripts/tsconfig.skeleton-check.json scripts/mint-session.ts "$USER_PHONE" | tail -n 1)

HTML=$(curl -s -m 30 -H "Host: vigent.ir" -H "Cookie: __Secure-authjs.session-token=$TOKEN" "http://127.0.0.1:3003$ROUTE")

echo "bytes: ${#HTML}"
for pat in 'skeleton-shimmer' 'ui-fbar' 'ui-seg' 'spatial-surface' 'md:hidden' 'hidden md:block'; do
  printf '%-20s %s\n' "$pat" "$(printf '%s' "$HTML" | grep -o "$pat" | wc -l)"
done
