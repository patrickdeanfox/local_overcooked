import { defineConfig, type Plugin } from 'vitest/config';
import { createPlayNotesHandler } from './tools/playnotes-store.mjs';

// Play notes (F8 in the game) POST to /api/playnotes; in development the dev server stores
// them exactly like server.mjs does, in ./playnotes (relative to the project directory).
function playNotesPlugin(): Plugin {
  const handler = createPlayNotesHandler('playnotes');
  return {
    name: 'local-overcooked-playnotes',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        handler(req, res).then((handled) => { if (!handled) next(); }, next);
      });
    },
  };
}

// base './' so the built dist/ works from any static path (server.mjs, subfolders).
export default defineConfig({
  base: './',
  plugins: [playNotesPlugin()],
  server: { host: true, port: 5173 },
  build: { target: 'es2022', sourcemap: true },
  test: { environment: 'node', include: ['tests/**/*.test.ts', 'src/**/*.test.ts'] },
});
