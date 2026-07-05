#!/usr/bin/env bash
# ============================================================================
#  Vignet — راه‌اندازی یک‌بارهٔ دسترسی امن به Prisma Studio از پشت nginx
#  این اسکریپت رمز Basic Auth جدا می‌سازد (کاملاً مستقل از ADMIN_USER/PASS پنل)
#  و اسنیپت nginx لازم را چاپ می‌کند — خودش nginx را ادیت نمی‌کند.
# ============================================================================
set -euo pipefail

HTPASSWD_FILE="/etc/nginx/.htpasswd-studio"
STUDIO_USER="${1:-studio}"

if ! command -v htpasswd >/dev/null 2>&1; then
  echo "==> نصب apache2-utils (برای htpasswd)"
  # apt update ممکن است به‌خاطر مخزن‌های جانبی خراب (PPAها) خطا بدهد؛
  # این خطا را نادیده می‌گیریم چون مخزن اصلی اوبونتو (لازم برای apache2-utils) سالم است.
  sudo apt-get update -y || echo "⚠ بعضی مخزن‌ها به‌روز نشدند (نادیده گرفته شد) — ادامه می‌دهیم"
  sudo apt-get install -y apache2-utils
fi

STUDIO_PASS="$(openssl rand -hex 12)"
sudo htpasswd -bc "${HTPASSWD_FILE}" "${STUDIO_USER}" "${STUDIO_PASS}"

cat <<DONE

============================================================
 ✅ فایل رمز عبور Studio ساخته شد
============================================================
 یوزر : ${STUDIO_USER}
 پسورد: ${STUDIO_PASS}
 (این پسورد جداست از ADMIN_USER/ADMIN_PASS پنل — همین‌جا یادداشتش کن)

 حالا این بلوک را داخل فایل کانفیگ nginx سایت (همان server{} که پورت
 443/80 دامنه vigent.ir را serve می‌کند) اضافه کن، جایی قبل از
 location / {:

    location /db-studio/ {
        auth_basic           "DB Studio";
        auth_basic_user_file ${HTPASSWD_FILE};

        proxy_pass http://127.0.0.1:5555/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }

 بعد از اضافه‌کردن:
    sudo nginx -t && sudo systemctl reload nginx

 سپس پردازش Studio را با pm2 بالا بیاور (اگر قبلاً بالا نیامده):
    pm2 start deploy/ecosystem.config.js --only vignet-studio
    pm2 save

 حالا از داخل پنل ادمین (/admin) روی «دیتابیس (Studio)» بزن — یک تب
 جدید با https://vigent.ir/db-studio/ باز می‌شه و مرورگر پسورد بالا رو
 می‌خواد (جدا از لاگین پنل ادمین).

 نکته امنیتی: پورت 5555 فقط باید از 127.0.0.1 در دسترس باشه. با
 firewall فعلی (ufw) که فقط 22/80/443 باز است، از بیرون قابل دسترسی
 نیست؛ همین را با دستور زیر دوباره چک کن:
    sudo ufw status
============================================================
DONE
