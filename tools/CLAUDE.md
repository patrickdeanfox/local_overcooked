# tools — harness, notes, assets, launcher

Zero-dependency Node scripts plus two Python and one Blender script. Nothing here is bundled into the game; `tsconfig.json` does not typecheck this directory (`playnotes-store.d.mts` types the one module Vite imports).

Ownership: `playtest.mjs`, `playtests/`, `playnotes*.mjs`, `make-cert.mjs`, `launch.sh`, `install-launcher.sh`, `make-icon.py` belong to the integrator; `sync-models.mjs`, `export-chef.py`, `make-chef-skins.py` belong to the art arm (see `src/art/CLAUDE.md`). Branch prefix `tools/`.

## Playtest harness (`playtest.mjs`, `npm run playtest`)
Drives headless Chromium over the DevTools protocol with real key holds. Finds `$CHROME`, then Playwright's cached Chromium (newest first), then a system Chrome or Brave. Launches with `--headless=new --mute-audio` (always muted: the user asked for silence) and a 1280x800 viewport matching `GAME_WIDTH` x `GAME_HEIGHT`.

Flags: `--url` (default `http://localhost:5173/`), `--out` (default `playtest-shots/`, git-ignored), `--file <script>`, `--chrome <path>`. Any non-flag argument is appended to an inline script, joined with `;`.

Script lines are split on newlines **and semicolons**, so an `eval` expression can never contain a semicolon. `#` starts a comment.

| Command | Meaning |
|---|---|
| `goto <url>` | navigate, wait for load, settle 800 ms |
| `wait <ms>` | sleep |
| `tap <Code>` | key down 60 ms, up, settle 50 ms (a release and re-press inside one frame is invisible to edge detection) |
| `hold <Code[,Code]> <ms>` | chord held for a duration |
| `type <text>` | per-character key events, for the note box |
| `holduntil <Code[,Code]> <maxMs> <js>` | hold until the expression is truthy (polled every 16 ms) |
| `until <maxMs> <js>` | wait for the expression |
| `shot <name.png>` | screenshot into `--out` (read it with the Read tool) |
| `eval <js>` | evaluate, await, print JSON |
| `logs` / `errors` | print captured console lines / page exceptions |

Key codes are DOM `code` values: `KeyA`, `Space`, `Enter`, `Escape`, `ShiftLeft`, `ArrowUp`, `F8` and so on. Exit code 2 if the page threw, 1 on a script error.

Dev builds expose `window.__oc = { sim, level, scene }` once a level is running (set in `GameScene.buildLevel`, re-pointed on every rebuild), so scripts gate on `until 20000 typeof __oc !== 'undefined' && __oc.sim` and then read `__oc.sim.getState()`, `tileAt`, `itemAt`, `getTargetTile`, `sliderOffset`.

Start the server first: `npx vite --host --port 5173` in the background. The harness helpers below fetch files from the project root, which only the Vite dev server serves; `npm start` serves `dist/` and would 404 them.

## Scripted scenarios (`playtests/`)
Twenty scripts, `00-smoke` to `19-chefs-and-audio`, one per shipped feature, each with a header comment saying what it proves. Two libraries are fetched and evaluated by scripts:
- `qa-lib.txt` installs `window.__qa` (a stamped `SimEvent` log with `of`, `count`, `times`, `last`, `mark`, chef and tile helpers, `sim(seed, players, mods)`, `findSeed`) by shadowing `step()` on the live `Sim`, so call `window.__qaInstall()` again after every scene change. It also installs `window.__ui`, which reaches the Phaser game through the canvas pool and works on every scene: `scene(key)`, `levels`, `status`, `options`, `stars`, `menu`, `texts`, `settings`, `progress`.
- `monitor.txt` samples collision invariants every 16 ms (chef inside a solid tile, inside a slider at its live offset, chef-pedestrian and chef-chef overlap) into `window.__mon`; `__monReset()`, `__monStop()`.
`gen_1_2.py` and `gen_1_3.py` generate scripts 03 and 04 (repetitive route blocks); run from the repo root. When a feature ships, add a script; when a bug is fixed, the note's context has the seed to reproduce it.

## Play notes (`playnotes-store.mjs`, `playnotes.mjs`, `npm run notes`)
The store is shared by `server.mjs` and the Vite plugin in `vite.config.ts`: `POST /api/playnotes` appends one JSON line to `<dir>/notes.jsonl` and writes `<id>.jpg` beside it; `GET` lists. Text is required, trimmed and capped at 4000 characters; type is `bug | idea | note`; body limit 2 MiB. The CLI reads `./playnotes` and `~/.local/share/local-overcooked/playnotes` (the desktop launcher's copy), merges by time, and prints `[type] date  level · seed · preset · players · clock · score` then the text and the screenshot path. `--json` for raw, `--dir` for one directory. The client side is `src/game/playnotes.ts` (presentation arm).

## Certificate and server
`make-cert.mjs` (`npm run cert`) needs the `openssl` CLI; writes `certs/server.key` and `server.crt` with `localhost`, `127.0.0.1` and every LAN IPv4 as subject alternative names, valid ten years. `server.mjs` (repo root) calls it on start unless `NO_HTTPS=1`; the Gamepad API is blocked on plain http off localhost, which is the whole reason https exists here. Env: `PORT` 7777, `HTTPS_PORT` 7778, both step up to ten ports when busy, `HOST`, `ROOT` (`dist`), `CERT_DIR`, `PLAYNOTES_DIR`. Static serving has a path-traversal guard and `Cache-Control: no-cache`.

## Desktop launcher
`install-launcher.sh` (`npm run install-launcher`, Linux) builds `dist/` if missing, copies `dist/`, `server.mjs`, `make-cert.mjs`, `playnotes-store.mjs` and `launch.sh` into `~/.local/share/local-overcooked/`, draws the icon with `make-icon.py` if Pillow exists, and writes a `.desktop` file to the applications menu and the Desktop. `launch.sh` probes ports 7777 to 7786 for a page whose title is "Local Overcooked" (so another service on 7777 does not fool it), starts `node server.mjs` if none answers, and opens `http://localhost:<port>/` as an app window in Brave, Chrome or Chromium. Re-run the installer after pulling.

## Rules
- No npm dependencies. Node built-ins only; Python needs Pillow; `export-chef.py` needs Blender.
- Never commit `playtest-shots/`, `playnotes/`, `certs/`, `server.log` (all git-ignored).
- A harness script that fails is a bug report: fix the game or the script, do not delete the script.
