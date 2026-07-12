#!/usr/bin/env bash
# راه‌اندازی دمو ویجنت
# این اسکریپت PostgreSQL را راه‌اندازی می‌کند، دیتابیس را می‌سازد،
# اسکیمای پرisma را push می‌کند، و دیتای دمو را seed می‌کند.
#
# استفاده: bash scripts/start-demo.sh
#
# بعد از اجرا:
# - سایت روی http://localhost:3000
# - ورود دمو: شماره 09120000000، کد 123456 (یا کلیک روی دکمه «ورود دمو»)

set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PG_DIR="${PG_DIR:-$HOME/pg}"

cd "$PROJECT_DIR"

# ─── ۱. PostgreSQL را راه‌اندازی کن (اگر از قبل نصب شده، رد شو) ───
if ! command -v psql &>/dev/null && [ ! -f "$PG_DIR/root/usr/lib/postgresql/17/bin/psql" ]; then
    echo "📦 دانلود PostgreSQL..."
    mkdir -p "$PG_DIR" && cd "$PG_DIR"
    # دانلود deb package‌ها بدون نیاز به root
    apt-get download postgresql-17 postgresql-17-pgvector postgresql-client-17 2>/dev/null || true
    for deb in *.deb; do dpkg-deb -x "$deb" root/ 2>/dev/null || true; done
    cd "$PROJECT_DIR"
fi

PG_BIN="$PG_DIR/root/usr/lib/postgresql/17/bin"
export LD_LIBRARY_PATH="$PG_DIR/root/usr/lib/postgresql/17/lib:${LD_LIBRARY_PATH:-}"
export PGHOST="$PG_DIR"

# ─── ۲. initdb (فقط بار اول) ───
if [ ! -f "$PG_DIR/data/PG_VERSION" ]; then
    echo "🔧 راه‌اندازی دیتابیس..."
    "$PG_BIN/initdb" -D "$PG_DIR/data" -U postgres --auth=trust --encoding=UTF8
    echo "unix_socket_directories = '$PG_DIR'" >> "$PG_DIR/data/postgresql.conf"
    echo "dynamic_library_path = '$PG_DIR/root/usr/lib/postgresql/17/lib'" >> "$PG_DIR/data/postgresql.conf"
fi

# ─── ۳. استارت سرور PostgreSQL ───
if ! "$PG_BIN/pg_ctl" -D "$PG_DIR/data" status &>/dev/null; then
    echo "🚀 استارت PostgreSQL..."
    "$PG_BIN/pg_ctl" -D "$PG_DIR/data" -l "$PG_DIR/pg.log" start
    sleep 2
fi

# ─── ۴. ساخت دیتابیس + pgvector ───
"$PG_BIN/psql" -U postgres -lqt 2>/dev/null | cut -d'|' -f1 | grep -qw vigent || {
    echo "🏗️ ساخت دیتابیس vigent..."
    "$PG_BIN/createdb" -U postgres vigent
    "$PG_BIN/psql" -U postgres -d vigent -c "CREATE EXTENSION IF NOT EXISTS vector;"
}

# ─── ۵. Prisma schema push ───
echo "📊 همگام‌سازی schema..."
DATABASE_URL="postgresql://postgres@localhost:5432/vigent?schema=public" \
DIRECT_URL="postgresql://postgres@localhost:5432/vigent?schema=public" \
PGHOST="$PG_DIR" \
bun run db:push --accept-data-loss 2>/dev/null || \
DATABASE_URL="postgresql://postgres@localhost:5432/vigent?schema=public" \
DIRECT_URL="postgresql://postgres@localhost:5432/vigent?schema=public" \
PGHOST="$PG_DIR" \
bun run db:push

# ─── ۶. Seed دیتای دمو ───
echo "🌱 ساخت دیتای دمو..."
DATABASE_URL="postgresql://postgres@localhost:5432/vigent?schema=public" \
DIRECT_URL="postgresql://postgres@localhost:5432/vigent?schema=public" \
PGHOST="$PG_DIR" \
bun run tsx scripts/seed-demo.ts

# ─── ۷. استارت dev server ───
echo ""
echo "✅ دمو آماده است!"
echo "   سایت: http://localhost:3000"
echo "   ورود دمو: 09120000000 / کد 123456"
echo "   یا کلیک روی دکمه «ورود دمو (بدون نیاز به کد)»"
echo ""
echo "🛑 برای توقف: Ctrl+C"
echo ""

export DATABASE_URL="postgresql://postgres@localhost:5432/vigent?schema=public"
export DIRECT_URL="postgresql://postgres@localhost:5432/vigent?schema=public"
export PGHOST="$PG_DIR"
exec bun run dev
