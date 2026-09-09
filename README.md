# local_overcooked

A two-player Overcooked clone that runs in a browser on your home network. One screen, two Bluetooth gamepads (or the keyboard). The kitchen is a real 3D scene (Three.js) built from CC0 low-poly kits by Kenney and KayKit; Phaser 3 draws the menus and HUD on top, and every sound is synthesised.

**Status: Overcooked 1 world 1 complete, Overcooked 2 dynamics in.** Chefs can throw ingredients (caught by a free-handed chef, straight into a pot, onto a counter, or across a hole) and dash (which bumps the other chef and sends their food flying); a gap tile is a hole to throw over and fall into. Levels 1-1 to 1-6, the split deck of 3-2 and Overcooked 2's sashimi bar 1-1 are transcribed from the wiki: soups (pots), burgers (frying pans, bun, lettuce, tomato), chopping, burning and fire, extinguisher, sink washing with dirty-plate return, plate stacks on the no-sink ship level, orders with tips and the exact-order combo rule, star thresholds and unlocks, the 1-2 pedestrian crosswalk, the 1-3 sliding counters, the 1-5 one-tile ring corridor and the 1-6 earthquake seam. Level select remembers your best scores and stars; difficulty presets and seeded order sequences add replay value. Five optional mechanics (two-plate carry, chop assist, the tray, the pass-through shelf and the 86 system with running-out crates, rewritten tickets and deliveries) sit behind switches on the Settings page. Around the kitchen: a Chefs page with 15 characters previewed in 3D, a Settings page with assists and separate music and effects switches, level themes with steam and a chopping animation, an F8 note reporter for bugs and ideas, and a research catalog of all 74 Overcooked 1 and 2 levels ready to transcribe (`docs/research/catalog/`).

Working on the code: `docs/DESIGN.md` explains how the pieces fit, `docs/WORKFLOW.md` explains how to work on several parts at once, and each part of `src/` carries its own `CLAUDE.md` with the rules for that part. What comes next is in `docs/ROADMAP.md`.

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

