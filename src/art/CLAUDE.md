# src/art — the art arm

Two systems side by side: code-drawn Phaser textures for the HUD, icons and effect sprites (no image files anywhere), and the 3D model manifest that maps a role to a CC0 glTF file. The 3D kitchen replaced most of the 2D art; what remains live is listed below.

Owner: the art agent (shared with audio). Files: `src/art/**`, `assets/**`, `public/models/**`, `tools/sync-models.mjs`, `tools/export-chef.py`, `tools/make-chef-skins.py`, `tests/art.test.ts`. Branch prefix `art/`. Read `docs/DESIGN.md` once for the whole picture and `docs/WORKFLOW.md` for how PRs land.

## Files
- `keys.ts` — the texture-key contract: `TEX`, `ALL_TEXTURE_KEYS()`, `TEXTURE_SIZES`, `TILE_TYPES`, `BURGER_LAYERS`, `PROMPT_LABELS`. Presentation looks keys up here; never by string.
- `index.ts` — `generateTextures(scene)`: runs the four generators, then verifies every contract key exists. Idempotent: a scene restart costs nothing.
- `draw.ts` — canvas primitives. Nothing touches pixels one at a time; the whole pass stays under 200 ms.
- `tiles.ts`, `items.ts`, `chefs.ts`, `ui.ts` — the generators (64x64 tiles in a fake 3/4 view, 40x40 items, 64x80 chefs, 32x32 icons, order card, panel, button prompts). Item shapes take a radius so sprites and icons share them.
- `palette.ts` — named colours as lowercase six-digit hex, plus `PALETTE_INT`.
- `models.json` — the 3D manifest: role → `{ src?, url, scale?, fit?, height? }`. `src` is relative to `assets/` and only the sync script reads it; `url` is relative to `public/`. Normalisation is scale, then fit (footprint in tiles), then height (tiles tall), then centre on X/Z with the lowest point at y = 0. KayKit is 2 units per tile, hence `scale: 0.5`.
- `models.ts` — `ModelRole` (derived from the JSON keys, so a new entry widens it automatically), `MODELS`, `MODEL_ROLES`, `ChefSkin`, `CHEF_SKINS` (15 characters in picker order; the index is the persisted setting, so never reorder or remove), `DEFAULT_CHEF_SKINS`, `PEDESTRIAN_SKIN_URLS`.

