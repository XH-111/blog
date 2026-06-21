#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/blog/app"
DOMAIN="${DOMAIN:-hechenxu.cn}"

cd "$APP_DIR"

if ! command -v docker >/dev/null 2>&1; then
  apt-get update
  apt-get install -y ca-certificates curl gnupg lsb-release
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" > /etc/apt/sources.list.d/docker.list
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi

mkdir -p public/uploads deploy

if [ ! -f deploy/.env ]; then
  POSTGRES_PASSWORD="$(openssl rand -base64 30 | tr -d '=+/' | cut -c1-24)"
  ADMIN_PASSWORD="$(openssl rand -base64 30 | tr -d '=+/' | cut -c1-18)"
  cat > deploy/.env <<EOF
DOMAIN=${DOMAIN}
POSTGRES_USER=blog
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=blog_prod
ADMIN_DEFAULT_PASSWORD=${ADMIN_PASSWORD}
ADMIN_SESSION_DAYS=14
AI_WEB_SEARCH_ENABLED=false
EOF
  chmod 600 deploy/.env
  echo "created deploy/.env"
  echo "admin username: admin"
  echo "admin password: ${ADMIN_PASSWORD}"
else
  echo "reuse existing deploy/.env"
fi

if systemctl is-active --quiet nginx 2>/dev/null; then
  systemctl stop nginx
  systemctl disable nginx || true
fi

if systemctl is-active --quiet apache2 2>/dev/null; then
  systemctl stop apache2
  systemctl disable apache2 || true
fi

docker compose -f deploy/docker-compose.prod.yml up -d --build --force-recreate app caddy

if ! docker compose -f deploy/docker-compose.prod.yml exec -T app node backend/scripts/seed.js; then
  echo "seed failed or already partially applied; inspect logs if admin login is unavailable"
fi

if ! docker compose -f deploy/docker-compose.prod.yml exec -T app node backend/scripts/generate-media-variants.js; then
  echo "media variant generation failed; uploaded originals are still available"
fi

docker compose -f deploy/docker-compose.prod.yml ps
