#!/usr/bin/env bash
set -euo pipefail

# Remove the legacy always-on, internet-facing Prisma Studio deployment.
if command -v pm2 >/dev/null 2>&1; then
  pm2 delete vignet-studio >/dev/null 2>&1 || true
  pm2 save >/dev/null 2>&1 || true
fi

sudo rm -f /etc/nginx/sites-enabled/vigent-db-studio
sudo rm -f /etc/nginx/sites-available/vigent-db-studio
if command -v nginx >/dev/null 2>&1; then
  sudo nginx -t
  sudo systemctl reload nginx
fi

if command -v ufw >/dev/null 2>&1; then
  sudo ufw --force delete allow 8443/tcp >/dev/null 2>&1 || true
fi

cat <<'EOF'
Prisma Studio public access has been removed.

For temporary access:
  1. On the server:
     npx prisma studio --hostname 127.0.0.1 --port 5555 --browser none
  2. On your computer:
     ssh -N -L 5555:127.0.0.1:5555 USER@SERVER
  3. Open http://127.0.0.1:5555 and stop Studio immediately after use.
EOF
