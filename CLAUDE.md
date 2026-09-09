# local_overcooked — project rules

Two-player Overcooked clone in the browser. Phaser 3 (menus, HUD, input) + Three.js (the 3D kitchen, on a canvas behind Phaser's transparent one) + Vite + TypeScript. One screen, two gamepads (or keyboard).

## Where to read
- `docs/DESIGN.md` — how the arms fit: data flow, contracts, determinism, the level and asset pipelines, the couplings types do not catch.
- `docs/WORKFLOW.md` — one arm per branch, contracts first, what can run in parallel, merge order, the PR checklist.
- One `CLAUDE.md` per arm, loaded automatically when you edit inside it: `src/sim/`, `src/game/`, `src/input/`, `src/art/`, `src/audio/`, `src/levels/`, `tools/`, `docs/research/`. Each lists its files, boundary, per-frame contract, how-to-add recipes, tests and gotchas.
- `docs/ROADMAP.md` — what comes next, with the files each item touches. `README.md` — what a player sees.

## Commands
- `npm run dev` — Vite dev server with HMR, reachable on the LAN (`--host`).
- `npm run build` — typecheck + production build into `dist/`.
- `npm start` — zero-dependency Node server for `dist/`: http 7777 + https 7778 (self-signed, gamepads need https from other devices; steps to the next free port when busy), prints LAN URLs.
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
- `src/art/**` + `src/audio/**` + `assets/**` + `public/models/**` + `tools/sync-models.mjs`, `tools/export-chef.py`, `tools/make-chef-skins.py` — art + audio agent.
- `src/levels/**` + `tests/levels*` + `docs/LEVEL_*.md` — levels agent.
- `docs/research/**` — research agents.
- `src/main.ts`, `src/config.ts`, `src/log.ts`, `server.mjs`, `package.json`, configs, `tools/` except the three art scripts, `README.md`, `docs/PLAN.md`, `docs/ROADMAP.md`, `docs/DESIGN.md`, `docs/WORKFLOW.md` — integrator only.
- Each arm keeps its own `CLAUDE.md` current when its rules, files or tests change; that file is part of the arm.
- Branch prefix per arm: `sim/`, `game/`, `input/`, `art/`, `audio/`, `levels/`, `tools/`, `research/`, `docs/`. Details in `docs/WORKFLOW.md`.

## Style
- Strict TypeScript, no `any`, no non-null assertions except Phaser field initialisation (`!`).
- File order: constants at top → pure helpers → classes/IO → exports. Section-header comments per block.
- No new npm dependencies. Phaser, Three.js, Vite, TypeScript, Vitest only.
- No console.* outside `src/log.ts`. Use `log.info/warn/error`, gated by `DEBUG` in `src/config.ts`.
- Sim code must be deterministic and JSON-snapshot friendly (no Maps/Sets in SimState, no Date.now()).
- Every tuned number lives in `src/sim/constants.ts` or the level JSON, never inline.

## 3D assets
- Source kits (CC0: Kenney Food Kit, Furniture Kit, Animated Characters; KayKit Restaurant Bits) live in `assets/`. `src/art/models.json` maps a role to one glTF file and its normalisation (scale / fit / height); `src/art/models.ts` is the typed contract.
- `npm run models` copies the referenced files plus their buffers and textures into `public/models/`. Run it after editing the manifest.
- `npm run chef` bakes the Kenney character rig and its idle/run/jump clips into `public/models/chef/chef.glb` (needs Blender; the clip files have a different bind pose, so the script retargets by world-space constraints). `npm run skins` paints the chef skins from a stock Kenney skin (needs Pillow).
- Presentation: `src/game/render/KitchenRenderer.ts` (state → scene) and `src/game/render/three/` (stage/camera/lights, loader, tiles, items, chef rigs, effects). Progress bars, badges and the debug grid stay in Phaser, projected through the 3D camera.

## Playtesting from a session
The claude-in-chrome extension tab stays hidden here (no animation frames), so Phaser never runs in it. Use the headless harness instead: start `npx vite --host --port 5173` in the background, then `node tools/playtest.mjs --url http://localhost:5173/ --out <dir> --file <script>` (commands: goto, wait, tap, hold, holduntil, until, shot, eval, logs, errors). Dev builds expose `window.__oc = { sim, level, scene }` for `eval`/`holduntil` conditions. Read screenshots with the Read tool. Scripted scenarios live in `tools/playtests/`.

## Play notes from the user
The game has an F8 bug/idea reporter (`src/game/playnotes.ts`). Notes land in `playnotes/notes.jsonl` (repo, when run through `npm start` or `npm run dev` here) or `~/.local/share/local-overcooked/playnotes/` (desktop launcher), with screenshots beside them. **At the start of a session run `npm run notes`** and treat every note as the user's play feedback: fix bugs, weigh ideas against `docs/ROADMAP.md`, and tell the user which notes you acted on. The `context` field carries level, seed, preset, players, clock, score, tickets, chef positions and recent events, so a bug can usually be reproduced with the playtest harness on the same seed.

## Level loading
Scenes read levels through `src/game/levelHotReload.ts` (`currentLevels()`, `defaultLevelId()`), never by importing `src/levels` directly, otherwise a JSON edit triggers a full page reload instead of an in-place rebuild.

## Research source
Overcooked wiki: https://overcooked.fandom.com. WebFetch is blocked (402). Use the MediaWiki API with curl and a browser User-Agent:
`curl -s -A "Mozilla/5.0" "https://overcooked.fandom.com/api.php?action=parse&page=1-1%20(Overcooked!)&prop=wikitext|images&format=json"`
Image URLs: `api.php?action=query&titles=File:NAME&prop=imageinfo&iiprop=url&format=json`. Files come back as WebP even with .png names; convert with Pillow (`python3 -c "from PIL import Image; Image.open('x').convert('RGB').save('x.png')"`) before viewing.

## Git
- Work on a feature branch, commit with clear messages, push, open a PR with `gh pr create`. The integrator merges.
- Never push to main. Never force-push. Never commit secrets, `node_modules/`, or `dist/`.
