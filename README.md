# local_overcooked

A two-player Overcooked clone that runs in a browser on your home network. One screen, two Bluetooth gamepads (or the keyboard). Phaser 3 + TypeScript, no image or sound files: every sprite is drawn in code and every sound is synthesised.

**Status: first playable.** Overcooked 1 levels 1-1, 1-2 and 1-3 are transcribed 1:1 from the wiki and fully playable: chopping, pot cooking, burning and fire, extinguisher, sink washing with dirty-plate return, plate stacks on the no-sink ship level, orders with tips and the exact-order combo rule, star thresholds, the 1-2 pedestrian crosswalk and the 1-3 sliding counters.

## Quick start

You need [Node.js](https://nodejs.org) 20 or newer and git. Everything else is included.

```bash
git clone https://github.com/patrickdeanfox/local_overcooked.git
cd local_overcooked
npm install
npm run build
npm start
```

`npm start` prints the addresses. Open one in Chrome, Edge, Brave or Firefox:

- **On the same computer:** http://localhost:7777/ (gamepads work here, no warning).
- **From another device on your network:** the `https://<ip>:7778/` line. Accept the certificate warning once (the certificate is self-signed and created on first start). The plain http address works too but is keyboard only, because browsers block gamepads on http from any address other than localhost.

Pair your controllers with the device that runs the browser, then press a button on each pad once the page is open. Player 1 gets the first pad, player 2 the second; the keyboard always works for both. To stop the server press Ctrl+C.

### Desktop icon (Linux)
```bash
npm run install-launcher
```
Puts **Local Overcooked** in your applications menu and on the Desktop. Double-clicking it starts the server if needed and opens the game in an app window at http://localhost:7777/. Re-run the command after pulling an update. To remove it, delete `~/.local/share/local-overcooked` and the two `local-overcooked.desktop` files it prints.

### Updating
```bash
git pull
npm install
npm run build
npm start                 # or: npm run install-launcher
```

## Hosting and hardware
The server only hands out static files; the whole game runs in the browser of the device showing it.

- **Server (a basic NAS is plenty):** Node 18 or newer to run `server.mjs` (about 1.4 MB served per page load, no CPU or RAM to speak of). No Node on the NAS? Copy `dist/` into any web server it already has (nginx, Caddy, Synology Web Station, QNAP) and serve it over https. Build on a laptop first: Vite and TypeScript need Node 20 or newer, the NAS does not.
- **Player device (the one running the browser):** this does all the work: a 1280x800 WebGL canvas at 60 fps, plus the Bluetooth pads pair here, not to the NAS. Any laptop or desktop from the last several years is fine; a Raspberry Pi 4 or 5 with Chromium works; TV built-in browsers usually lack gamepad support.
- **Network:** local traffic only, one page load per session, no bandwidth concerns.
- Environment variables: `PORT` (7777), `HTTPS_PORT` (7778); a busy port steps up to the next free one, `CERT_DIR` (`certs/`, bring your own `server.key` and `server.crt`), `NO_HTTPS=1` to skip https, `ROOT` (`dist`).

Development with hot reload (also reachable on the LAN): `npm run dev`. Editing a level JSON while playing it rebuilds the kitchen in place.

## Controls
| Action | Keyboard P1 | Keyboard P2 | Xbox | PlayStation |
|---|---|---|---|---|
| Move | W A S D | Arrows | Left stick / d-pad | Left stick / d-pad |
| Pick up / put down | Space | Enter | A | Cross |
| Chop / wash / spray (hold) | Left Shift or Ctrl | Right Shift or Ctrl | X | Square |
| Pause / back | Esc | Esc | Start / B | Options / Circle |

Keyboard set 1 always drives player 1 and set 2 always drives player 2, so the game works with no pads at all. Pads are assigned in the order they connect; the **Controllers** entry on the title screen shows live input for each player and lets you remap any action. Bindings persist in the browser. Details and quirks: `docs/CONTROLS.md`.

Other keys: **M** mute, **F3** or backtick debug overlay, **F4** (held, dev only) fake HUD state.

## Scripts
| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server with hot reload, bound to all interfaces |
| `npm run build` | typecheck + production build into `dist/` |
| `npm start` | zero-dependency Node static server for `dist/`: http 7777 and https 7778 |
| `npm run cert` | create the self-signed certificate in `certs/` (also done by `npm start` when missing) |
| `npm test` | vitest: simulation rules, level validation and reachability, input mapping, art keys, audio map |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run playtest -- "…"` | headless playtest harness (below) |

## Headless playtests
`tools/playtest.mjs` drives the game in a headless Chromium over the DevTools protocol with real key holds, screenshots, console capture and page evaluation. No dependencies; it finds Playwright's cached Chromium or a system Chrome (`CHROME=/path` to override).
```bash
npm run dev &                                    # or point --url at any server
npm run playtest -- --url http://localhost:5173/ --out shots \
  "tap Enter; wait 900; holduntil KeyA 3000 __oc.sim.getState().chefs[0].x <= 3.55; hold KeyW 120; tap Space; shot onion.png; errors"
```
In dev builds the page exposes `window.__oc = { sim, level, scene }`, so `eval` and `holduntil` can read the live simulation. Scripted scenarios live in `tools/playtests/`.

## Project layout
```
src/sim/        pure TypeScript kitchen simulation (deterministic, no Phaser)  → types.ts is the contract
src/levels/     level JSON (ASCII grid + legend) and the schema/validator      → docs/LEVEL_SCHEMA.md
src/game/       Phaser scenes, renderer, HUD, pause, results, debug overlay, hot reload
src/input/      keyboard + Gamepad API manager, bindings, controller screen
src/art/        code-drawn textures (tiles, items, chefs, icons, prompts)      → keys.ts is the contract
src/audio/      Web Audio synth SFX and music loop
tools/          playtest harness
docs/           PLAN, ROADMAP, LEVELS (the three transcriptions), CONTROLS, research/ (wiki research)
```

## Adding a level
1. Fetch the wiki page and screenshot: `python3 docs/research/tools/fetch_wiki.py page-images "1-4 (Overcooked!)"`.
2. Write `src/levels/oc1/1-4.json` following `docs/LEVEL_SCHEMA.md` (fixed legend: `#` counter, `O`/`T`/`M` crates, `B` board, `S` stove, `W` sink, `D` drying, `R` plate return, `V` serve, `X` trash, `E` extinguisher, `P` plate stack, `p` plate, `1`-`4` sliders, `~` road, `.` floor, space void).
3. `npm test` validates the grid and checks every station is reachable; `npm run dev` lets you walk it.
4. Timers and star thresholds come from the level page infobox and star chart; `docs/research/oc1-levels.md` has every OC1 level tabulated.

## What is not in this build
Throwing and dashing (Overcooked 2), a level-select map with saved stars, playing from two devices, generated sprites, Tiled import, and any recipe beyond soup. The order in which those land, with the files each one touches, is in `docs/ROADMAP.md`.
