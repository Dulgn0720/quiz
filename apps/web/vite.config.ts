import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Serve from a sub-path (e.g. "/quiz/") when the app lives inside another site such as an employee portal.
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Compile the shared package from source so changes show up without a rebuild.
      '@quiz/shared': fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url)),
    },
  },
  server: { port: 5173, host: true },
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
});
