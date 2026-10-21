# Quiz Pro

A real-time multiplayer quiz platform in the style of Kahoot / Quizizz. See [`docs/spec.md`](docs/spec.md) for the full product spec and roadmap.

**Status:** phases 1–2 are done (monorepo, database schema, shared types, quiz builder with import/export and sample quizzes). The real-time game engine (phase 3) is next.

## Repository layout

```
apps/
  api/        NestJS REST API (Prisma + PostgreSQL, Redis)
  web/        Vue 3 + Vite + Tailwind + Pinia web app (Mongolian / English)
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

Request bodies are validated with the zod schemas from `@quiz/shared`; validation errors return `400` with an `issues` array (`path`, `message`, and `row` for CSV imports).
