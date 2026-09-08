# local_overcooked

A two-player Overcooked clone that runs in a browser on your home network. One screen, two Bluetooth gamepads (or the keyboard). Phaser 3 + TypeScript, no image or sound files: every sprite is drawn in code and every sound is synthesised.

**Status: first playable.** Overcooked 1 levels 1-1, 1-2 and 1-3 are transcribed 1:1 from the wiki and fully playable: chopping, pot cooking, burning and fire, extinguisher, sink washing with dirty-plate return, plate stacks on the no-sink ship level, orders with tips and the exact-order combo rule, star thresholds, the 1-2 pedestrian crosswalk and the 1-3 sliding counters.

## Run it
```bash
npm install
npm run build
npm start          # serves the built game on port 8080 and prints http://<your-lan-ip>:8080/
```
Open that URL on any device on the network. Pair the controllers with the OS first; Chrome only lists a pad after a button press on it.

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
| `npm start` | zero-dependency Node static server for `dist/`, port 8080 (`PORT=…` to change) |
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
