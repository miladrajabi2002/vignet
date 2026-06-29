#!/usr/bin/env bash
# ============================================================================
#  Vignet — نصب خودکار سرور روی Ubuntu 22.04 / 24.04
#  این اسکریپت فقط یک‌بار روی سرور تازه اجرا می‌شود.
#  - مقادیر را به‌صورت تعاملی از تو می‌پرسد
#  - هر سرویس را اول چک می‌کند؛ اگر نصب بود رد می‌شود، اگر نبود نصب می‌کند
#  نصب می‌کند: PostgreSQL 16 + pgvector, Redis, Node.js 20, PM2, MinIO
# ============================================================================
set -euo pipefail

PG_VERSION="16"
NODE_MAJOR="20"

# apt update روی بعضی سرورها به‌خاطر مخزن‌های جانبی خراب (PPAها) خطا می‌دهد.
# این تابع خطای آن مخزن‌ها را نادیده می‌گیرد تا نصب پکیج‌های ما متوقف نشود.
apt_update() {
  if ! sudo apt-get update -y; then
    echo "⚠ بعضی مخزن‌ها به‌روز نشدند (نادیده گرفته شد) — ادامه می‌دهیم"
  fi
}

# ─── گرفتن مقادیر از کاربر ──────────────────────────────────────────────────
echo "============================================================"
echo " تنظیمات دیتابیس — برای استفاده از پیش‌فرض فقط Enter بزن"
echo "============================================================"

read -rp "نام دیتابیس [vigent]: " DB_NAME
DB_NAME="${DB_NAME:-vigent}"

read -rp "نام کاربر دیتابیس [vigent]: " DB_USER
DB_USER="${DB_USER:-vigent}"

read -rsp "رمز دیتابیس (خالی = رمز تصادفی ساخته می‌شود): " DB_PASS
echo
if [ -z "${DB_PASS}" ]; then
  DB_PASS="$(openssl rand -hex 16)"
  echo "→ رمز تصادفی ساخته شد."
fi

read -rp "دامنه‌ی سایت (مثلاً vigent.ir) [vigent.ir]: " DOMAIN
DOMAIN="${DOMAIN:-vigent.ir}"
DOMAIN="${DOMAIN#http://}"; DOMAIN="${DOMAIN#https://}"; DOMAIN="${DOMAIN%/}"  # تمیزکردن
APP_URL="https://${DOMAIN}"

echo
echo "خلاصه:  دیتابیس=${DB_NAME}  کاربر=${DB_USER}  دامنه=${DOMAIN}"
read -rp "ادامه بدهم؟ [Y/n]: " CONFIRM
case "${CONFIRM:-Y}" in
  [nN]*) echo "لغو شد."; exit 1 ;;
esac

# ─── آماده‌سازی فایل .env و توابع کمکی ───────────────────────────────────────
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${PROJECT_DIR}/.env"

# اگر .env نبود، از روی .env.example بساز (تا کلیدهای دیگر هم سرجایشان بمانند)
if [ ! -f "${ENV_FILE}" ]; then
  if [ -f "${PROJECT_DIR}/.env.example" ]; then
    cp "${PROJECT_DIR}/.env.example" "${ENV_FILE}"
    echo "==> .env از روی .env.example ساخته شد"
  else
    touch "${ENV_FILE}"
  fi
fi

# خواندن مقدار فعلی یک کلید از .env (خالی اگر نبود)
get_env() {
  grep -E "^$1=" "${ENV_FILE}" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"'
}

# جایگذاری یک کلید: خط قبلی را حذف و مقدار جدید را اضافه می‌کند (با هر کاراکتری امن است)
set_env() {
  local key="$1" val="$2"
  grep -vE "^${key}=" "${ENV_FILE}" > "${ENV_FILE}.tmp" 2>/dev/null || true
  printf '%s="%s"\n' "${key}" "${val}" >> "${ENV_FILE}.tmp"
  mv "${ENV_FILE}.tmp" "${ENV_FILE}"
}

# راز را فقط در صورتی می‌سازد که از قبل خالی باشد (تا session/کلیدهای رمزشده خراب نشوند)
ensure_secret() {
  local key="$1" gen="$2" cur
  cur="$(get_env "${key}")"
  if [ -z "${cur}" ]; then
    set_env "${key}" "${gen}"
    echo "→ ${key} ساخته شد"
  else
    echo "→ ${key} از قبل مقدار دارد — دست‌نخورده ماند"
  fi
}

# ─── ابزارهای پایه ──────────────────────────────────────────────────────────
echo "==> بررسی ابزارهای پایه"
apt_update
sudo apt-get install -y curl ca-certificates gnupg lsb-release openssl git build-essential

