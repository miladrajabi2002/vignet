#!/usr/bin/env bash
# Vigent — slow-query report from pg_stat_statements.
#
# Run from server (root) via:
#   bash /var/www/vigent.ir/public/vignet/scripts/pg-slow-queries.sh [top_N] [min_calls]
#   bash /var/www/vigent.ir/public/vignet/scripts/pg-slow-queries.sh --query <queryid>
#
# Default: top 20, min 5 calls.
# Output: 4 sections — highest total time / highest mean time / most disk
#         reads / most rows returned — plus the stats window.
#         `--query <queryid>` prints one statement in full, with its numbers.
#
# Notes:
#   - pg_stat_statements normalizes queries (literals replaced with $1, $2 …)
#     so the same query shape from different workspaces is aggregated.
#   - Stats survive a PostgreSQL restart (pg_stat_statements.save = on). They
#     are cleared only by:
#       SELECT pg_stat_statements_reset();
#     Run that for a clean baseline so numbers reflect only the window you
#     care about. The window is printed at the end of the report.
#   - total_exec_time is wall-clock executor time and always includes disk
#     I/O. Planning time is not included (track_planning is off).
#   - bufs_per_call = pages touched per call (cache hits + disk reads). Many
#     pages for few rows is the sign of a missing index. A low cache_hit_pct
#     only says the data was cold — it is not an index signal by itself.
#   - The nightly pg_dump (COPY … TO stdout, catalog lookups) is left out;
#     it is not application traffic.
#   - The connection string comes from .env (DIRECT_URL, then DATABASE_URL),
#     the same way deploy/backup.sh reads it.

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${PROJECT_DIR}/.env"

get_env() {
  grep -E "^$1=" "${ENV_FILE}" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' || true
}

if [ ! -f "${ENV_FILE}" ]; then
  echo "✗ .env not found: ${ENV_FILE}" >&2
  exit 1
fi

RAW_DB_URL="$(get_env DIRECT_URL)"
if [ -z "${RAW_DB_URL}" ]; then
  RAW_DB_URL="$(get_env DATABASE_URL)"
fi
if [ -z "${RAW_DB_URL}" ]; then
  echo "✗ DIRECT_URL and DATABASE_URL are empty in .env" >&2
  exit 1
fi

# Prisma-only query parameters (`schema`, `pgbouncer`) are rejected by libpq.
if ! DB_URL="$(node "${PROJECT_DIR}/deploy/sanitize-postgres-url.mjs" "${RAW_DB_URL}")"; then
  echo "✗ database URL in .env is not valid for psql" >&2
  exit 1
fi

run() {
  psql "${DB_URL}" -X -P pager=off -c "$1"
}

header() {
  printf '\n══════════════════════════════════════════════════════════════════════\n'
  printf '  %s\n' "$1"
  printf '══════════════════════════════════════════════════════════════════════\n'
}

if [ "${1:-}" = "--query" ]; then
  QUERY_ID="${2:-}"
  if ! [[ "${QUERY_ID}" =~ ^-?[0-9]+$ ]]; then
    echo "usage: $0 --query <queryid>" >&2
    exit 1
  fi
  psql "${DB_URL}" -X -P pager=off -x -c "
SELECT
  queryid,
  calls,
  ROUND(total_exec_time::numeric, 1) AS total_ms,
  ROUND(mean_exec_time::numeric, 2)  AS mean_ms,
  ROUND(max_exec_time::numeric, 1)   AS max_ms,
  rows,
  ROUND((shared_blks_hit + shared_blks_read)::numeric / NULLIF(calls, 0)) AS bufs_per_call,
  shared_blks_read AS disk_reads,
  query
FROM pg_stat_statements
WHERE queryid = ${QUERY_ID};
"
  exit 0
fi

TOP="${1:-20}"
MIN_CALLS="${2:-5}"
if ! [[ "${TOP}" =~ ^[0-9]+$ && "${MIN_CALLS}" =~ ^[0-9]+$ ]]; then
  echo "usage: $0 [top_N] [min_calls]" >&2
  exit 1
