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

pm2_process_env_value() {
  local service="$1"
  local key="$2"
  pm2 jlist 2>/dev/null | node -e '
    let input = "";
    process.stdin.on("data", chunk => input += chunk);
    process.stdin.on("end", () => {
      const [name, key] = process.argv.slice(1);
      try {
        const processInfo = JSON.parse(input).find(item => item.name === name);
        const value = processInfo?.pm2_env?.[key];
        if (typeof value === "string") process.stdout.write(value);
      } catch {}
    });
  ' "${service}" "${key}"
}

validate_dist_dir() {
  local dist_dir="$1"
  if [ "${dist_dir}" = ".next" ] || [[ "${dist_dir}" =~ ^\.next-builds/[0-9a-f]{40}(-[0-9]+-[0-9]+)?$ ]]; then
    return 0
  fi
  echo "ERROR: unsafe Next.js dist directory: ${dist_dir}" >&2
  return 1
}

remove_versioned_build_dir() {
  local dist_dir="$1"
  if ! [[ "${dist_dir}" =~ ^\.next-builds/[0-9a-f]{40}(-[0-9]+-[0-9]+)?$ ]]; then
    echo "ERROR: refusing to remove unsafe build directory: ${dist_dir}" >&2
    return 1
  fi
  [ ! -d "${dist_dir}" ] && return 0
  find "${dist_dir}" -mindepth 1 -delete
  rmdir "${dist_dir}"
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
          return current
            && path.resolve(current.pm2_env.pm_exec_path) === path.resolve(expected.script)
            && current.pm2_env.exec_interpreter === expected.interpreter;
        });
        process.exit(matches ? 0 : 1);
      } catch {
        process.exit(1);
      }
    });
  '
}

