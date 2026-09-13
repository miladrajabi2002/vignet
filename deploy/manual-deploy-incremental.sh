#!/usr/bin/env bash
# Manual incremental deploy for Vigent — mirrors deploy/deploy.sh's build+restart
# flow but skips npm ci / migrations (no dependency or schema changes).
set -euo pipefail

cd /var/www/vigent.ir/public/vignet
APP_ROOT="$(pwd -P)"

# Load application env (NEXT_SERVER_ACTIONS_ENCRYPTION_KEY et al.)
set -a
# shellcheck disable=SC1091
source .env
set +a

export VIGENT_DEPLOYMENT_ID="$(git rev-parse --verify HEAD)"
export VIGENT_NEXT_DIST_DIR=".next-builds/${VIGENT_DEPLOYMENT_ID}-$(date +%s)-$$"
echo "==> Building into ${VIGENT_NEXT_DIST_DIR}"

# Capture the currently active artifact for chunk retention + rollback
ACTIVE_DIST="$(pm2 jlist 2>/dev/null | node -e '
let input = "";
process.stdin.on("data", chunk => input += chunk);
process.stdin.on("end", () => {
  const p = JSON.parse(input).find(item => item.name === "vignet-web");
  process.stdout.write(p?.pm2_env?.VIGENT_NEXT_DIST_DIR || ".next");
});')"
echo "==> Active dist dir: ${ACTIVE_DIST}"

mkdir -p .next-builds

echo "==> Building production artifact"
npm run build 2>&1 | tail -40

# Retain previous release chunks so open browser tabs keep working
if [ -d "${ACTIVE_DIST}/static" ]; then
  echo "==> Retaining previous release chunks"
  mkdir -p "${VIGENT_NEXT_DIST_DIR}/static"
  cp -an "${ACTIVE_DIST}/static/." "${VIGENT_NEXT_DIST_DIR}/static/" || true
fi

echo "==> Restarting services with the new build"
pm2 restart deploy/ecosystem.config.js --update-env

echo "==> Waiting for health"
sleep 6
for i in $(seq 1 20); do
  CODE="$(curl -s -o /dev/null -w '%{http_code}' -H 'Host: vigent.ir' http://127.0.0.1:3003/ --max-time 10 || true)"
  if [ "${CODE}" = "200" ]; then
    echo "==> HEALTHY (HTTP ${CODE})"
    echo "DEPLOY_OK dist=${VIGENT_NEXT_DIST_DIR}"
    exit 0
  fi
  echo "    attempt ${i}: HTTP ${CODE}"
  sleep 3
done

echo "ERROR: health check failed — rolling back to ${ACTIVE_DIST}"
export VIGENT_NEXT_DIST_DIR="${ACTIVE_DIST}"
pm2 restart deploy/ecosystem.config.js --update-env || true
exit 1
