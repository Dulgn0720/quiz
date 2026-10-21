# Quiz Pro

A real-time multiplayer quiz platform in the style of Kahoot / Quizizz. See [`docs/spec.md`](docs/spec.md) for the full product spec and roadmap.

**Status:** phases 1–3 are done: monorepo, database schema, shared types, quiz builder with import/export and sample quizzes, and the real-time game engine (rooms, lobby, join by link/PIN/QR, gameplay, scoring, leaderboards, podium). UI polish, sounds and dark mode (phase 4) are next.

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

Server → client: `room:state` (room settings and player list), `game:phase` (what this client should show now, personalized: shuffled options, your answer, your result and rank), `game:answer-count`, `room:kicked` and `room:closed`.

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

Request bodies are validated with the zod schemas from `@quiz/shared`; validation errors return `400` with an `issues` array (`path`, `message`, and `row` for CSV imports).
