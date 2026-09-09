# src/input — the input arm

Keyboard and Gamepad API handling: device state, bindings, edge detection, labels, persistence, and the Controllers page. Produces one `PlayerInput` per player per frame for the sim and a merged menu input for the scenes.

Owner: the input agent. Files: `src/input/**`, `src/game/scenes/ControllerScene.ts`, `tests/input.test.ts`, `docs/CONTROLS.md`. Branch prefix `input/`. Read `docs/DESIGN.md` once for the whole picture and `docs/WORKFLOW.md` for how PRs land.

## Files
- `types.ts` — the contract: `GameAction`, `KeyboardBinding`, `GamepadBinding`, `PlayerBindings`, `InputManager` (what scenes use), `FullInputManager` (what the Controllers page uses: capture, claim, reset, save), `PadInfo`, `RawPlayerState`, `CaptureResult`. Re-exports `PlayerInput` from `../sim/types`. Additive changes only.
- `mapping.ts` — pure decode layer, **no DOM, no Phaser, no browser globals**: defaults, deadzone maths, keyboard and pad reads into a `HeldState`, `writePlayerInput` (held + previous → edges), the edge latch for fixed steps, `readMenuInput` / `axisEdge`, pad-kind detection and labels, `serialiseBindings` / `parseBindings`, `BINDINGS_VERSION`. Nothing else in the codebase decodes raw devices.
- `index.ts` — `BrowserInputManager`, the only DOM wiring: key events, blur, gamepad connect and disconnect, `navigator.getGamepads()` polling, auto-assignment, manual claim, capture, `localStorage`. Exports `createInputManager(scene, players)` and re-exports everything from `types` and `mapping`.
- `../game/scenes/ControllerScene.ts` — the Controllers page: two player panels with live stick, d-pad, face buttons and key caps, the action table, remap capture, pad claim, reset row.

## Boundary
- Imports: `STORAGE_KEYS` from `src/config.ts`, `log` from `src/log.ts`, `PlayerInput` (type) from `src/sim/types.ts`. The Controllers page also uses `TEX` from `src/art/keys.ts` for prompt badges and `SCENE`, `GAME_WIDTH`, `GAME_HEIGHT`, `MAX_PLAYERS` from config.
- Consumers: `GameScene` (`createInputManager`, the edge latch helpers, `writeStepInput`), `TitleScene`, `SettingsScene`, `ChefsScene`, `ResultsScene` (`createInputManager`, `poll`, `labelFor`). `src/game/ui/menuInput.ts` consumes `PlayerInput` but not this arm's helpers.

## Per-frame contract
- `poll()` returns a reused array of reused `PlayerInput` objects: read them this frame, never store them. Per slot it reads the keyboard set for that slot, merges the pad on top if one is assigned (buttons OR, keyboard movement wins unless neutral), then computes rising edges against the previous frame.
- Keyboard set 1 always drives player 1 and set 2 player 2, whatever pads exist, so the game plays with no pads.
- Edges and fixed steps: a press on a frame too short to run a sim step would be lost, so `GameScene` calls `latchEdges` before its step loop and `writeStepInput` per step, firing `pickupPressed` / `interactPressed` on the first sub-step only. `pausePressed` and `backPressed` never reach the sim.
- A key tapped and released inside one frame still counts for the next poll (`keysTapped`). Losing window focus clears every held key. Edges are suppressed for one frame after construction and after a remap so a freshly bound key cannot fire its own action.

## Pads
- Discovery is both polled and evented. A new pad takes the lowest free slot once; a pad the player released stays unassigned. Pressing a button on an unassigned pad while the Controllers page highlights a player claims that player.
- Labels: the id is tested for Xbox before PlayStation because both a DualShock on Firefox and an Xbox pad on Chrome can say only "Wireless Controller". Unknown pads get Xbox names.
- Left stick through a radial deadzone of `STICK_DEADZONE = 0.25`, renormalised so full deflection is 1 and diagonals never exceed 1. D-pad overrides the stick while held. Analog buttons count above `BUTTON_PRESS_THRESHOLD = 0.5`.
- The Gamepad API is blocked on plain http from any address other than localhost; the page shows a red notice when `window.isSecureContext` is false.
- Menu back is fixed on Backspace and B/Circle and is deliberately not a `GameAction`, so a bad remap can never trap a player on a screen.

## Persistence
`local-overcooked.bindings.v1`. `parseBindings` rejects a wrong version, a missing action, an empty list, a non-integer button or a button outside 0..31 and the manager falls back to defaults. Pad assignment is per session and never saved. The Controllers page calls `save()` after every remap, reset and claim; nothing autosaves.

## Adding a `GameAction` (throw, dash)
Every place the action list is enumerated, in order: the `GameAction` union in `types.ts`; the `ACTIONS` array (typed `readonly GameAction[]`, so omitting the new action compiles and silently breaks defaults, cloning, validation and the page rows: check it by hand); `ACTION_NAMES`; `DEFAULT_KEYS` for both players; `DEFAULT_PAD_BUTTONS`; the `HeldState` field with `createHeldState`, `clearHeldState`, `copyHeldState`, `mergeHeldState`; `readKeyboard` and `readGamepad`; the `PlayerInput` field in `src/sim/types.ts` plus `NO_INPUT`, `createPlayerInput`, `clearPlayerInput`, `writePlayerInput`; the `EdgeLatch` set if the press must survive the fixed-step loop like pickup does; `readMenuInput` if it works in menus; `tests/input.test.ts`; the tables in `docs/CONTROLS.md`. Saved bindings then lack the new key and `parseBindings` returns null, wiping every user's map: bump `BINDINGS_VERSION` and migrate deliberately, or accept the reset and say so in the PR. The Controllers page derives its row count from `ACTIONS.length`; check the panel height still fits.

## Tests (`tests/input.test.ts`)
Deadzone maths, rising edges, `readGamepad` and `readKeyboard` against plain snapshot objects (a real `Gamepad` is assignable without a cast), pad-kind detection with the "Wireless Controller" collision pinned, menu helpers, the edge latch through a loop that mirrors `GameScene.runSim`, persistence round trip and rejection cases, and defaults for every action on both devices. The tests import from `mapping` and `types` directly so they never touch the DOM barrel.

## Known rough edges (roadmap item 3)
No pad swap or release from the UI (`unassignPad` and `listPads` exist with no caller), keyboard set hard-wired to player index, a remap collapses Shift+Ctrl to one key, stick and d-pad toggles and the deadzone are not editable, glyph labels only on this page. `DEFAULT_KEYBOARD_BINDINGS` in `mapping.ts` has no consumer left.

## Before a PR
`npm test`, `npm run typecheck`, then `tools/playtests/07-level-end-results-and-menus.txt` (opens the Controllers page) and a real pad if one is available. Update `docs/CONTROLS.md` when defaults or the page change.