pm2_apps_have_insecure_tls_override() {
  pm2 jlist 2>/dev/null | node -e '
    let input = "";
    process.stdin.on("data", chunk => input += chunk);
    process.stdin.on("end", () => {
      try {
        const managedNames = new Set(["vignet-web", "vignet-worker", "vignet-studio"]);
        const hasInsecureOverride = JSON.parse(input).some(item =>
          managedNames.has(item.name) && item.pm2_env?.NODE_TLS_REJECT_UNAUTHORIZED === "0"
        );
        process.exit(hasInsecureOverride ? 0 : 1);
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

# Capture the immutable artifact used by the currently running web process.
# This is also the rollback target if any later deployment step fails.
active_dist_dir="$(pm2_process_env_value vignet-web VIGENT_NEXT_DIST_DIR || true)"
active_dist_dir="${active_dist_dir:-.next}"
active_deployment_id="$(pm2_process_env_value vignet-web VIGENT_DEPLOYMENT_ID || true)"
validate_dist_dir "${active_dist_dir}"

services_stopped=0
recover_failed_deployment() {
  local status=$?
  trap - EXIT
  if [ "${status}" -ne 0 ] && [ "${services_stopped}" -eq 1 ]; then
    echo "ERROR: deployment failed; restarting the previous release" >&2
    export VIGENT_NEXT_DIST_DIR="${active_dist_dir}"
    if [ -n "${active_deployment_id}" ]; then
      export VIGENT_DEPLOYMENT_ID="${active_deployment_id}"
    else
      unset VIGENT_DEPLOYMENT_ID
    fi
    pm2 restart deploy/ecosystem.config.js --update-env >/dev/null 2>&1 || true
  fi
  exit "${status}"
}
trap recover_failed_deployment EXIT

# Next.js salts Server Action IDs with this key. Its default is regenerated on
# every build, so an otherwise unchanged action stops existing for tabs opened
# before a deployment. Preserve the key from the currently served artifact on
# the first upgraded deploy, then persist it in .env for every later build.
if [ -z "${NEXT_SERVER_ACTIONS_ENCRYPTION_KEY:-}" ]; then
  previous_actions_key=""
  if [ -f "${active_dist_dir}/server/server-reference-manifest.json" ]; then
    previous_actions_key="$(node -e '
      try {
        const manifest = require(process.argv[1]);
        if (typeof manifest.encryptionKey === "string") process.stdout.write(manifest.encryptionKey);
      } catch {}
    ' "./${active_dist_dir}/server/server-reference-manifest.json")"
  fi

  if ! node -e '
    const key = process.argv[1] || "";
    const decoded = Buffer.from(key, "base64");
    process.exit(decoded.length === 32 && decoded.toString("base64") === key ? 0 : 1);
  ' "${previous_actions_key}"; then
    previous_actions_key="$(node -e 'process.stdout.write(require("crypto").randomBytes(32).toString("base64"))')"
  fi

  printf '\n# Stable across builds; changing it invalidates existing Server Action IDs.\nNEXT_SERVER_ACTIONS_ENCRYPTION_KEY="%s"\n' "${previous_actions_key}" >> .env
  export NEXT_SERVER_ACTIONS_ENCRYPTION_KEY="${previous_actions_key}"
  echo "==> Persisted stable Server Action encryption key"
fi

if ! node -e '
  const key = process.argv[1] || "";
  const decoded = Buffer.from(key, "base64");
  process.exit(decoded.length === 32 && decoded.toString("base64") === key ? 0 : 1);
' "${NEXT_SERVER_ACTIONS_ENCRYPTION_KEY}"; then
  echo "ERROR: NEXT_SERVER_ACTIONS_ENCRYPTION_KEY must be a Base64-encoded 32-byte key" >&2
  exit 1
fi

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

# next.config.mjs uses this to version asset requests for the release being
# built. It deliberately comes from the pulled commit, not the pre-pull state.
export VIGENT_DEPLOYMENT_ID="$(git rev-parse --verify HEAD)"
# A commit may be deployed more than once. Always use a unique artifact path
# so a retry can never delete the currently active rollback build.
export VIGENT_NEXT_DIST_DIR=".next-builds/${VIGENT_DEPLOYMENT_ID}-$(date +%s)-$$"
validate_dist_dir "${VIGENT_NEXT_DIST_DIR}"

# PM2 restart/startOrRestart does not replace pm_exec_path for an existing app.
# Detect a required command migration before npm ci replaces node_modules.
recreate_pm2_apps=0
if ! pm2_scripts_match_ecosystem; then
  recreate_pm2_apps=1
fi
if pm2_apps_have_insecure_tls_override; then
  echo "==> Removing stale insecure TLS override from PM2 services"
  recreate_pm2_apps=1
fi

# npm ci replaces node_modules in place. Stop every process that imports from
# it before installation; otherwise a live request can observe a half-replaced
# Next.js/Prisma tree. The EXIT trap restarts the previous immutable build if
# installation, compilation, backup, migration, or health verification fails.
echo "==> Stopping Vigent services before replacing dependencies"
services_stopped=1
pm2 stop vignet-worker >/dev/null 2>&1 || true
stop_service_and_release_port "vignet-web" 3003 "${APP_ROOT}"
stop_service_and_release_port "vignet-studio" 5555 "${APP_ROOT}"

echo "==> Installing locked application dependencies"
npm ci

echo "==> Validating launch-critical production configuration"
npm run check:production-env

# Never pass this process-wide TLS escape hatch to builds or PM2 children.
# The validation above deliberately runs first so an explicit unsafe setting
# in the shell or .env fails closed instead of being silently ignored.
unset NODE_TLS_REJECT_UNAUTHORIZED

echo "==> Generating Prisma client"
npx prisma generate

# Each commit gets a separate build directory. Never let `next build` mutate
# the artifact selected by a running or rollback server.
remove_versioned_build_dir "${VIGENT_NEXT_DIST_DIR}"
mkdir -p .next-builds
echo "==> Building production artifact"
npm run build

if [ -d "${active_dist_dir}/static" ]; then
  echo "==> Retaining previous release chunks for open browser tabs"
  mkdir -p "${VIGENT_NEXT_DIST_DIR}/static"
  cp -an "${active_dist_dir}/static/." "${VIGENT_NEXT_DIST_DIR}/static/"
  find "${VIGENT_NEXT_DIST_DIR}/static" -type f -mmin +1440 -delete
  find "${VIGENT_NEXT_DIST_DIR}/static" -depth -type d -empty -delete
fi

# A migration must never be the first operation that touches production data.
# Keep this fail-closed: if pg_dump cannot produce a restorable snapshot, the
# deployment stops before Prisma changes the schema.
echo "==> Creating pre-migration database backup"
bash deploy/backup.sh

echo "==> Applying checked-in database migrations"
npx prisma migrate deploy

echo "==> Restarting services"
if [ "${recreate_pm2_apps}" -eq 1 ]; then
  echo "==> Re-registering PM2 services with direct executables"
  pm2 delete vignet-web vignet-worker vignet-studio >/dev/null 2>&1 || true
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

running_dist_dir="$(pm2_process_env_value vignet-web VIGENT_NEXT_DIST_DIR || true)"
running_deployment_id="$(pm2_process_env_value vignet-web VIGENT_DEPLOYMENT_ID || true)"
if [ "${running_dist_dir}" != "${VIGENT_NEXT_DIST_DIR}" ] \
  || [ "${running_deployment_id}" != "${VIGENT_DEPLOYMENT_ID}" ]; then
  echo "ERROR: health responded from the wrong web artifact" >&2
  echo "Expected: ${VIGENT_DEPLOYMENT_ID} (${VIGENT_NEXT_DIST_DIR})" >&2
  echo "Running:  ${running_deployment_id:-unset} (${running_dist_dir:-unset})" >&2
  exit 1
fi

echo "==> Waiting for Prisma Studio health"
studio_healthy=0
for _ in $(seq 1 30); do
  snapshot="$(pm2_process_snapshot vignet-studio || true)"
  status="${snapshot%%:*}"
  pid="${snapshot##*:}"

  if [ "${status}" = "online" ] \
    && [ "${pid}" -gt 0 ] 2>/dev/null \
    && curl --fail --silent --show-error --max-time 3 http://127.0.0.1:5555/ >/dev/null; then
    studio_healthy=1
    break
  fi
  sleep 2
done

if [ "${studio_healthy}" -ne 1 ]; then
  echo "ERROR: Prisma Studio did not become healthy on loopback port 5555" >&2
  pm2 logs vignet-studio --lines 50 --nostream || true
  exit 1
fi

pm2 save
services_stopped=0

# Retain the current and two previous versioned builds for rollback. The
# original `.next` directory is left intact as the first migration fallback.
mapfile -t stale_build_dirs < <(
  find .next-builds -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' \
    | sort -nr \
    | tail -n +4 \
    | cut -d' ' -f2-
)
for stale_build_dir in "${stale_build_dirs[@]}"; do
  remove_versioned_build_dir "${stale_build_dir}"
done

pm2 status
echo "==> Deployment is healthy"
