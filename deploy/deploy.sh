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

is_versioned_build_dir() {
  local dist_dir="$1"
  # Current releases use the full 40-character commit id. Older deploys used
  # git's abbreviated id or a `build-<timestamp>-<pid>` basename, and may still
  # be a live rollback artifact when this script is upgraded. Accept those
  # legacy basenames only with their numeric suffix; slashes, traversal and
  # arbitrary names remain rejected.
  [[ "${dist_dir}" =~ ^\.next-builds/([0-9a-f]{40}|[0-9a-f]{7,40}-[0-9]+-[0-9]+|(manual-edit|build)-[0-9]+-[0-9]+)$ ]]
}

validate_dist_dir() {
  local dist_dir="$1"
  if [ "${dist_dir}" = ".next" ] || is_versioned_build_dir "${dist_dir}"; then
    return 0
  fi
  echo "ERROR: unsafe Next.js dist directory: ${dist_dir}" >&2
  return 1
}

remove_versioned_build_dir() {
  local dist_dir="$1"
  if ! is_versioned_build_dir "${dist_dir}"; then
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

# ─── Zero-downtime helpers ──────────────────────────────────────────────────
# nginx proxies to the `vigent_web` upstream: 127.0.0.1:3003 (primary) with
# 127.0.0.1:3004 as a backup. While vignet-web restarts, a temporary standby
# process on 3004 serves customers with the new build, so no request sees a 502.
STANDBY_NAME="vignet-web-standby"
STANDBY_PORT=3004
STATE_DIR=".deploy-state"
STAGING_DIR=".deploy-staging"
MIN_FREE_MB="${DEPLOY_MIN_FREE_MB:-2500}"

wait_for_http() {
  local url="$1"
  local attempts="$2"
  for _ in $(seq 1 "${attempts}"); do
    if curl --fail --silent --max-time 3 "${url}" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  return 1
}

nginx_has_standby_upstream() {
  command -v nginx >/dev/null 2>&1 \
    && nginx -T 2>/dev/null | grep -Eq "server[[:space:]]+127\.0\.0\.1:${STANDBY_PORT}[^;]*backup"
}

file_sha() {
  if [ -f "$1" ]; then sha256sum "$1" | cut -d' ' -f1; else echo "missing"; fi
}


free_disk_mb() {
  df -Pm . | awk 'NR == 2 { print $4 }'
}

# Keep only the active build and the newest other build (the rollback target).
prune_build_dirs() {
  local keep_active="$1"
  local kept_other=0
  local dir
  [ -d .next-builds ] || return 0
  while IFS= read -r dir; do
    [ -z "${dir}" ] && continue
    [ "${dir}" = "${keep_active}" ] && continue
    if [ "${kept_other}" -eq 0 ] && [ -f "${dir}/BUILD_ID" ]; then
      kept_other=1
      continue
    fi
    if is_versioned_build_dir "${dir}"; then
      echo "==> Removing old build ${dir}"
      remove_versioned_build_dir "${dir}"
    fi
  done < <(
    find .next-builds -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' \
      | sort -nr \
      | cut -d' ' -f2-
  )
}

# ─── Single deploy at a time ────────────────────────────────────────────────
mkdir -p "${STATE_DIR}"
exec 9>"${STATE_DIR}/deploy.lock"
if ! flock -n 9; then
  echo "ERROR: another deployment is already running" >&2
  exit 1
fi

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

web_switched=0
node_modules_swapped=0
new_dist_dir=""
recover_failed_deployment() {
  local status=$?
  trap - EXIT
  if [ "${status}" -ne 0 ]; then
    echo "ERROR: deployment failed; the previous release stays/returns live" >&2
    if [ "${node_modules_swapped}" -eq 1 ] && [ -d "${STAGING_DIR}/node_modules.prev" ]; then
      echo "==> Restoring previous node_modules" >&2
      rm -rf "${STAGING_DIR}/node_modules.failed"
      mv node_modules "${STAGING_DIR}/node_modules.failed" || true
      mv "${STAGING_DIR}/node_modules.prev" node_modules || true
    fi
    if [ "${web_switched}" -eq 1 ]; then
      export VIGENT_NEXT_DIST_DIR="${active_dist_dir}"
      if [ -n "${active_deployment_id}" ]; then
        export VIGENT_DEPLOYMENT_ID="${active_deployment_id}"
      else
        unset VIGENT_DEPLOYMENT_ID
      fi
      pm2 restart deploy/ecosystem.config.js --only vignet-web --update-env >/dev/null 2>&1 || true
      wait_for_http "http://127.0.0.1:3003/api/health" 30 || true
    fi
    pm2 delete "${STANDBY_NAME}" >/dev/null 2>&1 || true
    # A failed release's build is never served. Leaving it behind grows the next
    # build's type-check set and disk use on every retry.
    if [ -n "${new_dist_dir}" ] && [ "${new_dist_dir}" != "${active_dist_dir}" ]; then
      remove_versioned_build_dir "${new_dist_dir}" || true
    fi
  fi
  rm -rf "${STAGING_DIR}"
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

zero_downtime=1
if ! nginx_has_standby_upstream; then
  zero_downtime=0
  echo "WARNING: nginx has no backup upstream on 127.0.0.1:${STANDBY_PORT};" >&2
  echo "         the web restart will cause a few seconds of 502s." >&2
fi

# ─── Disk: a build is ~850 MB, a staged dependency install ~1.5 GB ─────────
rm -rf "${STAGING_DIR}"
prune_build_dirs "${active_dist_dir}"
if [ "$(free_disk_mb)" -lt "${MIN_FREE_MB}" ]; then
  echo "ERROR: only $(free_disk_mb) MB free; at least ${MIN_FREE_MB} MB is required" >&2
  exit 1
fi

# ─── Source ─────────────────────────────────────────────────────────────────
# Uncommitted edits on the server are kept; the pull fails (before anything
# live is touched) only if incoming commits conflict with them.
if [ "${DEPLOY_SKIP_PULL:-0}" != "1" ] && git rev-parse --abbrev-ref '@{u}' >/dev/null 2>&1; then
  echo "==> Pulling fast-forward-only source"
  git pull --ff-only
fi

# next.config.mjs uses this to version asset requests for the release being
# built. It deliberately comes from the pulled commit, not the pre-pull state.
export VIGENT_DEPLOYMENT_ID="$(git rev-parse --verify HEAD)"
# A commit may be deployed more than once. Always use a unique artifact path
# so a retry can never delete the currently active rollback build.
export VIGENT_NEXT_DIST_DIR=".next-builds/${VIGENT_DEPLOYMENT_ID}-$(date +%s)-$$"
validate_dist_dir "${VIGENT_NEXT_DIST_DIR}"
new_dist_dir="${VIGENT_NEXT_DIST_DIR}"

# PM2 restart/startOrRestart does not replace pm_exec_path for an existing app.
# Detect a required command migration before dependencies change.
recreate_pm2_apps=0
if ! pm2_scripts_match_ecosystem; then
  recreate_pm2_apps=1
fi
if pm2_apps_have_insecure_tls_override; then
  echo "==> Removing stale insecure TLS override from PM2 services"
  recreate_pm2_apps=1
fi

# ─── Dependencies (without stopping anything) ───────────────────────────────
# The running server imports from node_modules, so it is never replaced in
# place: a changed lockfile is installed into a staging directory and swapped
# in with an atomic rename. An unchanged lockfile skips npm entirely.
lock_sha="$(file_sha package-lock.json)"
installed_lock_sha="$(cat "${STATE_DIR}/package-lock.sha256" 2>/dev/null || true)"
# First run of this script: trust an install that is newer than the lockfile.
if [ -z "${installed_lock_sha}" ] && [ node_modules/.package-lock.json -nt package-lock.json ]; then
  installed_lock_sha="${lock_sha}"
fi

if [ "${lock_sha}" != "${installed_lock_sha}" ] || [ ! -d node_modules ]; then
  echo "==> Installing locked dependencies into a staging directory"
  mkdir -p "${STAGING_DIR}"
  cp package.json package-lock.json "${STAGING_DIR}/"
  [ -f .npmrc ] && cp .npmrc "${STAGING_DIR}/"
  cp -r prisma "${STAGING_DIR}/prisma"
  (cd "${STAGING_DIR}" && npm ci && npx prisma generate)

  echo "==> Swapping in the new dependencies"
  if [ -d node_modules ]; then
    mv node_modules "${STAGING_DIR}/node_modules.prev"
  fi
  node_modules_swapped=1
  mv "${STAGING_DIR}/node_modules" node_modules
elif ! cmp -s prisma/schema.prisma node_modules/.prisma/client/schema.prisma; then
  echo "==> Generating Prisma client"
  npx prisma generate
else
  echo "==> Dependencies and Prisma client are up to date"
fi

echo "==> Validating launch-critical production configuration"
npm run check:production-env

# Never pass this process-wide TLS escape hatch to builds or PM2 children.
# The validation above deliberately runs first so an explicit unsafe setting
# in the shell or .env fails closed instead of being silently ignored.
unset NODE_TLS_REJECT_UNAUTHORIZED

# ─── Build (the live server keeps serving its own artifact) ─────────────────
remove_versioned_build_dir "${VIGENT_NEXT_DIST_DIR}"
mkdir -p .next-builds
echo "==> Building production artifact into ${VIGENT_NEXT_DIST_DIR}"
npm run build

if [ -d "${active_dist_dir}/static" ]; then
  echo "==> Retaining previous release chunks for open browser tabs"
  mkdir -p "${VIGENT_NEXT_DIST_DIR}/static"
  cp -an "${active_dist_dir}/static/." "${VIGENT_NEXT_DIST_DIR}/static/"
  find "${VIGENT_NEXT_DIST_DIR}/static" -type f -mmin +1440 -delete
  find "${VIGENT_NEXT_DIST_DIR}/static" -depth -type d -empty -delete
fi

# ─── Database migrations (only when some are pending) ──────────────────────
# A migration must never be the first operation that touches production data.
# Keep this fail-closed: if pg_dump cannot produce a restorable snapshot, the
# deployment stops before Prisma changes the schema.
if npx prisma migrate status >/dev/null 2>&1; then
  echo "==> No pending database migrations"
else
  echo "==> Creating pre-migration database backup"
  bash deploy/backup.sh
  echo "==> Applying checked-in database migrations"
  npx prisma migrate deploy
fi

# ─── Switch the web process without downtime ────────────────────────────────
next_bin="$(node -e 'process.stdout.write(require.resolve("next/dist/bin/next"))')"
if [ "${zero_downtime}" -eq 1 ]; then
  echo "==> Starting standby web on :${STANDBY_PORT} with the new build"
  pm2 delete "${STANDBY_NAME}" >/dev/null 2>&1 || true
  NODE_ENV=production pm2 start "${next_bin}" \
    --name "${STANDBY_NAME}" \
    --interpreter "$(command -v node)" \
    --cwd "${APP_ROOT}" \
    --kill-timeout 30000 \
    --no-autorestart \
    -- start -H 127.0.0.1 -p "${STANDBY_PORT}" >/dev/null
  if ! wait_for_http "http://127.0.0.1:${STANDBY_PORT}/api/health" 45; then
    echo "ERROR: standby web did not become healthy; the live site was not touched" >&2
    pm2 logs "${STANDBY_NAME}" --lines 50 --nostream || true
    exit 1
  fi
fi

echo "==> Restarting vignet-web on :3003"
web_switched=1
if [ "${recreate_pm2_apps}" -eq 1 ]; then
  echo "==> Re-registering PM2 web with direct executable"
  stop_service_and_release_port "vignet-web" 3003 "${APP_ROOT}"
  pm2 delete vignet-web >/dev/null 2>&1 || true
  pm2 start deploy/ecosystem.config.js --only vignet-web
else
  pm2 restart deploy/ecosystem.config.js --only vignet-web --update-env
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

if [ "${zero_downtime}" -eq 1 ]; then
  # nginx keeps a failed primary out of rotation for fail_timeout (5s); give it
  # time to return to :3003, then let the standby finish in-flight requests.
  sleep 8
  echo "==> Stopping standby web"
  pm2 delete "${STANDBY_NAME}" >/dev/null 2>&1 || true
fi

# ─── Background services (no customer-facing traffic) ──────────────────────
# The worker drains active jobs (kill_timeout 60s); queued messages wait in
# Redis and are processed as soon as it is back. Studio is admin-only.
echo "==> Restarting worker and Prisma Studio"
if [ "${recreate_pm2_apps}" -eq 1 ]; then
  pm2 delete vignet-worker vignet-studio >/dev/null 2>&1 || true
  stop_service_and_release_port "vignet-studio" 5555 "${APP_ROOT}"
  pm2 start deploy/ecosystem.config.js --only vignet-worker
  pm2 start deploy/ecosystem.config.js --only vignet-studio
else
  pm2 restart deploy/ecosystem.config.js --only vignet-worker --update-env
  pm2 restart deploy/ecosystem.config.js --only vignet-studio --update-env
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
  # The customer-facing release is already live and healthy; do not roll it
  # back over an admin-only tool.
  echo "WARNING: Prisma Studio did not become healthy on loopback port 5555" >&2
  pm2 logs vignet-studio --lines 50 --nostream || true
fi

pm2 save
web_switched=0
node_modules_swapped=0

echo "${lock_sha}" > "${STATE_DIR}/package-lock.sha256"

# Keep the new build plus the previous one for rollback.
prune_build_dirs "${VIGENT_NEXT_DIST_DIR}"

pm2 status
echo "==> Deployment is healthy (${VIGENT_NEXT_DIST_DIR})"
