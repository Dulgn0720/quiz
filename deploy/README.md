# Deploying Agula Quiz

One Linux server (2 vCPU / 2 GB RAM is plenty for company games of 100+ players) with Docker, and one domain name.

## 1. Server and domain

1. Get a server with a public IP (any VPS, or a machine in the office network if the game is only for the office) and install Docker: `curl -fsSL https://get.docker.com | sh`.
2. Point a domain at it, e.g. an `A` record `quiz.agula.mn → <server IP>`.
3. Open ports 80 and 443.

## 2. Configure

```bash
git clone https://github.com/Dulgn0720/quiz.git agula-quiz && cd agula-quiz/deploy
cp .env.example .env
nano .env    # DOMAIN, POSTGRES_PASSWORD, JWT_SECRET, ADMIN_EMAILS
```

Generate the secrets with `openssl rand -hex 24` (password) and `openssl rand -hex 32` (JWT).

## 3. Start

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

The first start builds the images, applies migrations and loads the Agula quizzes. Caddy gets the HTTPS certificate automatically; after a minute `https://<DOMAIN>` is live.

Then register on the site with an email listed in `ADMIN_EMAILS`. With `RESTRICT_QUIZ_EDITING=true` only those accounts can create or change quizzes; everyone can host and play.

## Update

```bash
cd agula-quiz && git pull && cd deploy
docker compose -f docker-compose.prod.yml up -d --build
```

Quizzes in `apps/api/src/database/sample-quizzes.ts` are refreshed on every start; quizzes people created are kept.

## Backups

```bash
# Database dump (run daily, e.g. from cron):
docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U quiz quiz | gzip > backup-$(date +%F).sql.gz
# Restore:
gunzip -c backup-YYYY-MM-DD.sql.gz | docker compose -f docker-compose.prod.yml exec -T postgres psql -U quiz quiz
```

Uploaded images live in the `uploads` volume; back it up with the database if you use images.

## Health and logs

- `https://<DOMAIN>/api/health` returns `{"status":"ok",…}` when the database and Redis are reachable.
- `docker compose -f docker-compose.prod.yml logs -f api`

## Limits

- Run a single `api` container: each live game runs inside one API process.
- Joining is limited only for wrong PINs, so a whole office behind one public IP can join at once.
