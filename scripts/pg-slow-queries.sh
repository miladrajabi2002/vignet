#!/usr/bin/env bash
# Vigent — slow-query report from pg_stat_statements.
#
# Run from server (root) via:
#   bash /var/www/vigent.ir/public/vignet/scripts/pg-slow-queries.sh [top_N] [min_calls]
#
# Default: top 20 by total_exec_time, min 5 calls.
# Output: 4 sections — total slowest / highest mean / most rows scanned /
#         highest IO time (waiting on disk).
#
# Notes:
#   - pg_stat_statements normalizes queries (literals replaced with $1, $2 …)
#     so the same query shape from different workspaces is aggregated.
#   - RESET happens at server restart OR by calling:
#       SELECT pg_stat_statements_reset();
#     Run that after a clean baseline so numbers reflect only the window
#     you care about.
#   - "total_exec_time" = wall-clock time the planner+executor spent.
#     "total_plan_time"  is only tracked when track_planning = on (default).
#   - shared_blks_read = pages fetched from disk (cache miss); high +
#     low hit = data not in cache = candidate for an index review.

set -euo pipefail

TOP="${1:-20}"
MIN_CALLS="${2:-5}"
DB="vigent"
USER="vigent"
export PGPASSWORD="${PGPASSWORD:-29f89f5841e55816abc817ece9599d7f}"

run() {
  psql -h 127.0.0.1 -U "$USER" -d "$DB" -P pager=off -c "$1"
}

header() {
  printf '\n══════════════════════════════════════════════════════════════════════\n'
  printf '  %s\n' "$1"
  printf '══════════════════════════════════════════════════════════════════════\n'
}

header "TOP $TOP slowest queries by TOTAL exec time (calls ≥ $MIN_CALLS)"
run "
SELECT
  LEFT(query, 140) AS query,
  calls,
  ROUND(total_exec_time::numeric, 1)  AS total_ms,
  ROUND(mean_exec_time::numeric, 2)   AS mean_ms,
  ROUND(max_exec_time::numeric, 1)     AS max_ms,
  rows,
  ROUND(100.0 * shared_blks_hit / NULLIF(shared_blks_hit + shared_blks_read, 0), 1) AS cache_hit_pct,
  shared_blks_read                     AS disk_reads
FROM pg_stat_statements
WHERE calls >= $MIN_CALLS
  AND query NOT ILIKE '%pg_stat_statements%'
  AND query NOT ILIKE '%pg_stat_activity%'
  AND query NOT ILIKE '%pg_locks%'
ORDER BY total_exec_time DESC
LIMIT $TOP;
"

header "TOP $TOP slowest queries by MEAN exec time (calls ≥ $MIN_CALLS)"
run "
SELECT
  LEFT(query, 140) AS query,
  calls,
  ROUND(mean_exec_time::numeric, 2) AS mean_ms,
  ROUND(max_exec_time::numeric, 1)  AS max_ms,
  rows
FROM pg_stat_statements
WHERE calls >= $MIN_CALLS
  AND query NOT ILIKE '%pg_stat_statements%'
  AND query NOT ILIKE '%pg_stat_activity%'
  AND query NOT ILIKE '%pg_locks%'
ORDER BY mean_exec_time DESC
LIMIT $TOP;
"

header "TOP $TOP queries by DISK READS (cache miss — index candidates)"
run "
SELECT
  LEFT(query, 140) AS query,
  calls,
  shared_blks_read AS disk_reads,
  shared_blks_hit  AS cache_hits,
  ROUND(100.0 * shared_blks_hit / NULLIF(shared_blks_hit + shared_blks_read, 0), 1) AS cache_hit_pct,
  ROUND(total_exec_time::numeric, 1) AS total_ms
FROM pg_stat_statements
WHERE calls >= $MIN_CALLS
  AND shared_blks_read > 0
  AND query NOT ILIKE '%pg_stat_statements%'
  AND query NOT ILIKE '%pg_stat_activity%'
ORDER BY shared_blks_read DESC
LIMIT $TOP;
"

header "TOP $TOP queries by ROWS RETURNED (heavy result sets)"
run "
SELECT
  LEFT(query, 140) AS query,
  calls,
  rows,
  ROUND((rows::numeric / NULLIF(calls, 0))::numeric, 1) AS rows_per_call,
  ROUND(total_exec_time::numeric, 1) AS total_ms
FROM pg_stat_statements
WHERE calls >= $MIN_CALLS
  AND rows > 100
  AND query NOT ILIKE '%pg_stat_statements%'
  AND query NOT ILIKE '%pg_stat_activity%'
ORDER BY rows DESC
LIMIT $TOP;
"

header "Snapshot metadata"
run "
SELECT
  now() AS snapshot_at,
  (SELECT count(*) FROM pg_stat_statements) AS captured_query_shapes,
  (SELECT round(sum(total_exec_time)::numeric, 1) FROM pg_stat_statements) AS total_exec_ms_since_reset;
"
