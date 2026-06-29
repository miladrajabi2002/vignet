#!/usr/bin/env bash
# ============================================================================
#  Vignet — بک‌آپ خودکار دیتابیس
#  - یک دامپ فشرده از PostgreSQL می‌گیرد (pg_dump)
#  - محلی نگه می‌دارد و نسخه‌های قدیمی‌تر از RETENTION_DAYS را پاک می‌کند
#  - اگر MinIO/mc در دسترس باشد، در bucket «backups» هم آپلود می‌کند
#
#  اجرای دستی:   bash deploy/backup.sh
#  زمان‌بندی:    با cron (نصب خودکار در setup-server.sh) هر شب اجرا می‌شود
# ============================================================================
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${PROJECT_DIR}/.env"

BACKUP_DIR="${BACKUP_DIR:-/var/backups/vignet}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
S3_BACKUP_BUCKET="${S3_BACKUP_BUCKET:-backups}"

# ─── خواندن DATABASE_URL از .env ────────────────────────────────────────────
get_env() {
  grep -E "^$1=" "${ENV_FILE}" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"'
}

if [ ! -f "${ENV_FILE}" ]; then
  echo "✗ فایل .env پیدا نشد: ${ENV_FILE}" >&2
  exit 1
fi

DB_URL="$(get_env DATABASE_URL)"
if [ -z "${DB_URL}" ]; then
  echo "✗ DATABASE_URL در .env خالی است" >&2
  exit 1
fi

# ─── ساخت دامپ ──────────────────────────────────────────────────────────────
mkdir -p "${BACKUP_DIR}"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="${BACKUP_DIR}/vignet-${STAMP}.sql.gz"

echo "==> گرفتن بک‌آپ → ${OUT}"
# pg_dump مستقیماً connection string را می‌پذیرد؛ خروجی را gzip می‌کنیم.
if ! pg_dump "${DB_URL}" --no-owner --no-privileges | gzip > "${OUT}"; then
  echo "✗ pg_dump شکست خورد" >&2
  rm -f "${OUT}"
  exit 1
fi

SIZE="$(du -h "${OUT}" | cut -f1)"
echo "==> بک‌آپ ساخته شد (${SIZE})"

# ─── آپلود به MinIO/S3 (اختیاری) ────────────────────────────────────────────
S3_ACCESS_KEY="$(get_env S3_ACCESS_KEY)"
S3_SECRET_KEY="$(get_env S3_SECRET_KEY)"
S3_ENDPOINT="$(get_env S3_ENDPOINT)"
if command -v mc >/dev/null 2>&1 && [ -n "${S3_ENDPOINT}" ] && [ -n "${S3_ACCESS_KEY}" ]; then
  echo "==> آپلود به ذخیره‌سازی شیء (bucket: ${S3_BACKUP_BUCKET})"
  mc alias set vignet-backup "${S3_ENDPOINT}" "${S3_ACCESS_KEY}" "${S3_SECRET_KEY}" >/dev/null 2>&1 || true
  mc mb --ignore-existing "vignet-backup/${S3_BACKUP_BUCKET}" >/dev/null 2>&1 || true
  if mc cp "${OUT}" "vignet-backup/${S3_BACKUP_BUCKET}/" >/dev/null 2>&1; then
    echo "==> آپلود موفق بود"
    # حذف نسخه‌های قدیمی‌تر روی bucket هم (در صورت پشتیبانی)
    mc rm --recursive --force --older-than "${RETENTION_DAYS}d" \
      "vignet-backup/${S3_BACKUP_BUCKET}/" >/dev/null 2>&1 || true
  else
    echo "⚠ آپلود به ذخیره‌سازی شیء ناموفق بود — نسخه محلی نگه داشته شد"
  fi
else
  echo "==> MinIO/mc پیکربندی نشده — فقط بک‌آپ محلی نگه داشته می‌شود"
fi

# ─── چرخش نسخه‌های محلی قدیمی ────────────────────────────────────────────────
echo "==> حذف بک‌آپ‌های قدیمی‌تر از ${RETENTION_DAYS} روز"
find "${BACKUP_DIR}" -name 'vignet-*.sql.gz' -type f -mtime "+${RETENTION_DAYS}" -delete

echo "✅ بک‌آپ کامل شد"