# ─── PostgreSQL 16 + pgvector ───────────────────────────────────────────────
if command -v psql >/dev/null 2>&1 && sudo -u postgres psql -tAc "SHOW server_version;" >/dev/null 2>&1; then
  echo "==> PostgreSQL از قبل نصب است — رد شد"
else
  echo "==> نصب PostgreSQL ${PG_VERSION}"
  sudo install -d /usr/share/postgresql-common/pgdg
  sudo curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
    -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc
  echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] \
https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
    | sudo tee /etc/apt/sources.list.d/pgdg.list >/dev/null
  apt_update
  sudo apt-get install -y "postgresql-${PG_VERSION}"
  sudo systemctl enable --now postgresql
fi

# پکیج pgvector را جدا چک می‌کنیم (ممکن است Postgres باشد ولی pgvector نه)
if dpkg -s "postgresql-${PG_VERSION}-pgvector" >/dev/null 2>&1; then
  echo "==> pgvector از قبل نصب است — رد شد"
else
  echo "==> نصب pgvector"
  sudo apt-get install -y "postgresql-${PG_VERSION}-pgvector"
fi

# ─── ساخت دیتابیس و کاربر (idempotent) ──────────────────────────────────────
echo "==> ساخت/به‌روزرسانی دیتابیس و کاربر"
sudo -u postgres psql <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASS}';
  ELSE
    ALTER ROLE ${DB_USER} WITH PASSWORD '${DB_PASS}';
  END IF;
END \$\$;
SELECT 'CREATE DATABASE ${DB_NAME} OWNER ${DB_USER}'
  WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${DB_NAME}')\gexec
SQL
sudo -u postgres psql -d "${DB_NAME}" -c "CREATE EXTENSION IF NOT EXISTS vector;"
sudo -u postgres psql -d "${DB_NAME}" -c "GRANT ALL ON SCHEMA public TO ${DB_USER};"

# ─── Redis ──────────────────────────────────────────────────────────────────
if command -v redis-server >/dev/null 2>&1; then
  echo "==> Redis از قبل نصب است — رد شد"
else
  echo "==> نصب Redis"
  sudo apt-get install -y redis-server
  sudo systemctl enable --now redis-server
fi

# ─── Node.js 20 ─────────────────────────────────────────────────────────────
if command -v node >/dev/null 2>&1 && [ "$(node -v | cut -d. -f1 | tr -d v)" -ge "${NODE_MAJOR}" ]; then
  echo "==> Node.js $(node -v) از قبل نصب است — رد شد"
else
  echo "==> نصب Node.js ${NODE_MAJOR}"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | sudo -E bash -
  sudo apt-get install -y nodejs
fi

# ─── PM2 ────────────────────────────────────────────────────────────────────
if command -v pm2 >/dev/null 2>&1; then
  echo "==> PM2 از قبل نصب است — رد شد"
else
  echo "==> نصب PM2"
  sudo npm install -g pm2
fi

# ─── MinIO (ذخیره‌سازی فایل، سازگار با S3) ──────────────────────────────────
# کلیدها را از .env فعلی بازاستفاده می‌کنیم تا با سرویس systemd هماهنگ بمانند؛
# اگر نبود، می‌سازیم.
MINIO_USER="$(get_env S3_ACCESS_KEY)"; [ -z "${MINIO_USER}" ] && MINIO_USER="vignet"
MINIO_PASS="$(get_env S3_SECRET_KEY)"; [ -z "${MINIO_PASS}" ] && MINIO_PASS="$(openssl rand -hex 24)"

if [ -x /usr/local/bin/minio ]; then
  echo "==> باینری MinIO از قبل هست — رد شد"
else
  echo "==> دانلود MinIO"
  sudo curl -fsSL https://dl.min.io/server/minio/release/linux-amd64/minio \
    -o /usr/local/bin/minio
  sudo chmod +x /usr/local/bin/minio
fi
if [ -x /usr/local/bin/mc ]; then
  echo "==> کلاینت mc از قبل هست — رد شد"
else
  echo "==> دانلود کلاینت mc"
  sudo curl -fsSL https://dl.min.io/client/mc/release/linux-amd64/mc \
    -o /usr/local/bin/mc
  sudo chmod +x /usr/local/bin/mc
fi

echo "==> پیکربندی سرویس MinIO"
sudo useradd -r -s /sbin/nologin minio-user 2>/dev/null || true
sudo mkdir -p /var/lib/minio
sudo chown -R minio-user:minio-user /var/lib/minio

# روی 127.0.0.1 محدود است (از بیرون در دسترس نیست) — امن
sudo tee /etc/default/minio >/dev/null <<EOF
MINIO_ROOT_USER=${MINIO_USER}
MINIO_ROOT_PASSWORD=${MINIO_PASS}
MINIO_VOLUMES=/var/lib/minio
MINIO_OPTS=--address 127.0.0.1:9000 --console-address 127.0.0.1:9001
EOF

