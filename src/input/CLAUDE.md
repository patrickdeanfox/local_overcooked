# src/input — the input arm

Keyboard and Gamepad API handling: device state, bindings, edge detection, labels, persistence, and the Controllers page. Produces one `PlayerInput` per player per frame for the sim and a merged menu input for the scenes.

Owner: the input agent. Files: `src/input/**`, `src/game/scenes/ControllerScene.ts`, `tests/input.test.ts`, `docs/CONTROLS.md`. Branch prefix `input/`. Read `docs/DESIGN.md` once for the whole picture and `docs/WORKFLOW.md` for how PRs land.

## Files
- `types.ts` — the contract: `GameAction`, `HintAction` (`GameAction | 'back'`), `KeyboardBinding`, `GamepadBinding` (with an optional per-pad `deadzone`), `PlayerBindings`, `DeviceChoice`, `InputManager` (what scenes use: `poll`, `labelFor`), `FullInputManager` (what the Controllers page uses: capture, claim, device choice, reset, save), `PadInfo`, `RawPlayerState`, `CaptureResult`. Re-exports `PlayerInput` from `../sim/types`. Additive changes only.
- `mapping.ts` — pure decode layer, **no DOM, no Phaser, no browser globals**: defaults, deadzone maths, keyboard and pad reads into a `HeldState`, `writePlayerInput` (held + previous → edges), the edge latch for fixed steps, `readMenuInput` / `axisEdge`, pad-kind detection and labels, `menuLabels` (the one helper every hint line goes through), the `BindingsStore` (keyboard sets, per-slot pad fallback, pads by id: `defaultBindingsStore`, `padBindingFor`, `swapKeyboardSets`, `keyboardSetLabel`, `clampDeadzone`), `serialiseBindings` / `parseBindings` with the v1 migration, `BINDINGS_VERSION`. Nothing else in the codebase decodes raw devices.
- `index.ts` — `BrowserInputManager`, the only DOM wiring: key events, blur, gamepad connect and disconnect, `navigator.getGamepads()` polling, auto-assignment, manual claim and swap, keyboard set choice, capture, `localStorage`. Holds the store and a `live` `PlayerBindings` per slot that points into it. Exports `createInputManager(scene, players)` and re-exports everything from `types` and `mapping`.
- `../game/scenes/ControllerScene.ts` — the Controllers page: two player panels with live stick, d-pad, face buttons and key caps; a table of Device, Set up controls (the wizard), the actions, Left stick, D-pad, Stick deadzone, Reset. Left / right changes the value on the setting rows and switches column elsewhere; select adds a key or button to an action, the chop button clears it for the chosen device.

## Boundary
- Imports: `STORAGE_KEYS` from `src/config.ts`, `log` from `src/log.ts`, `PlayerInput` (type) from `src/sim/types.ts`. The Controllers page also uses `TEX` from `src/art/keys.ts` for prompt badges and `SCENE`, `GAME_WIDTH`, `GAME_HEIGHT`, `MAX_PLAYERS` from config.
- Consumers: `GameScene` (`createInputManager`, the edge latch helpers, `writeStepInput`, `menuLabels` for the pause hint), `TitleScene` (`labelFor`, `menuLabels`, `hasSavedBindings` for the first-run pointer), `SettingsScene`, `CustomDifficultyScene`, `ChefsScene`, `ResultsScene` (`createInputManager`, `poll`, `menuLabels`). `src/game/ui/menuInput.ts` consumes `PlayerInput` but not this arm's helpers.