## Playing
- **Level select.** The title screen lists the six kitchens with the stars you have earned and your best score. Levels unlock by total stars, using the thresholds from the original game (1-2 needs 2, 1-3 needs 4, 1-4 needs 5, 1-5 needs 6, 1-6 needs 8). Switch **Free play** on to play anything.
- **Difficulty.** Relaxed, Normal, Hard and Chaos scale the order cadence, patience, ticket count and chef speed. Custom plays the numbers you set on the Settings page's **Custom difficulty** row: level time, tickets at the start and on screen, seconds between tickets, ticket patience, cook, burn, chop and wash times, and chef speed, each with a line saying what it comes to on 1-1. Stars earned on Relaxed or Custom do not count toward unlocks.
- **Chefs.** The **Chefs** entry opens the character picker, previewed live in 3D: six apron colours on the chef, the four stock Kenney characters, and the five Platformer Kit creatures. The ring under a chef in the kitchen matches the character.
- **Settings.** The **Settings** entry opens a page with the seed, free play, the assists, the five mechanics switches, the Custom difficulty page and the audio switches. Seed: Random gives a new order sequence every run, Daily gives everyone the same sequence for the day, Fixed replays a chosen number (edit it with left/right or the digit keys). The seed and preset are shown in the top-right during play and on the results screen; Retry replays the same seed. Assists: instant cooking, orders never expire, and no burning; a run with any assist on is not saved and earns no stars.
- **Audio.** Music and sound effects switch off separately, on the Settings page or from the pause menu. **M** mutes everything.
- **Mechanics.** Five additions to the kitchen rules, each on its own switch on the Settings page and off until you turn it on (`docs/MECHANICS.md`). A run with mechanics on is saved and earns stars. **Pass-through shelf**: hatch tiles in a wall become counters reachable from both sides (off, they are wall). **Chop assist**: a second chef at the same board halves the time left (off, a board is one chef's work). **Two-plate carry**: holding one clean plate at a drying rack or plate stack, pick up again to take a second; put them down one at a time; no dashing with two. **The 86 system**: crates hold a finite number of items and show their fill level; the last item chalks an "86" over the crate and every ticket that needed the ingredient rewrites to the nearest substitute (the ticket flashes, a dish built to the old ticket still serves); a delivery arrives at the door after a while and a chef unloads it by holding the work button in front of it, faster with a second chef. **The tray**: on levels with a tray rack, hold the work button facing the tray to lift it (half a second), then the pick-up button loads whatever is in front of you onto it (three items) or offers the top item to the station you face; the work button facing an empty counter sets it down; you walk slower with it, cannot dash, and a shove makes the load wobble, twice in a row and the top item falls. Levels using them: 1-4, 1-5 and Overcooked 2's 1-1 have crate limits and a delivery door, 1-5 has a tray rack, and three custom levels (Hatch Row, Long Haul, Short Order) are built around them.
- **Tutorials.** The **Tutorials** row on the title opens a page with five short kitchens, one per mechanic, each with the rules under the list. A tutorial forces its mechanic on whatever the Settings say, opens with a panel of the rules, then walks you through it one step at a time in a banner along the bottom with a pointer over the tile it means; the clock only starts when you serve, so take your time. Skip the walkthrough from the panel with the back button. Stars earned in a tutorial are saved but never count toward unlocks. The chop assist tutorial needs two players for the assist step itself; alone it shows the rules and skips that step.
- **Burgers (1-4, 1-6).** Chop beef, fry it in a pan, put a bun on a plate, collect the patty from the pan with the plate, add chopped lettuce or tomato as the ticket asks, serve. Pans burn like pots.

## Play notes (bug reports and ideas)
Press **F8** on any screen, or click the **Note** button in the corner, to leave a bug report, idea or note while you play. The game pauses, you type, **Ctrl+Enter** sends (Esc cancels). Each note records the screen, level, seed, difficulty, players, clock, score, current tickets, chef positions, the last few events and a screenshot. Notes are stored on the machine running the server in `playnotes/notes.jsonl` with the screenshots beside it (the desktop launcher's copy lives in `~/.local/share/local-overcooked/playnotes/`). If the server is unreachable, the note waits in the browser and goes out with the next one.

```bash
npm run notes            # readable list of every note
npm run notes -- --json  # raw JSON
```
A keyboard is needed to type; pads cannot open the box.

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
| Throw the held ingredient | E | / | Y | Triangle |
| Dash | Q | . | B | Circle |
| Pause / back | Esc | Esc | Start / B | Options / Circle |

Each player holds one keyboard set (WASD or the arrows), so the game works with no pads at all. Pads are assigned in the order they connect; the **Controllers** entry on the title screen shows live input for each player, lets you pick each player's device (a keyboard set or a pad by name), walks you through every button with **Set up controls**, adds or clears keys and buttons per action, and sets the stick, d-pad and deadzone per pad. Bindings persist in the browser, pads by their id. Details and quirks: `docs/CONTROLS.md`.

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
| `npm run notes` | print the F8 play notes (`-- --json` for raw JSON) |
| `npm run models` | copy the glTF files named in `src/art/models.json` from `assets/` into `public/models/` |
| `npm run skins` | paint the six apron skins from a stock Kenney skin (needs Pillow) |
| `npm run chef` | bake the Kenney character rig and clips into `public/models/chef/chef.glb` (needs Blender) |
| `npm run install-launcher` | Linux desktop launcher (above) |

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
src/game/       Phaser scenes, renderer, HUD, pause, results, settings, progress, play notes, hot reload
src/input/      keyboard + Gamepad API manager, bindings, controller screen
src/art/        3D model manifest (models.json → models.ts) and code-drawn HUD textures → keys.ts and models.ts are the contracts
src/game/render/ KitchenRenderer (state → Three.js scene) and three/ (stage, loader, tiles, items, chef rigs, effects)
assets/         CC0 source kits (Kenney Food, Furniture, Car and Platformer kits, Animated Characters; KayKit Restaurant Bits)
public/models/  the glTF files the game loads, synced from assets/ by `npm run models`
src/audio/      Web Audio synth SFX and music loop
tools/          playtest harness and scripted scenarios, play-note store, model sync, chef export and skins, cert, launcher
playnotes/      F8 notes and screenshots written by the server (not committed)
docs/           DESIGN, WORKFLOW, ROADMAP, PLAN, LEVELS (the six transcriptions), LEVEL_SCHEMA, CONTROLS, research/ (wiki research and the level catalog)
```
Each `src/` part has a `CLAUDE.md` with its rules, boundaries, tests and how-to-add recipes.

## Adding a level
1. Start from the catalog record: `docs/research/catalog/oc1/oc1-2-1.md` already has the ASCII grid, station counts, timers, star thresholds and a list of the mechanics the clone still lacks for that level. If its grid confidence is low, fetch a better screenshot: `python3 docs/research/tools/fetch_wiki.py page-images "2-1 (Overcooked!)"`.
2. Write `src/levels/oc1/2-1.json` following `docs/LEVEL_SCHEMA.md` (fixed legend: `#` counter, `O`/`T`/`M` soup crates, `A`/`U`/`L` meat, bun and lettuce crates, `B` board, `S` stove with pot, `F` stove with pan, `W` sink, `D` drying, `R` plate return, `V` serve, `X` trash, `E` extinguisher, `P` plate stack, `p` plate, `1`-`4` sliders, `G` earthquake gate, `~` road, `.` floor, space void). The catalog's extension characters (fryer, oven, belts and so on) have no legend entry yet; those levels wait on the mechanic. Add `unlockStars` from the wiki infobox.
3. `npm test` validates the grid and checks every station is reachable; `npm run dev` lets you walk it.
4. Timers and star thresholds come from the level page infobox and star chart; `docs/research/oc1-levels.md` has every OC1 level tabulated.

## What is not in this build
Overcooked 1 worlds 2 to 6 and all of Overcooked 2 (moving trucks, conveyor belts, fish and chips, pizza, burritos, mixers), throwing and dashing, more Kenney kits for the world themes, a character maker and custom models, procedurally generated kitchens, playing from two devices, recorded sound, and Tiled import. The order in which those land, with the files each one touches, is in `docs/ROADMAP.md`.
