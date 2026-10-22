#!/usr/bin/env bash
# Builds a single-file release of Agula Quiz for the portal's /quiz/ path.
# Run on any computer with Docker (a Mac is fine), from the repository root:
#
#   ./deploy/portal/make-bundle.sh
#
# Result: agula-quiz-<date>.tar.gz with every image inside, so the server needs
# only Docker (no internet, no source code, no build). Copy it to the server and
# follow INSTALL.txt inside (in short: tar xzf …; cd agula-quiz; ./install.sh).
#
# QUIZ_PATH  path on the portal (default /quiz); baked into the web app
# PLATFORM   server CPU (default linux/amd64; use linux/arm64 for ARM servers)
set -euo pipefail

cd "$(dirname "$0")/../.."
QUIZ_PATH="${QUIZ_PATH:-/quiz}"
PLATFORM="${PLATFORM:-linux/amd64}"
VERSION="$(date +%Y%m%d)-$(git rev-parse --short HEAD 2>/dev/null || echo local)"
OUT="agula-quiz-${VERSION}.tar.gz"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
DIR="$STAGE/agula-quiz"

echo "▶ Building Agula Quiz ${VERSION} for ${PLATFORM}, path ${QUIZ_PATH}/"
docker buildx build --platform "$PLATFORM" --load -f apps/api/Dockerfile -t "agula-quiz-api:${VERSION}" .
docker buildx build --platform "$PLATFORM" --load -f apps/web/Dockerfile \
  --build-arg "VITE_BASE_PATH=${QUIZ_PATH}/" --build-arg "VITE_API_URL=${QUIZ_PATH}" \
  -t "agula-quiz-web:${VERSION}" .
for image in postgres:16-alpine redis:7-alpine caddy:2-alpine; do
  docker pull --platform "$PLATFORM" "$image"
done

echo "▶ Packing"
mkdir -p "$DIR/deploy/portal"
cp deploy/backup.sh "$DIR/deploy/"
cp deploy/portal/docker-compose.portal.yml deploy/portal/Caddyfile deploy/portal/.env.example \
  deploy/portal/README.md deploy/portal/install.sh "$DIR/deploy/portal/"
chmod +x "$DIR/deploy/portal/install.sh"
printf 'QUIZ_VERSION=%s\nQUIZ_PATH=%s\n' "$VERSION" "$QUIZ_PATH" > "$DIR/deploy/portal/release.env"
docker save "agula-quiz-api:${VERSION}" "agula-quiz-web:${VERSION}" postgres:16-alpine redis:7-alpine caddy:2-alpine \
  | gzip > "$DIR/deploy/portal/images.tar.gz"
ln -s deploy/portal/install.sh "$DIR/install.sh"
cat > "$DIR/INSTALL.txt" <<TXT
Agula Quiz ${VERSION} — суулгах заавар

Серверт Docker (docker compose-той) суусан байх ёстой. Өөр юу ч хэрэггүй.

1. Энэ файлыг серверт хуулна:   scp ${OUT} user@server:~
2. Серверт задална:             tar xzf ${OUT} && cd agula-quiz
3. Суулгана:                    ./install.sh
   Порталын хаяг, админ имэйлийг асууна. Нууц үгүүдийг өөрөө үүсгэнэ.
4. Порталын nginx-д ганц дүрэм нэмнэ (install.sh дуусахдаа яг хуулах мөрүүдийг харуулна).

Шинэ хувилбар суулгахдаа 1–3-ыг давтана: өгөгдөл, тохиргоо хадгалагдана.
Дэлгэрэнгүй: deploy/portal/README.md
TXT
tar -C "$STAGE" -czf "$OUT" agula-quiz
echo "✔ ${OUT} ($(du -h "$OUT" | cut -f1)) is ready. Copy it to the server; see INSTALL.txt inside."
