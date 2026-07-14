#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "ERROR: .env is required" >&2
  exit 1
fi
set -a
# shellcheck disable=SC1091
source .env
set +a

required_env=(
  AUTH_SECRET
  ADMIN_OWNER_PHONE
  ADMIN_PASS
  ADMIN_SESSION_SECRET
  PUBLIC_CONVERSATION_SECRET
  REDIS_URL
)
for key in "${required_env[@]}"; do
  if [ -z "${!key:-}" ]; then
    echo "ERROR: required environment variable ${key} is missing" >&2
    exit 1
  fi
done
if [ "${TRUST_PROXY_HEADERS:-0}" != "1" ]; then
  echo "ERROR: TRUST_PROXY_HEADERS=1 is required with the checked-in nginx proxy headers" >&2
  exit 1
fi
if [ -z "${ADMIN_TOTP_SECRET:-}" ]; then
  echo "WARNING: ADMIN_TOTP_SECRET is not configured; admin MFA remains disabled" >&2
fi

echo "==> Pulling fast-forward-only source"
git pull --ff-only

echo "==> Installing locked application dependencies"
npm ci

if [ -f mini-services/whatsapp-bridge/package-lock.json ]; then
  echo "==> Installing locked WhatsApp bridge dependencies"
  (cd mini-services/whatsapp-bridge && npm ci --legacy-peer-deps)
elif [ -f mini-services/whatsapp-bridge/package.json ]; then
  echo "ERROR: WhatsApp bridge package-lock.json is required for a reproducible deploy" >&2
  exit 1
fi

echo "==> Generating Prisma client"
npx prisma generate

# Build before changing the database. A compile failure therefore leaves the
# currently-running application and schema untouched.
echo "==> Building production artifact"
npm run build

echo "==> Applying checked-in database migrations"
npx prisma migrate deploy

echo "==> Reloading services"
pm2 delete vignet-studio >/dev/null 2>&1 || true
if pm2 describe vignet-web >/dev/null 2>&1; then
  pm2 reload deploy/ecosystem.config.js --update-env
else
  pm2 start deploy/ecosystem.config.js
fi
pm2 save

echo "==> Waiting for application health"
healthy=0
for _ in $(seq 1 30); do
  if curl --fail --silent --show-error --max-time 3 http://127.0.0.1:3003/api/health >/dev/null; then
    healthy=1
    break
  fi
  sleep 2
done

if [ "${healthy}" -ne 1 ]; then
  echo "ERROR: deployment reloaded but health check did not pass" >&2
  pm2 status
  exit 1
fi

pm2 status
echo "==> Deployment is healthy"
