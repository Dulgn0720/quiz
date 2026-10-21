# Quiz Pro

A real-time multiplayer quiz platform in the style of Kahoot / Quizizz. See [`docs/spec.md`](docs/spec.md) for the full product spec and roadmap.

**Status:** all six phases of the spec are implemented:

1. pnpm monorepo, docker-compose, PostgreSQL schema (Prisma), shared types
2. Quiz builder: rounds, six question types, images, JSON/CSV import/export, sample quizzes
3. Real-time engine: rooms, lobby, join by link/PIN/QR, server-authoritative gameplay and scoring, leaderboards, podium
4. UI polish: dark mode, sound effects and music, confetti, transitions, Mongolian/English
5. Optional accounts, XP and levels, badges, game history, public room browser
6. Unit tests, end-to-end tests against a real database, and CI

## Repository layout

```
apps/
  api/        NestJS REST API (Prisma + PostgreSQL, Redis)
  web/        Vue 3 + Vite + Tailwind + Pinia web app (Mongolian / English)
  solo/       Standalone single-player quiz, plain HTML/JS with no build step (see apps/solo/README.md)
packages/
  shared/     TypeScript types, zod validation schemas and import/export logic used by both apps
docs/         Product spec
```

## Quick start (Docker)

```bash
docker compose up --build
```

- Web app: http://localhost:5173
- API: http://localhost:3000/api (health check: `/api/health`)

On start the API applies database migrations and seeds the sample quizzes.

## Local development

Requirements: Node.js 20+ and pnpm 10 (`corepack enable`).

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# Databases only
docker compose up -d postgres redis

pnpm db:migrate   # apply migrations (prisma migrate dev)
pnpm db:seed      # load the sample quizzes
pnpm dev          # shared (watch) + API on :3000 + web on :5173
```

Useful scripts (from the repo root):

| Script            | What it does                                     |
| ----------------- | ------------------------------------------------ |
| `pnpm dev`        | Run shared, API and web in watch mode            |
| `pnpm build`      | Build all packages                               |
| `pnpm test`       | Run all unit tests (vitest)                      |
| `pnpm --filter @quiz/api test:e2e` | End-to-end tests (see [Testing](#testing)) |
| `pnpm typecheck`  | Type-check every package                         |
| `pnpm db:migrate` | Create/apply Prisma migrations                   |
| `pnpm db:seed`    | Insert or refresh the sample quizzes             |
| `pnpm db:studio`  | Open Prisma Studio                               |

## Quiz builder

- A **quiz** has 1–20 **rounds**; each round has its own name, type (normal, speed, double points, elimination), time per question, points multiplier and shuffle options.
- Question types: single choice, multiple choice, true/false, type-the-answer, ordering and image questions. Every question can have an image; choice answers can have images too.
- Images are uploaded to the API (`POST /api/media/images`, PNG/JPEG/WebP/GIF up to 5 MB, verified by file signature) and served from `/uploads`.
- Sample quizzes are read-only; duplicate one to edit it.

### Import / export

- **JSON** (lossless): `{ "format": "quiz-pro", "version": 1, "quiz": { ... } }`. A bare quiz object is accepted as well.
- **CSV**: one question per row. Consecutive rows with the same `round` form a round, whose settings come from its first row. Columns:

  `round, round_type, time_per_question, points_multiplier, shuffle_questions, shuffle_answers, type, prompt, image_url, time_limit, base_points, option_1 … option_6, correct, case_sensitive, explanation`

  Only `type` and `prompt` are required. `correct` holds 1-based option numbers or letters separated by `|` (`1|3`, `A|C`) for choice questions, `true`/`false` for true/false, and accepted answers separated by `|` for type-the-answer. For ordering questions, list the options in the correct order and leave `correct` empty. Option images are not supported in CSV. The import dialog has a downloadable template.

## Environment variables (API)

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | — | PostgreSQL connection string |
| `REDIS_URL` | `redis://localhost:6379` | Live game snapshots, join rate limits, Socket.IO pub/sub |
| `API_PORT` | `3000` | HTTP and Socket.IO port |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated origins of the web app |
| `JWT_SECRET` | dev value | Signs login tokens; **required in production** (32+ characters) |
| `TRUST_PROXY` | `false` | Use `X-Forwarded-For` behind a reverse proxy |
| `UPLOAD_DIR`, `PUBLIC_API_URL` | `./uploads`, `http://localhost:3000` | Uploaded images |

## Live games

