#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
APP_ROOT="$(pwd -P)"
ENV_FILE="${APP_ROOT}/.env"

if [ ! -f "${ENV_FILE}" ]; then
  echo "ERROR: ${ENV_FILE} is required" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source "${ENV_FILE}"
set +a
STUDIO_PORT="${PRISMA_STUDIO_PORT:-8443}"

domain_from_url() {
  SOURCE_URL="$1" node -e '
    try {
      const url = new URL(process.env.SOURCE_URL || "")
      if (!url.hostname) process.exit(1)
      process.stdout.write(url.hostname)
    } catch { process.exit(1) }
  ' 2>/dev/null || true
}

DOMAIN="${1:-}"
if [ -z "${DOMAIN}" ] && [ -n "${PRISMA_STUDIO_URL:-}" ]; then
  DOMAIN="$(domain_from_url "${PRISMA_STUDIO_URL}")"
fi
if [ -z "${DOMAIN}" ] && [ -n "${NEXT_PUBLIC_APP_URL:-}" ]; then
  DOMAIN="$(domain_from_url "${NEXT_PUBLIC_APP_URL}")"
fi
if [ -z "${DOMAIN}" ] && [ -n "${NEXTAUTH_URL:-}" ]; then
  DOMAIN="$(domain_from_url "${NEXTAUTH_URL}")"
fi

if ! [[ "${DOMAIN}" =~ ^[A-Za-z0-9.-]+$ ]]; then
  echo "ERROR: could not determine a valid site domain." >&2
  echo "Usage: bash deploy/setup-db-studio.sh example.com" >&2
  exit 1
fi
if ! [[ "${STUDIO_PORT}" =~ ^[0-9]+$ ]] || [ "${STUDIO_PORT}" -lt 1 ] || [ "${STUDIO_PORT}" -gt 65535 ]; then
  echo "ERROR: PRISMA_STUDIO_PORT must be a valid TCP port" >&2
  exit 1
fi

if ! command -v nginx >/dev/null 2>&1; then
  echo "ERROR: nginx is required before configuring Prisma Studio" >&2
  exit 1
fi
if ! command -v pm2 >/dev/null 2>&1; then
  echo "ERROR: pm2 is required before configuring Prisma Studio" >&2
  exit 1
fi

TLS_CERT="${PRISMA_STUDIO_TLS_CERT_PATH:-/etc/letsencrypt/live/${DOMAIN}/fullchain.pem}"
TLS_KEY="${PRISMA_STUDIO_TLS_KEY_PATH:-/etc/letsencrypt/live/${DOMAIN}/privkey.pem}"
if ! sudo test -r "${TLS_CERT}" || ! sudo test -r "${TLS_KEY}"; then
  echo "ERROR: TLS certificate files were not found for ${DOMAIN}." >&2
  echo "Expected: ${TLS_CERT} and ${TLS_KEY}" >&2
  echo "Set PRISMA_STUDIO_TLS_CERT_PATH/PRISMA_STUDIO_TLS_KEY_PATH for custom certificates." >&2
  exit 1
fi

NGINX_SITE="/etc/nginx/sites-available/vigent-db-studio"
sudo tee "${NGINX_SITE}" >/dev/null <<EOF
server {
    listen ${STUDIO_PORT} ssl;
    listen [::]:${STUDIO_PORT} ssl;
    server_name ${DOMAIN};

    ssl_certificate ${TLS_CERT};
    ssl_certificate_key ${TLS_KEY};

    location = /_vignet_admin_auth {
        internal;
        proxy_pass http://127.0.0.1:3003/api/admin/studio-auth;
        proxy_pass_request_body off;
        proxy_set_header Content-Length "";
        proxy_set_header Cookie \$http_cookie;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-Proto https;
    }

    location @admin_login {
        return 302 https://\$host/admin/login;
    }

    location / {
        auth_request /_vignet_admin_auth;
        error_page 401 = @admin_login;

        proxy_pass http://127.0.0.1:5555;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;

        add_header Cache-Control "no-store" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-Frame-Options "DENY" always;
        add_header Referrer-Policy "same-origin" always;
        add_header Content-Security-Policy "frame-ancestors 'none'" always;
    }
}
EOF

sudo ln -sfn "${NGINX_SITE}" /etc/nginx/sites-enabled/vigent-db-studio
sudo nginx -t
sudo systemctl reload nginx

if command -v ufw >/dev/null 2>&1; then
  sudo ufw allow "${STUDIO_PORT}/tcp" >/dev/null
fi

STUDIO_URL="https://${DOMAIN}:${STUDIO_PORT}"
ENV_TMP="$(mktemp "${ENV_FILE}.studio.XXXXXX")"
grep -vE '^PRISMA_STUDIO_URL=' "${ENV_FILE}" > "${ENV_TMP}" || true
printf 'PRISMA_STUDIO_URL="%s"\n' "${STUDIO_URL}" >> "${ENV_TMP}"
chmod --reference="${ENV_FILE}" "${ENV_TMP}" 2>/dev/null || chmod 600 "${ENV_TMP}"
mv "${ENV_TMP}" "${ENV_FILE}"
export PRISMA_STUDIO_URL="${STUDIO_URL}"

if [ -f node_modules/prisma/build/index.js ]; then
  if pm2 describe vignet-web >/dev/null 2>&1; then
    pm2 restart vignet-web --update-env
  fi
  pm2 start deploy/ecosystem.config.js --only vignet-studio --update-env
  pm2 save
else
  echo "WARNING: dependencies are not installed yet; deploy.sh will start vignet-studio." >&2
fi

cat <<EOF
Prisma Studio is ready at ${STUDIO_URL}

Access is protected by the existing /admin session. Studio itself only listens
on 127.0.0.1:5555; nginx is the only public entry point.
EOF
