# local_overcooked — project rules

Two-player Overcooked clone in the browser. Phaser 3 + Vite + TypeScript. One screen, two gamepads (or keyboard).

## Commands
- `npm run dev` — Vite dev server with HMR, reachable on the LAN (`--host`).
- `npm run build` — typecheck + production build into `dist/`.
- `npm start` — zero-dependency Node server for `dist/` on port 8080, prints LAN URLs.
- `npm test` — vitest. `npm run typecheck` — tsc only.

## Contracts (read before writing code)
These files are the shared interface between modules. **Additive changes only** (new optional fields, new union members). Never rename or remove a member; if you must, update every consumer in the same PR and say so in the PR description.
- `src/sim/types.ts` — SimState snapshot, items, chefs, orders, PlayerInput, SimEvent.
- `src/sim/constants.ts` — tuning numbers. `src/sim/recipes.ts` — recipes.
- `src/levels/schema.ts` — LevelDef JSON format, LEGEND, parseGrid, validateLevel. Docs: `docs/LEVEL_SCHEMA.md`.
- `src/art/keys.ts` — texture keys the art module must generate and presentation must use.
- `src/audio/types.ts` — SfxName, AudioBus, sfxForEvent.
- `src/input/types.ts` — InputManager, bindings, GameAction.
- `src/config.ts` — canvas size, TILE, scene keys, storage keys. `src/log.ts` — the only logger.

## Ownership (one agent per directory; do not edit another agent's directory)
- `src/sim/**` + `tests/sim*` — simulation agent. Pure TS, no Phaser import, deterministic given inputs + seed.
- `src/game/**` — presentation agent (scenes, renderer, HUD, debug overlay, level hot reload). Except `ControllerScene.ts`.
- `src/game/scenes/ControllerScene.ts` + `src/input/**` — input agent.
- `src/art/**` + `src/audio/**` — art + audio agent.
- `src/levels/**` + `tests/levels*` + `docs/LEVEL_*.md` — levels agent.
- `docs/research/**` — research agents.
- `src/main.ts`, `package.json`, configs, `README.md`, `docs/PLAN.md`, `docs/ROADMAP.md` — integrator only.

## Style
- Strict TypeScript, no `any`, no non-null assertions except Phaser field initialisation (`!`).
- File order: constants at top → pure helpers → classes/IO → exports. Section-header comments per block.
- No new npm dependencies. Phaser, Vite, TypeScript, Vitest only.
- No console.* outside `src/log.ts`. Use `log.info/warn/error`, gated by `DEBUG` in `src/config.ts`.
- Sim code must be deterministic and JSON-snapshot friendly (no Maps/Sets in SimState, no Date.now()).
- Every tuned number lives in `src/sim/constants.ts` or the level JSON, never inline.

## Research source
Overcooked wiki: https://overcooked.fandom.com. WebFetch is blocked (402). Use the MediaWiki API with curl and a browser User-Agent:
`curl -s -A "Mozilla/5.0" "https://overcooked.fandom.com/api.php?action=parse&page=1-1%20(Overcooked!)&prop=wikitext|images&format=json"`
Image URLs: `api.php?action=query&titles=File:NAME&prop=imageinfo&iiprop=url&format=json`. Files come back as WebP even with .png names; convert with Pillow (`python3 -c "from PIL import Image; Image.open('x').convert('RGB').save('x.png')"`) before viewing.

## Git
- Work on a feature branch, commit with clear messages, push, open a PR with `gh pr create`. The integrator merges.
- Never push to main. Never force-push. Never commit secrets, `node_modules/`, or `dist/`.
