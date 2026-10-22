#!/usr/bin/env bash
# Installs or updates Agula Quiz on the portal server from a release bundle
# (made by make-bundle.sh). Safe to run again: data and settings are kept.
set -euo pipefail

cd "$(dirname "$(readlink -f "$0")")"
COMPOSE=(docker compose -f docker-compose.portal.yml --env-file .env)

command -v docker >/dev/null || { echo "✘ Docker суугаагүй байна: https://docs.docker.com/engine/install/"; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "✘ 'docker compose' алга. Docker Compose v2 суулгана уу."; exit 1; }

if [ -f images.tar.gz ]; then
  echo "▶ Image-үүдийг ачаалж байна (1–2 минут)…"
  gunzip -c images.tar.gz | docker load
fi

secret() { openssl rand -hex "$1" 2>/dev/null || head -c "$1" /dev/urandom | od -An -tx1 | tr -d ' \n'; }

if [ ! -f .env ]; then
  echo "▶ Анхны тохиргоо"
  read -rp "Порталын хаяг [olula.agula.mn]: " host
  read -rp "Админ имэйл(үүд), таслалаар: " admins
  cp .env.example .env
  sed -i.bak \
    -e "s|^PORTAL_HOST=.*|PORTAL_HOST=${host:-olula.agula.mn}|" \
    -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(secret 24)|" \
    -e "s|^JWT_SECRET=.*|JWT_SECRET=$(secret 32)|" \
    -e "s|^ADMIN_EMAILS=.*|ADMIN_EMAILS=${admins}|" \
    .env && rm -f .env.bak
  chmod 600 .env
  echo "  Тохиргоо .env файлд хадгалагдлаа."
fi

# The bundle's version and path win over older values in .env.
if [ -f release.env ]; then
  while IFS='=' read -r key value; do
    [ -n "$key" ] || continue
    if grep -q "^${key}=" .env; then sed -i.bak "s|^${key}=.*|${key}=${value}|" .env && rm -f .env.bak
    else echo "${key}=${value}" >> .env; fi
  done < release.env
fi

echo "▶ Асааж байна…"
mkdir -p backups
"${COMPOSE[@]}" up -d --no-build --remove-orphans

PORT="$(grep -E '^QUIZ_PORT=' .env | cut -d= -f2)"; PORT="${PORT:-8090}"
QPATH="$(grep -E '^QUIZ_PATH=' .env | cut -d= -f2)"; QPATH="${QPATH:-/quiz}"
HOST="$(grep -E '^PORTAL_HOST=' .env | cut -d= -f2)"
echo -n "▶ Шалгаж байна"
for _ in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1 || wget -qO- "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1; then
    echo " ✔"
    cat <<MSG

✔ Agula Quiz ажиллаж байна: http://127.0.0.1:${PORT}

Сүүлийн алхам — порталын nginx-ийн server { } блок дотор (${HOST}) нэмээд 'nginx -s reload':

    location ${QPATH}/ {
        proxy_pass http://127.0.0.1:${PORT}/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 1h;
        client_max_body_size 10m;
    }

Дараа нь https://${HOST}${QPATH}/ нээж, админ имэйлээрээ бүртгүүлнэ.
Лог:  docker compose -f $(pwd)/docker-compose.portal.yml logs -f api
MSG
    exit 0
  fi
  echo -n "."; sleep 3
done
echo
echo "✘ API 3 минутад асаагүй. Лог: ${COMPOSE[*]} logs api"
exit 1