## What is live
- `TEX.tile('floor' | 'road' | 'gate')` as ground textures, `TEX.fire`, `TEX.smoke`, `TEX.spray` as 3D sprites, `TEX.icon*`, `TEX.orderCard`, `TEX.buttonPrompt` in the HUD and menus.
- Mechanics spec (`docs/MECHANICS.md`): `TEX.tile('shelf' | 'trayRack' | 'delivery')`, `TEX.shelfClosed` (the shelf tile as a plain wall while the mechanic is off), `TEX.tray` and `TEX.deliveryCrate` (40x40 items) and `TEX.chalk86` (40x40 `fx.`, the chalk "86" board presentation hangs over an empty crate). The drawers are `drawShelf`, `drawShelfClosed`, `drawTrayRack`, `drawDelivery` in `tiles.ts` (all built on `drawWall`, the interior stone wall) and `drawTray`, `drawDeliveryCrate`, `drawChalk86` in `items.ts`.
- The rest of the 2D set (chef sprites, item sprites, crates, panel) is still generated and asserted by the test but has no consumer. Do not delete it without a PR that says so; do not add to it.
- 59 model roles (`jq 'keys | length' src/art/models.json`): 6 characters, 25 stations and structure, 4 cars, 20 foods, 4 cookware. `fridge`, `hood` and `wallOrderWindow` are loaded and unused (roadmap item 6 uses them). The mechanics roles, normalised to one tile like their neighbours: `shelf` (KayKit `wall_orderwindow`, `fit: 1`, so the two-tile wall piece becomes one tile wide and one tile tall, a waist-high hatch wall 0.22 tiles deep), `trayRack` (KayKit `kitchentable_B`, `scale: 0.5`, a full-tile table distinct from the serve counter's `kitchentable_A`), `delivery` (KayKit `door_A`, `scale: 0.5`: 0.8 tiles wide, 1.4 tall, 0.39 deep, a standing door slab to yaw toward the walkable neighbour), `deliveryCrate` (Furniture Kit `cardboardBoxClosed`, `fit: 0.6`, about 0.8 tiles tall), `tray` (Food Kit `plate-rectangle`, `fit: 0.7`, 0.7 x 0.59 tiles and 0.1 tall, so a load sits at y 0.1). The wall for a closed shelf is the existing `wall` role at half its instance scale.

## Kits (`assets/`, all CC0, each with its `License.txt`)
KayKit Restaurant Bits (40 of 144 pieces used), Kenney Animated Characters (the chef rig and four stock skins), Kenney Food Kit (7 of 201), Car Kit (4 of 51), Furniture Kit (2 of 140), Platformer Kit (5 creature characters). Both `assets/` and `public/models/` are committed. Vendor a new kit whole with its licence, but reference only the pieces you use; `npm run models` copies only referenced files plus their `.bin` buffers and textures.

## Pipeline
| Change | Run |
|---|---|
| Edited `models.json` or updated a kit | `npm run models` (missing sources are reported and fail the exit code) |
| Apron colours or a new apron in `tools/make-chef-skins.py` | `npm run skins` (Pillow), then `CHEF_SKINS` in the same order |
| The chef rig or its clips | `npm run chef` (Blender headless) |

`export-chef.py` imports the Kenney `characterMedium.fbx`, constrains every bone in world space to the same-named bone of each clip file (the clips carry a different bind pose), bakes `idle`, `run`, `jump` as NLA strips, and exports `public/models/chef/chef.glb` with no embedded texture so the skin PNG swaps at runtime. `make-chef-skins.py` recolours one stock skin by region box and hue window (jacket → apron, jeans, sneakers, the skull emblem painted flat) and copies the four stock skins.

## How to add
- **An ingredient**: a palette group, a raw and a chopped shape in `items.ts` (`RAW_SHAPES`, `CHOPPED_SHAPES`, a `SOUP_COLORS` entry even when it never becomes soup), raw and chopped model roles below; presentation then fills `INGREDIENT_ROLE` and `CRATE_ROLE` / `CRATE_FILLER`. Fish and prawn are the pattern (the Food Kit has no prawn, so a mussel stands in for it).
- **A model role**: kit in `assets/`, entry in `models.json` with `src`, `url` and one normaliser, `npm run models`. Then the consumer in the presentation arm (`buildStation` in `src/game/render/three/tiles.ts` or the role tables in `three/items.ts`). A 2D icon for the HUD is a `TEX` key plus `ALL_TEXTURE_KEYS()` plus a drawer, or `tests/art.test.ts` fails on the missing key; a new `IngredientType` widens the key set automatically.
- **An apron skin**: tuple in `CHEFS` of the skin script, `npm run skins`, append to `CHEF_SKINS` with `model: 'chef'`, the `url`, a ring `color` and a lighter `textColor`.
- **A creature or other rigged character**: role with `height`, `npm run models`, append to `CHEF_SKINS` with no `url` and `clips` naming its idle and run clips (creatures use `sprint`). `AnimationClip.findByName` returns null silently and the rig never moves if a name is wrong; check the clip names inside the glTF. No head bone means no toque, automatically.
- **A menu backdrop or panel texture**: a `TEX` key and a `TEXTURE_SIZES` entry in `keys.ts`, the key in `ALL_TEXTURE_KEYS()`, palette entries (6-digit hex) and a drawer in `ui.ts`; `TEX.uiBackdrop` (1280x800: gradient, a faint tilted checker, a glow, a vignette, fixed-seed grain) is the pattern. Presentation places it through `installBackdrop` in `src/game/ui/panel.ts`.
- **Theme props**: roles for the props, then the dressing builder in `three/tiles.ts` (copy `streetDressing` or `backWall`); update `themeSceneHeight` if it adds height.

## Tests (`tests/art.test.ts`)
Runs in Node against a proxy canvas that counts operations, so every draw path executes. Asserts no duplicate keys, the helper-built keys exist, palette values are lowercase six-digit hex with matching ints, every contract key is created and drawn into, sizes by key prefix (`tile.`, `chef.`, `icon.`, `item.`), and idempotence with exactly `ALL_TEXTURE_KEYS().length` canvases. Nothing validates `models.json` against `public/models/`: a bad `url` shows up at runtime as a magenta box. Roadmap item 6 adds that check.

## Gotchas
- Never rename a role or a `TEX` key without updating every consumer; adding is free.
- Crates use `TEX.crate(ingredient)`, never `TEX.tile('crate')`.
- Tiles butt against neighbours, so nothing is rounded at the outer corners.
- Models face +Z at rest, so "down" toward the camera is yaw 0; toque size is a fraction of the head bone length.
- `CHEF_SKIN_URLS` and `modelUrl` are exported with no consumer.

## Roadmap work that lands here
Kits per world theme and theme dressing as data (`docs/ROADMAP.md` item 6), the character maker, more skins and custom models (item 7), order-card icons from the 3D dishes (item 12), and every new station or ingredient the levels need (item 5).
