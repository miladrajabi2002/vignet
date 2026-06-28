#!/usr/bin/env bash
# ============================================================================
#  Vignet — نصب خودکار سرور روی Ubuntu 22.04
#  این اسکریپت فقط یک‌بار روی سرور تازه اجرا می‌شود.
#  - مقادیر را به‌صورت تعاملی از تو می‌پرسد
#  - هر سرویس را اول چک می‌کند؛ اگر نصب بود رد می‌شود، اگر نبود نصب می‌کند
#  نصب می‌کند: PostgreSQL 16 + pgvector, Redis, Node.js 20, PM2
# ============================================================================
set -euo pipefail

PG_VERSION="16"
NODE_MAJOR="20"

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

# ─── ابزارهای پایه ──────────────────────────────────────────────────────────
echo "==> بررسی ابزارهای پایه"
sudo apt-get update -y
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
  sudo apt-get update -y
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

# ─── نوشتن خودکار فایل .env ─────────────────────────────────────────────────
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
  cur="$(grep -E "^${key}=" "${ENV_FILE}" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"')"
  if [ -z "${cur}" ]; then
    set_env "${key}" "${gen}"
    echo "→ ${key} ساخته شد"
  else
    echo "→ ${key} از قبل مقدار دارد — دست‌نخورده ماند"
  fi
}

echo "==> نوشتن مقادیر در .env"
DB_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}?schema=public"
set_env "DATABASE_URL" "${DB_URL}"
set_env "DIRECT_URL"   "${DB_URL}"
set_env "REDIS_URL"    "redis://localhost:6379"
set_env "NEXTAUTH_URL"          "${APP_URL}"
set_env "NEXT_PUBLIC_APP_URL"   "${APP_URL}"
set_env "NEXT_PUBLIC_WIDGET_URL" "${APP_URL}"
ensure_secret "NEXTAUTH_SECRET" "$(openssl rand -base64 32)"
ensure_secret "AUTH_SECRET"     "$(openssl rand -base64 32)"
ensure_secret "ENCRYPTION_KEY"  "$(openssl rand -hex 32)"

# ─── نتیجه ──────────────────────────────────────────────────────────────────
cat <<DONE

============================================================
 ✅ نصب و پیکربندی کامل شد
============================================================
 فایل .env به‌صورت خودکار پر شد:
   • DATABASE_URL / DIRECT_URL  → Postgres محلی
   • REDIS_URL                  → Redis محلی
   • NEXTAUTH_URL / APP_URL / WIDGET_URL → ${APP_URL}
   • NEXTAUTH_SECRET / AUTH_SECRET / ENCRYPTION_KEY → ساخته شد

 ⚠ این کلیدها هنوز دستی باید پر شوند (سرویس بیرونی‌اند):
   • SMS_IR_API_KEY / SMS_IR_TEMPLATE_ID   (برای OTP)
   • SUPABASE_URL / SUPABASE_SERVICE_KEY   (برای آپلود فایل)
   • RESEND_API_KEY                        (اختیاری، ایمیل)

 ویرایش:  nano ${ENV_FILE}

 قدم بعد — اولین راه‌اندازی:  bash deploy/deploy.sh
============================================================
DONE