sudo tee /etc/systemd/system/minio.service >/dev/null <<'EOF'
[Unit]
Description=MinIO Object Storage
After=network-online.target
Wants=network-online.target

[Service]
User=minio-user
Group=minio-user
EnvironmentFile=/etc/default/minio
ExecStart=/usr/local/bin/minio server $MINIO_VOLUMES $MINIO_OPTS
Restart=always
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now minio

echo "==> انتظار برای بالا آمدن MinIO و ساخت bucketها"
for _ in $(seq 1 30); do
  curl -fsS http://127.0.0.1:9000/minio/health/live >/dev/null 2>&1 && break
  sleep 1
done
mc alias set vignet-local "http://127.0.0.1:9000" "${MINIO_USER}" "${MINIO_PASS}" >/dev/null
mc mb --ignore-existing vignet-local/knowledge
mc mb --ignore-existing vignet-local/products

# ─── نوشتن خودکار فایل .env ─────────────────────────────────────────────────
echo "==> نوشتن مقادیر در .env"
DB_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}?schema=public"
set_env "DATABASE_URL" "${DB_URL}"
set_env "DIRECT_URL"   "${DB_URL}"
set_env "REDIS_URL"    "redis://localhost:6379"
set_env "NEXTAUTH_URL"          "${APP_URL}"
set_env "NEXT_PUBLIC_APP_URL"   "${APP_URL}"
set_env "NEXT_PUBLIC_WIDGET_URL" "${APP_URL}"
set_env "S3_ENDPOINT"  "http://127.0.0.1:9000"
set_env "S3_ACCESS_KEY" "${MINIO_USER}"
set_env "S3_SECRET_KEY" "${MINIO_PASS}"
set_env "S3_REGION"    "us-east-1"
ensure_secret "NEXTAUTH_SECRET" "$(openssl rand -base64 32)"
ensure_secret "AUTH_SECRET"     "$(openssl rand -base64 32)"
ensure_secret "ENCRYPTION_KEY"  "$(openssl rand -hex 32)"

# اعتبارنامه‌ی داشبورد ادمین (مسیر /admin) — یوزر/پسورد ثابت
ensure_secret "ADMIN_USER" "admin"
ensure_secret "ADMIN_PASS" "$(openssl rand -hex 12)"
ensure_secret "ADMIN_SESSION_SECRET" "$(openssl rand -base64 32)"

# ─── بک‌آپ شبانه‌ی دیتابیس (cron) ────────────────────────────────────────────
echo "==> نصب زمان‌بندی بک‌آپ شبانه"
sudo mkdir -p /var/backups/vignet
sudo chown "$(whoami)":"$(whoami)" /var/backups/vignet 2>/dev/null || true
CRON_LINE="0 3 * * * cd ${PROJECT_DIR} && bash deploy/backup.sh >> /var/log/vignet-backup.log 2>&1"
# خط قبلی بک‌آپ را حذف و دوباره اضافه می‌کنیم (idempotent)
( crontab -l 2>/dev/null | grep -v 'deploy/backup.sh' ; echo "${CRON_LINE}" ) | crontab -
echo "→ هر شب ساعت ۳ بامداد بک‌آپ گرفته می‌شود (لاگ: /var/log/vignet-backup.log)"

# ─── نتیجه ──────────────────────────────────────────────────────────────────
cat <<DONE

============================================================
 ✅ نصب و پیکربندی کامل شد
============================================================
 فایل .env به‌صورت خودکار پر شد:
   • DATABASE_URL / DIRECT_URL  → Postgres محلی
   • REDIS_URL                  → Redis محلی
   • S3_ENDPOINT / S3_ACCESS_KEY / S3_SECRET_KEY → MinIO محلی (bucketها ساخته شد)
   • NEXTAUTH_URL / APP_URL / WIDGET_URL → ${APP_URL}
   • NEXTAUTH_SECRET / AUTH_SECRET / ENCRYPTION_KEY → ساخته شد
   • ADMIN_USER / ADMIN_PASS → اعتبارنامه‌ی داشبورد ادمین (/admin) ساخته شد
   • بک‌آپ شبانه‌ی دیتابیس روی cron نصب شد (هر شب ۳ بامداد)

 ℹ️  یوزر/پسورد ادمین را با این دستور ببین:
     grep -E '^ADMIN_(USER|PASS)=' ${ENV_FILE}

 ⚠ این کلیدها هنوز دستی باید پر شوند (سرویس بیرونی‌اند):
   • SMS_IR_API_KEY / SMS_IR_TEMPLATE_ID   (برای OTP)
   • RESEND_API_KEY                        (اختیاری، ایمیل)

 ویرایش:  nano ${ENV_FILE}

 قدم بعد — اولین راه‌اندازی:  bash deploy/deploy.sh
============================================================
DONE
