#!/usr/bin/env bash
# ============================================================================
#  Vignet — راه‌اندازی یک‌بارهٔ دسترسی امن به Prisma Studio از پشت nginx
#  این اسکریپت رمز Basic Auth جدا می‌سازد (کاملاً مستقل از ADMIN_USER/PASS پنل)
#  و اسنیپت nginx لازم را چاپ می‌کند — خودش nginx را ادیت نمی‌کند.
#
#  نکته: از یک پورت HTTPS جدا (پیش‌فرض 8443) روی همان دامنه استفاده می‌کنیم،
#  نه یک مسیر فرعی مثل /db-studio/ و نه یک ساب‌دامین جدید. دلیل رد کردن
#  مسیر فرعی: Prisma Studio یک SPA است که آدرس فایل‌های خودش (JS/CSS) را
#  مطلق از ریشه‌ی دامنه می‌خواند؛ پشت یک مسیر فرعی این فایل‌ها ۴۰۴ می‌خورند.
#  با یک پورت جدا روی همان دامنه، هم آن مشکل نیست و هم نیازی به DNS/گواهی
#  SSL جدید نداریم — همان گواهی فعلی دامنه (Let's Encrypt) را دوباره‌استفاده
#  می‌کنیم.
# ============================================================================
set -euo pipefail

HTPASSWD_FILE="/etc/nginx/.htpasswd-studio"
STUDIO_USER="${1:-studio}"
STUDIO_PORT="${2:-8443}"

if ! command -v htpasswd >/dev/null 2>&1; then
  echo "==> نصب apache2-utils (برای htpasswd)"
  sudo apt-get update -y || echo "⚠ بعضی مخزن‌ها به‌روز نشدند (نادیده گرفته شد) — ادامه می‌دهیم"
  sudo apt-get install -y apache2-utils
fi

STUDIO_PASS="$(openssl rand -hex 12)"
sudo htpasswd -bc "${HTPASSWD_FILE}" "${STUDIO_USER}" "${STUDIO_PASS}"

# مسیر گواهی SSL فعلی دامنه را از کانفیگ nginx موجود پیدا می‌کنیم تا دوباره‌ استفاده شود.
CERT_LINE="$(sudo grep -rh 'ssl_certificate ' /etc/nginx/sites-enabled/ 2>/dev/null | grep -v _key | head -1 | xargs)"
KEY_LINE="$(sudo grep -rh 'ssl_certificate_key ' /etc/nginx/sites-enabled/ 2>/dev/null | head -1 | xargs)"

cat <<DONE

============================================================
 ✅ فایل رمز عبور Studio ساخته شد
============================================================
 یوزر : ${STUDIO_USER}
 پسورد: ${STUDIO_PASS}
 (این پسورد جداست از ADMIN_USER/ADMIN_PASS پنل — همین‌جا یادداشتش کن)

 ── قدم ۱: پاک‌کردن پردازش گیرکرده (اگر EADDRINUSE داشتی) ──
    pm2 delete vignet-studio
    sudo lsof -i :5555   # اگر چیزی نشان داد، آن PID را: sudo kill -9 <PID>

 ── قدم ۲: باز کردن پورت در فایروال ─────────────────────────
    sudo ufw allow ${STUDIO_PORT}/tcp

 ── قدم ۳: server block جدید در nginx ───────────────────────
 یک فایل جدید بساز (یا به همون فایل کانفیگ فعلی سایت اضافه کن):

    sudo nano /etc/nginx/sites-available/vignet-studio

 و این را داخلش بریز (مسیر گواهی زیر را از کانفیگ فعلی سایت پیدا کردم؛
 اگر خالی/اشتباه بود، دستی از فایل کانفیگ اصلی vigent.ir کپی کن):

    server {
        listen ${STUDIO_PORT} ssl;
        server_name vigent.ir;

        ${CERT_LINE:-ssl_certificate     /etc/letsencrypt/live/vigent.ir/fullchain.pem;}
        ${KEY_LINE:-ssl_certificate_key /etc/letsencrypt/live/vigent.ir/privkey.pem;}

        auth_basic           "DB Studio";
        auth_basic_user_file ${HTPASSWD_FILE};

        location / {
            proxy_pass http://127.0.0.1:5555;
            proxy_http_version 1.1;
            proxy_set_header Upgrade \$http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
        }
    }

 فعالش کن و nginx را reload کن:
    sudo ln -sf /etc/nginx/sites-available/vignet-studio /etc/nginx/sites-enabled/vignet-studio
    sudo nginx -t && sudo systemctl reload nginx

 ── قدم ۴: پردازش Studio با pm2 ────────────────────────────
    pm2 start deploy/ecosystem.config.js --only vignet-studio
    pm2 save

 ── نتیجه ───────────────────────────────────────────────────
 آدرس نهایی: https://vigent.ir:${STUDIO_PORT}
 در .env این را ست کن تا لینک پنل ادمین درست باشد:
    NEXT_PUBLIC_DB_STUDIO_URL="https://vigent.ir:${STUDIO_PORT}"
 و بعد از تغییر .env: npm run build && pm2 reload vignet-web

 نکته امنیتی: پورت 5555 (خود Studio) فقط باید از 127.0.0.1 در دسترس
 باشد — همان‌طور که هست، الان فقط ${STUDIO_PORT} در فایروال باز می‌شود.
============================================================
DONE
