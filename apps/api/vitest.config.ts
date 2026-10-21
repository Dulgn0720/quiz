import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Test against the shared sources so a build of @quiz/shared is not required.
    alias: { '@quiz/shared': resolve(__dirname, '../../packages/shared/src/index.ts') },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
