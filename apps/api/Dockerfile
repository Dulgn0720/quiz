# Build context: repository root (see docker-compose.yml).
FROM node:22-alpine AS base
RUN apk add --no-cache openssl && corepack enable
WORKDIR /app

FROM base AS build
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY pnpm-lock.yaml* ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/api/prisma apps/api/prisma
RUN pnpm install --filter @quiz/api... --frozen-lockfile=false
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @quiz/shared build && pnpm --filter @quiz/api build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app /app
WORKDIR /app/apps/api
EXPOSE 3000
# Apply migrations and refresh the sample quizzes, then start.
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/database/seed.js && node dist/main.js"]
