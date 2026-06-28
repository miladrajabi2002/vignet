#!/usr/bin/env bash
# ============================================================================
#  Vignet — آپدیت و ری‌استارت پروژه
#  هر بار که کد جدید push کردی، روی سرور این را اجرا کن.
#  کار می‌کند: git pull → نصب پکیج‌ها → migrate دیتابیس → build → restart
# ============================================================================
set -euo pipefail

# به ریشه‌ی پروژه برو (یک پوشه بالاتر از deploy/)
cd "$(dirname "$0")/.."

echo "==> دریافت آخرین کد"
git pull --ff-only

echo "==> نصب وابستگی‌ها"
npm ci

echo "==> اجرای migration دیتابیس"
npx prisma migrate deploy
npx prisma generate

echo "==> ساخت نسخه production"
npm run build

echo "==> ری‌استارت سرویس‌ها"
if pm2 describe vignet-web >/dev/null 2>&1; then
  pm2 reload deploy/ecosystem.config.js   # بدون قطعی (zero-downtime)
else
  pm2 start deploy/ecosystem.config.js    # اولین اجرا
  pm2 save                                # ذخیره برای استارت خودکار بعد از ریبوت
fi

echo "==> ✅ انجام شد. وضعیت سرویس‌ها:"
pm2 status
