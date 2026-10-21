import { defineConfig } from 'vitest/config';

/**
 * End-to-end tests run against the built API (`pnpm build` first) with a
 * real PostgreSQL and Redis, configured through DATABASE_URL and REDIS_URL.
 */
export default defineConfig({
  test: {
    include: ['test/**/*.e2e.test.ts'],
    environment: 'node',
    testTimeout: 90_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
