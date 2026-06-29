#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/blog/app"
DOMAIN="${DOMAIN:-hechenxu.cn}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-master}"

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

generate_secret() {
  openssl rand -base64 48 | tr -d '=+/' | cut -c1-32
}

if [ ! -f deploy/.env ]; then
  POSTGRES_PASSWORD="$(openssl rand -base64 30 | tr -d '=+/' | cut -c1-24)"
  ADMIN_PASSWORD="$(openssl rand -base64 30 | tr -d '=+/' | cut -c1-18)"
  SETTINGS_SECRET="$(generate_secret)"
  cat > deploy/.env <<EOF
DOMAIN=${DOMAIN}
POSTGRES_USER=blog
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=blog_prod
ADMIN_DEFAULT_PASSWORD=${ADMIN_PASSWORD}
ADMIN_SESSION_DAYS=14
SETTINGS_SECRET=${SETTINGS_SECRET}
AI_WEB_SEARCH_ENABLED=false
EOF
  chmod 600 deploy/.env
  echo "created deploy/.env"
  echo "admin username: admin"
  echo "admin password: ${ADMIN_PASSWORD}"
else
  echo "reuse existing deploy/.env"
  if ! grep -Eq '^SETTINGS_SECRET=.{16,}$' deploy/.env; then
    sed -i '/^SETTINGS_SECRET=/d' deploy/.env
    echo "SETTINGS_SECRET=$(generate_secret)" >> deploy/.env
    echo "added missing SETTINGS_SECRET to deploy/.env"
  fi
fi

if [ -d .git ] && [ "${SKIP_GIT_PULL:-false}" != "true" ]; then
  echo "updating git working tree on branch ${DEPLOY_BRANCH}"
  git fetch origin "${DEPLOY_BRANCH}"
  git checkout "${DEPLOY_BRANCH}"
  git merge --ff-only "origin/${DEPLOY_BRANCH}"
else
  echo "skip git pull because .git is missing or SKIP_GIT_PULL=true"
fi

if [ "${SKIP_FRONTEND_BUILD:-false}" != "true" ]; then
  echo "building frontend dist"
  if command -v npm >/dev/null 2>&1; then
    npm ci
    npm run build
  else
    docker run --rm \
      -v "$APP_DIR:/workspace" \
      -w /workspace \
      docker.m.daocloud.io/library/node:22-alpine \
      sh -lc 'npm ci && npm run build'
  fi
else
  echo "skip frontend build because SKIP_FRONTEND_BUILD=true"
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
