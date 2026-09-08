import { defineConfig } from 'vitest/config';

// base './' so the built dist/ works from any static path (server.mjs, subfolders).
export default defineConfig({
  base: './',
  server: { host: true, port: 5173 },
  build: { target: 'es2022', sourcemap: true },
  test: { environment: 'node', include: ['tests/**/*.test.ts', 'src/**/*.test.ts'] },
});