1. In **Quizzes**, press **Host** on a quiz, choose private/public and whether answers are shuffled per player, and create the room. The host screen (meant for a projector) shows the 6-digit PIN, the invite link and a QR code.
2. Players open the link (`/join/<PIN>`), or go to **Join game** and type the PIN, then pick a nickname and an emoji avatar. No account needed.
3. In the lobby the host sees players arrive, can remove (kick) them and lock the room. **Start game** runs the quiz: a "get ready" countdown, the question, the reveal with the answer distribution, the leaderboard, and a summary after each round. The podium and full results come at the end.
4. During a question the host can **pause**, **skip** (voids the question, nobody scores) or **end** the game. <kbd>Space</kbd>/<kbd>→</kbd> advances and <kbd>P</kbd> pauses on the host screen.

A refreshed or disconnected phone rejoins automatically with its score intact (the browser keeps a reconnect token per room). The host screen can also be reopened from the same browser.

### Rules

- The server is authoritative. It runs the timers, measures response times on its own clock (time spent paused excluded), accepts one answer per player per question, and never sends correct answers before the reveal. Answers get a 500 ms grace period after the deadline for network latency.
- **Scoring** (`packages/shared/src/scoring.ts`): `scaled = base points × round multiplier (× 2 in a double-points round)`. A correct answer earns `scaled + speed bonus + streak bonus`. The speed bonus is up to 50 % of `scaled`, in proportion to the time left. The streak bonus is +10 % per consecutive correct answer after the first, capped at +50 %. Wrong or missing answers score 0 and reset the streak. Multiple choice and ordering are all-or-nothing. Typed answers ignore case (unless the question is case sensitive), surrounding punctuation and extra spaces.
- **Round types:** *speed* halves the time per question (minimum 5 s) and doubles the speed bonus. *Double points* doubles everything. *Elimination* knocks out players who answer wrong or not at all for the rest of that round; if everyone is out, the round ends early.
- **Shuffling** is seeded, so a game restored after a restart shows the same order. With *shuffle questions* on, the round's question order is shuffled once per game, the same for everyone, because everyone plays the same question at the same time. With *shuffle answers* on, each player gets their own answer order (or one shared order if the host turns per-player shuffle off). Ordering items are always shuffled, and never arrive in the correct order.
- The question closes early once every connected player still in the round has answered.

### How it works

- `apps/api/src/game/engine/` holds the game state machine. It is pure TypeScript with no framework, and gets time, timers and output injected, so `game-engine.test.ts` plays whole games on a fake clock.
- `GamesService` keeps the live games of the API process in memory. It writes a JSON snapshot of each game to Redis after every change (debounced) and restores them on boot, so restarting the API does not end running games. Results (players, ranks, every answer) go to PostgreSQL (`Game`, `GamePlayer`, `GameAnswer`) when a game finishes.
- `GameGateway` is the Socket.IO endpoint (`/socket.io` on the API port). Joins are rate-limited per client address in Redis (20 per minute). Set `TRUST_PROXY=true` behind a reverse proxy so the limit uses `X-Forwarded-For`. All payloads are validated with the zod schemas in `packages/shared/src/game.ts`.
- Socket.IO uses the Redis adapter, so broadcasts can reach clients on any instance. Each game's engine still runs inside a single API process, so run one API instance (or route every connection for a PIN to the same instance) until ownership handoff exists.

### Socket events

Client → server (each takes an acknowledgement callback returning `{ ok: true }` or `{ ok: false, error }`):

| Event           | Payload                                       | Who    |
| --------------- | --------------------------------------------- | ------ |
| `clock:sync`    | — (acks the server time in epoch ms)          | anyone |
| `host:join`     | `{ pin, hostToken }`                          | host   |
| `room:join`     | `{ pin, nickname, avatar?, reconnectToken? }` | player |
| `room:leave`    | —                                             | player |
| `player:answer` | `{ questionIndex, answer }`                   | player |
| `host:kick` · `host:lock` · `host:pause` | `{ playerId }` · `{ locked }` · `{ paused }` | host |
| `host:start` · `host:next` · `host:skip` · `host:end` | — | host |

Server → client: `room:state` (room settings and player list), `game:phase` (what this client should show now, personalized: shuffled options, your answer, your result and rank), `game:answer-count`, `room:kicked`, `room:closed`, and `player:progress` (XP, level and new badges, for signed-in players after the game).

## Look and feel