## Per-frame contract
- `poll()` returns a reused array of reused `PlayerInput` objects: read them this frame, never store them. Per slot it reads the keyboard set for that slot, merges the pad on top if one is assigned (buttons OR, keyboard movement wins unless neutral), then computes rising edges against the previous frame.
- Each slot holds one keyboard set (player 1 starts on set 1, player 2 on set 2; `setKeyboardSet` swaps them and releases the slot's pad), whatever pads exist, so the game plays with no pads.
- Edges and fixed steps: a press on a frame too short to run a sim step would be lost, so `GameScene` calls `latchEdges` before its step loop and `writeStepInput` per step, firing `pickupPressed` / `interactPressed` on the first sub-step only. `pausePressed` and `backPressed` never reach the sim.
- A key tapped and released inside one frame still counts for the next poll (`keysTapped`). Losing window focus clears every held key. Edges are suppressed for one frame after construction and after a remap so a freshly bound key cannot fire its own action.

## Pads
- Discovery is both polled and evented. A new pad takes the lowest free slot once; a pad the player released stays unassigned. Pressing a button on an unassigned pad while the Controllers page highlights a player claims that player. `assignPad` on a pad another player holds swaps the two pads.
- A pad's map, stick and d-pad switches and deadzone live under its id in `store.pads`; a pad the store has never seen uses the slot's fallback binding. `setGamepadBinding` writes to the pad entry when a pad is held, else to the fallback.
- Labels: the id is tested for Xbox before PlayStation because both a DualShock on Firefox and an Xbox pad on Chrome can say only "Wireless Controller". Unknown pads get Xbox names.
- Left stick through a radial deadzone of `binding.deadzone ?? STICK_DEADZONE` (0.25; the page steps it by `DEADZONE_STEP` within `DEADZONE_MIN..DEADZONE_MAX`), renormalised so full deflection is 1 and diagonals never exceed 1. D-pad overrides the stick while held. Analog buttons count above `BUTTON_PRESS_THRESHOLD = 0.5`.
- The Gamepad API is blocked on plain http from any address other than localhost; the page shows a red notice when `window.isSecureContext` is false.
- Menu back is fixed on Backspace and B/Circle and is deliberately not a `GameAction`, so a bad remap can never trap a player on a screen.

## Persistence
`local-overcooked.bindings.v1`, payload version 2: `{ keyboards[], players[{ keyboardSet, gamepad }], pads{ id } }`. `parseBindings` migrates a version-1 payload (each player's keyboard becomes their set, pads stay unknown) and rejects anything older, a missing action, a non-integer button, a button outside 0..31, a deadzone outside its range, or two players on one keyboard set; the manager then falls back to defaults. An action's list may be empty (unbound on that device). Pad assignment is per session and never saved. The Controllers page calls `save()` after every change; nothing autosaves. `hasSavedBindings()` is false until something was saved, which is what the first-run pointers key on.

## Adding a `GameAction` (throw, dash)
Every place the action list is enumerated, in order: the `GameAction` union in `types.ts`; the `ACTIONS` array (typed `readonly GameAction[]`, so omitting the new action compiles and silently breaks defaults, cloning, validation and the page rows: check it by hand); `ACTION_NAMES`; `DEFAULT_KEYS` for both players; `DEFAULT_PAD_BUTTONS`; the `HeldState` field with `createHeldState`, `clearHeldState`, `copyHeldState`, `mergeHeldState`; `readKeyboard` and `readGamepad`; the `PlayerInput` field in `src/sim/types.ts` plus `NO_INPUT`, `createPlayerInput`, `clearPlayerInput`, `writePlayerInput`; the `EdgeLatch` set if the press must survive the fixed-step loop like pickup does; `readMenuInput` if it works in menus; `tests/input.test.ts`; the tables in `docs/CONTROLS.md`. Saved bindings then lack the new key and `validateKeyboardBinding` returns null, wiping every user's map: bump `BINDINGS_VERSION` and add a migration step next to `parseV1` (fill the new action with its default), or accept the reset and say so in the PR. The Controllers page derives its rows from `ACTIONS` plus six fixed rows at `ROW_H = 30`; check the panel height still fits. B / Circle is the fixed menu-back button and `backPressed` is read only by menus, so in-game B is free for a new action.

## Tests (`tests/input.test.ts`)
Deadzone maths, rising edges, `readGamepad` and `readKeyboard` against plain snapshot objects (a real `Gamepad` is assignable without a cast), pad-kind detection with the "Wireless Controller" collision pinned, menu helpers, the edge latch through a loop that mirrors `GameScene.runSim`, persistence round trip and rejection cases, and defaults for every action on both devices. The tests import from `mapping` and `types` directly so they never touch the DOM barrel.

## Known rough edges
Gamepad paths are unit-tested against fake pads only; the headless harness has no pads, so the Device row's pad entries, the swap and the per-pad memory want a real pad. The wizard captures on whichever device is pressed, so a keyboard player who presses a pad button binds the pad (and claims it if it was free).

## Before a PR
`npm test`, `npm run typecheck`, then `tools/playtests/07-level-end-results-and-menus.txt` (opens the Controllers page), `tools/playtests/21-controllers-setup.txt` (device row, add, clear, wizard, persistence) and a real pad if one is available. Update `docs/CONTROLS.md` when defaults or the page change.
