#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
APP_ROOT="$(pwd -P)"

port_listener_pids() {
  local port="$1"

  if command -v lsof >/dev/null 2>&1; then
    lsof -nP -t -iTCP:"${port}" -sTCP:LISTEN 2>/dev/null || true
  elif command -v fuser >/dev/null 2>&1; then
    fuser -n tcp "${port}" 2>/dev/null | tr ' ' '\n' | sed '/^$/d' || true
  elif command -v ss >/dev/null 2>&1; then
    ss -H -lptn "sport = :${port}" 2>/dev/null \
      | sed -n 's/.*pid=\([0-9][0-9]*\).*/\1/p' \
      | sort -u
  else
    echo "ERROR: lsof, fuser, or ss is required to verify port ${port}" >&2
    return 1
  fi
}

stop_service_and_release_port() {
  local service="$1"
  local port="$2"
  local expected_cwd="$3"
  local pids pid pid_cwd

  pm2 stop "${service}" >/dev/null 2>&1 || true

  # A previous npm-based PM2 process may have left its child alive. Give a
  # normal PM2 stop a chance first, then terminate only listeners whose cwd is
  # this checkout (never an unrelated process that happens to use the port).
  for _ in $(seq 1 10); do
    pids="$(port_listener_pids "${port}")"
    [ -z "${pids}" ] && return 0
    sleep 1
  done

  for pid in ${pids}; do
    pid_cwd="$(readlink -f "/proc/${pid}/cwd" 2>/dev/null || true)"
    if [ "${pid_cwd}" != "${expected_cwd}" ]; then
      echo "ERROR: port ${port} is owned by PID ${pid} outside ${expected_cwd} (${pid_cwd:-unknown})" >&2
      return 1
    fi
    echo "==> Stopping stale ${service} listener (PID ${pid}, port ${port})"
    kill -TERM "${pid}"
  done

  for _ in $(seq 1 10); do
    pids="$(port_listener_pids "${port}")"
    [ -z "${pids}" ] && return 0
    sleep 1
  done

  for pid in ${pids}; do
    pid_cwd="$(readlink -f "/proc/${pid}/cwd" 2>/dev/null || true)"
    if [ "${pid_cwd}" = "${expected_cwd}" ]; then
      echo "==> Force-stopping stale ${service} listener (PID ${pid})"
      kill -KILL "${pid}"
    fi
  done

  sleep 1
  pids="$(port_listener_pids "${port}")"
  if [ -n "${pids}" ]; then
    echo "ERROR: port ${port} is still occupied by PID(s): ${pids//$'\n'/ }" >&2
    return 1
  fi
}

pm2_process_snapshot() {
  local service="$1"
  pm2 jlist 2>/dev/null | node -e '
    let input = "";
    process.stdin.on("data", chunk => input += chunk);
    process.stdin.on("end", () => {
      const name = process.argv[1];
      try {
        const processInfo = JSON.parse(input).find(item => item.name === name);
        if (!processInfo) process.exit(1);
        process.stdout.write(`${processInfo.pm2_env?.status || "unknown"}:${processInfo.pid || 0}`);
      } catch {
        process.exit(1);
      }
    });
  ' "${service}"
}

pm2_scripts_match_ecosystem() {
  pm2 jlist 2>/dev/null | node -e '
    const path = require("path");
    let input = "";
    process.stdin.on("data", chunk => input += chunk);
    process.stdin.on("end", () => {
      try {
        const root = process.cwd();
        const expectedApps = require(path.join(root, "deploy", "ecosystem.config.js")).apps;
        const runningApps = JSON.parse(input);
        const matches = expectedApps.every(expected => {
          const current = runningApps.find(item => item.name === expected.name);
          return current && path.resolve(current.pm2_env.pm_exec_path) === path.resolve(expected.script);
        });
        process.exit(matches ? 0 : 1);
      } catch {
        process.exit(1);
      }
    });
  '
}

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

echo "==> Validating launch-critical production configuration"
npm run check:production-env

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

# A migration must never be the first operation that touches production data.
# Keep this fail-closed: if pg_dump cannot produce a restorable snapshot, the
# deployment stops before Prisma changes the schema.
echo "==> Creating pre-migration database backup"
bash deploy/backup.sh

echo "==> Applying checked-in database migrations"
npx prisma migrate deploy

echo "==> Restarting services"
pm2 delete vignet-studio >/dev/null 2>&1 || true

# PM2 restart/startOrRestart does not replace pm_exec_path for an existing app.
# Detect the one-time migration from the old npm wrappers before stopping them.
recreate_pm2_apps=0
if ! pm2_scripts_match_ecosystem; then
  recreate_pm2_apps=1
fi

# Stop port-owning services before changing their PM2 command. This also
# self-heals the orphaned Next.js/npm state created by older deployments.
stop_service_and_release_port "vignet-web" 3003 "${APP_ROOT}"
stop_service_and_release_port \
  "vignet-whatsapp-bridge" \
  3040 \
  "${APP_ROOT}/mini-services/whatsapp-bridge"

if [ "${recreate_pm2_apps}" -eq 1 ]; then
  echo "==> Re-registering PM2 services with direct executables"
  pm2 delete vignet-web vignet-worker vignet-whatsapp-bridge >/dev/null 2>&1 || true
  pm2 start deploy/ecosystem.config.js
else
  pm2 restart deploy/ecosystem.config.js --update-env
fi

echo "==> Waiting for application health"
healthy=0
stable_pid=""
stable_checks=0
for _ in $(seq 1 30); do
  snapshot="$(pm2_process_snapshot vignet-web || true)"
  status="${snapshot%%:*}"
  pid="${snapshot##*:}"

  if [ "${status}" = "online" ] \
    && [ "${pid}" -gt 0 ] 2>/dev/null \
    && curl --fail --silent --show-error --max-time 3 http://127.0.0.1:3003/api/health >/dev/null; then
    if [ "${pid}" = "${stable_pid}" ]; then
      stable_checks=$((stable_checks + 1))
    else
      stable_pid="${pid}"
      stable_checks=1
    fi

    # Do not accept a response from an orphan/stale listener. The PM2-owned
    # process must remain online with the same PID across three checks.
    if [ "${stable_checks}" -ge 3 ]; then
      healthy=1
      break
    fi
  else
    stable_pid=""
    stable_checks=0
  fi
  sleep 2
done

if [ "${healthy}" -ne 1 ]; then
  echo "ERROR: deployment restarted but the PM2-owned web process did not become stable" >&2
  pm2 status
  pm2 logs vignet-web --lines 50 --nostream || true
  exit 1
fi

pm2 save
pm2 status
echo "==> Deployment is healthy"