fi

# One line per statement. Prisma selects all open with the same long column
# list, so it is dropped to let the FROM/WHERE part tell them apart.
SHAPE="LEFT(
    regexp_replace(
      regexp_replace(regexp_replace(query, '\s+', ' ', 'g'), '\"public\"\.', '', 'g'),
      '^SELECT \"[A-Za-z]+?\"\.\".*? FROM ', 'SELECT … FROM '),
    150) AS query"

# Monitoring queries and pg_dump are not application traffic.
APP_ONLY="query !~* '^\s*COPY .* TO stdout'
  AND query !~* '(pg_catalog\.|\mpg_stat_|\mpg_(locks|depend|description|class|attribute|namespace|type|index|constraint|proc|roles|database|extension|settings|inherits|am|attrdef|tables|indexes)\M)'"

header "TOP $TOP queries by TOTAL exec time (calls ≥ $MIN_CALLS)"
run "
SELECT
  queryid,
  $SHAPE,
  calls,
  ROUND(total_exec_time::numeric, 1)  AS total_ms,
  ROUND(mean_exec_time::numeric, 2)   AS mean_ms,
  ROUND(max_exec_time::numeric, 1)    AS max_ms,
  rows,
  ROUND((shared_blks_hit + shared_blks_read)::numeric / NULLIF(calls, 0)) AS bufs_per_call
FROM pg_stat_statements
WHERE calls >= $MIN_CALLS
  AND $APP_ONLY
ORDER BY total_exec_time DESC
LIMIT $TOP;
"

header "TOP $TOP queries by MEAN exec time (calls ≥ $MIN_CALLS)"
run "
SELECT
  queryid,
  $SHAPE,
  calls,
  ROUND(mean_exec_time::numeric, 2) AS mean_ms,
  ROUND(max_exec_time::numeric, 1)  AS max_ms,
  rows,
  ROUND((shared_blks_hit + shared_blks_read)::numeric / NULLIF(calls, 0)) AS bufs_per_call
FROM pg_stat_statements
WHERE calls >= $MIN_CALLS
  AND $APP_ONLY
ORDER BY mean_exec_time DESC
LIMIT $TOP;
"

header "TOP $TOP queries by DISK READS (cold data — pages not in cache)"
run "
SELECT
  queryid,
  $SHAPE,
  calls,
  shared_blks_read AS disk_reads,
  shared_blks_hit  AS cache_hits,
  ROUND(100.0 * shared_blks_hit / NULLIF(shared_blks_hit + shared_blks_read, 0), 1) AS cache_hit_pct,
  ROUND(total_exec_time::numeric, 1) AS total_ms
FROM pg_stat_statements
WHERE calls >= $MIN_CALLS
  AND shared_blks_read > 0
  AND $APP_ONLY
ORDER BY shared_blks_read DESC
LIMIT $TOP;
"

header "TOP $TOP queries by ROWS RETURNED (heavy result sets)"
run "
SELECT
  queryid,
  $SHAPE,
  calls,
  rows,
  ROUND((rows::numeric / NULLIF(calls, 0))::numeric, 1) AS rows_per_call,
  ROUND(total_exec_time::numeric, 1) AS total_ms
FROM pg_stat_statements
WHERE calls >= $MIN_CALLS
  AND rows > 100
  AND $APP_ONLY
ORDER BY rows DESC
LIMIT $TOP;
"

header "Snapshot metadata"
run "
SELECT
  now() AS snapshot_at,
  (SELECT stats_reset FROM pg_stat_statements_info) AS stats_since,
  date_trunc('minute', now() - (SELECT stats_reset FROM pg_stat_statements_info)) AS stats_window,
  (SELECT count(*) FROM pg_stat_statements) AS captured_query_shapes,
  (SELECT round(sum(total_exec_time)::numeric, 1) FROM pg_stat_statements) AS total_exec_ms_since_reset;
"
