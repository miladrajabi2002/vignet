#!/usr/bin/env bash
# ============================================================================
#  Vignet — آپدیت و ری‌استارت پروژه
#  هر بار که کد جدید push کردی، روی سرور این را اجرا کن.
#  کار می‌کند: git pull → نصب پکیج‌ها → migrate دیتابیس → build → restart
#  + نصب و ری‌استارت whatsapp-bridge (mini-service مستقل روی پورت 3040)
# ============================================================================
set -euo pipefail

# به ریشه‌ی پروژه برو (یک پوشه بالاتر از deploy/)
cd "$(dirname "$0")/.."

echo "==> دریافت آخرین کد"
git pull --ff-only

echo "==> نصب وابستگی‌ها (Next.js app)"
# npm ci سخت‌گیر است و با اختلاف نسخه‌ی npm بین محیط‌ها خطا می‌دهد؛
# اگر لاک‌فایل کامل هم‌خوان نبود، به npm install برمی‌گردیم.
npm ci || {
  echo "⚠ npm ci ناموفق بود (لاک‌فایل ناهمگام) — به npm install برمی‌گردیم"
  npm install
}

echo "==> نصب وابستگی‌ها (whatsapp-bridge mini-service)"
# Bridge یک پروژه‌ی مستقل با package.json خودش است. ترجیح بر bun است (سریع‌تر
# و بی‌مشکل با peer deps) اما npm هم با --legacy-peer-deps کار می‌کند.
# اگر این اولین deploy بعد از اضافه‌شدن bridge است،
# deploy/setup-whatsapp-bridge.sh را یک‌بار جداگانه اجرا کنید تا .env و
# secret ساخته شود.
if [ -f mini-services/whatsapp-bridge/package.json ]; then
  if command -v bun >/dev/null 2>&1; then
    (cd mini-services/whatsapp-bridge && bun install)
  elif command -v npm >/dev/null 2>&1; then
    # --legacy-peer-deps برای جلوگیری از خطای ERESOLVE روی conflictهای
    # peer dependency (Baileys peer deps سخت‌گیرانه هستند).
    (cd mini-services/whatsapp-bridge && npm install --legacy-peer-deps)
  else
    echo "⚠ نه bun و نه npm پیدا نشد — نصب وابستگی‌های bridge رد شد"
    echo "  bridge اجرا نخواهد شد. برای اتصال QR واتساپ ابتدا bun را نصب کنید:"
    echo "    curl -fsSL https://bun.sh/install | bash"
  fi
else
  echo "ℹ پوشه‌ی mini-services/whatsapp-bridge وجود ندارد — bridge رد شد"
fi

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

# Helper reminder اگر bridge هنوز بالا نیامده
if ! pm2 describe vignet-whatsapp-bridge >/dev/null 2>&1; then
  echo ""
  echo "⚠ نکته: سرویس whatsapp-bridge هنوز در pm2 ثبت نشده است."
  echo "  برای اتصال QR واتساپ، یک‌بار اسکریپت setup را اجرا کنید:"
  echo "    bash deploy/setup-whatsapp-bridge.sh"
  echo "  سپس دوباره deploy.sh را اجرا کنید."
fi