- **Dark mode:** the 🖥️/☀️/🌙 button cycles between following the system, light and dark. The choice is applied before the first paint, so the page does not flash.
- **Sound:** effects (countdown, last-seconds ticks, answer, correct/wrong, reveal, fanfare) and background music on the host screen are synthesized with the Web Audio API, so there are no audio files. 🔊 toggles effects and 🎵 toggles music; both settings are remembered.
- **Motion:** confetti for correct answers and the podium, animated leaderboard overtakes, page and phase transitions. Everything respects `prefers-reduced-motion`.
- **Languages:** Mongolian (default) and English everywhere, switchable in the header.

## Accounts and progression

Accounts are optional. Guests can create, host and play everything. Signing up (email and password) adds:

- **XP and levels:** each finished game gives 25 XP, plus 10 per correct answer, 1 per 200 points, and 100/60/30 for 1st/2nd/3rd place when at least two people played. Level *n* needs `50·n·(n−1)` XP in total (100, 300, 600, 1000…).
- **Badges:** first game, 10 and 50 games, a win, a podium finish, a perfect game, 5 and 10 answer streaks, a fast average, first quiz created, first game hosted, levels 5 and 10. The rules are in `packages/shared/src/progression.ts`.
- **History:** every game played, with rank, score, correct answers and XP. The profile page (`/me`) shows level progress, badges, stats and history.
- **Ownership:** quizzes created while signed in belong to the account. Only the owner can edit or delete them; anyone can play or duplicate them. Quizzes made as a guest stay editable by anyone.
- **Same seat on any device:** a signed-in player who opens the game on another device gets their seat back.

Passwords are hashed with scrypt; logins return an HS256 token (30 days) sent as `Authorization: Bearer …` and in the Socket.IO handshake (`auth.token`). Set `JWT_SECRET` (32+ characters) in production; the API refuses to start without it there.

**Open rooms** (`/rooms`) lists public games still in the lobby and refreshes on its own.

## Testing

- `pnpm test` runs the unit tests: quiz validation, CSV/JSON import and export, scoring, seeded shuffling, levels and badges, password hashing and tokens, and the game engine. The engine tests play whole games on a fake clock, covering timing, pause, skip, elimination, kicks, reconnects and restoring from a snapshot.
- `pnpm --filter @quiz/api test:e2e` starts the **built** API (`pnpm build` first) against the PostgreSQL and Redis in `DATABASE_URL` / `REDIS_URL`, with migrations applied. It plays real games over HTTP and Socket.IO: a host and players from lobby to podium, reconnects, kicks, locking, wrong host tokens, accounts, quiz ownership, and XP, badges and history written to the database.
- `.github/workflows/ci.yml` runs install, typecheck, unit tests, build, migrations and the end-to-end tests on every push and pull request.

## REST API

| Method | Path                               | Description                              |
| ------ | ---------------------------------- | ---------------------------------------- |
| GET    | `/api/health`                      | Database and Redis status                |
| GET    | `/api/quizzes?search=&page=&pageSize=` | List quiz summaries                  |
| POST   | `/api/quizzes`                     | Create a quiz                            |
| GET    | `/api/quizzes/:id`                 | Get a quiz with rounds and questions     |
| PUT    | `/api/quizzes/:id`                 | Replace a quiz's content                 |
| DELETE | `/api/quizzes/:id`                 | Delete a quiz                            |
| POST   | `/api/quizzes/:id/duplicate`       | Copy a quiz                              |
| GET    | `/api/quizzes/:id/export?format=json\|csv` | Download a quiz                  |
| POST   | `/api/quizzes/import`              | `{ format, content, title? }` → new quiz |
| POST   | `/api/media/images`                | Multipart `file` → `{ url }`             |
| POST   | `/api/games`                       | `{ quizId, visibility?, perPlayerShuffle? }` → `{ gameId, pin, hostToken }` |
| GET    | `/api/games/public`                | Open public rooms waiting in the lobby   |
| GET    | `/api/games/:pin`                  | Room info for the join page (title, status, locked, player count) |
| POST   | `/api/auth/register`               | `{ email, password, displayName }` → `{ token, user }` |
| POST   | `/api/auth/login`                  | `{ email, password }` → `{ token, user }` |
| GET    | `/api/me`                          | Profile: level progress, badges, stats (signed in) |
| PATCH  | `/api/me`                          | `{ displayName?, avatar? }` |
| GET    | `/api/me/games?page=&pageSize=`    | Your game history                        |

`GET /api/quizzes` also accepts `mine=true` (signed in) to list only your own quizzes.

Request bodies are validated with the zod schemas from `@quiz/shared`; validation errors return `400` with an `issues` array (`path`, `message`, and `row` for CSV imports).
