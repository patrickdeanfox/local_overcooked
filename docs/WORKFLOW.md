# Workflow

How to work on several parts of the game at once without stepping on each other. The unit of parallel work is an **arm**: one directory with one owner, one contract file it owns, and one test file that proves it (`docs/DESIGN.md` has the table). Everything below follows from three rules.

1. **One arm per branch.** A branch edits one arm's files. If a task needs two arms, it is two branches, or one branch whose PR lists every file outside its arm and why.
2. **Contracts change first, additively.** A new optional field or union member lands in a small contract-only PR before the arms that use it start. Renames and removals update every consumer in one PR and say so.
3. **Tests and a playtest before a PR.** `npm test` and `npm run typecheck` always; a harness script and a screenshot for anything visible.

## Starting a task
1. `git fetch origin && git switch -c <arm>/<topic> origin/main`. Prefixes: `sim/`, `game/`, `input/`, `art/`, `audio/`, `levels/`, `tools/`, `research/`, `docs/`. Sessions that run in a worktree get one under `.claude/worktrees/`, which is git-ignored.
2. Read the root `CLAUDE.md`, then the arm's `CLAUDE.md` (Claude Code loads it automatically when editing inside that directory), then the roadmap item, then `npm run notes` for play feedback.
3. Say in one or two sentences what you will change and which contract members it needs. If it needs a new member, do the contract PR first (step 4) or name the consumers you will update.
4. Contract-only PR when needed: the field or member with a one-line doc comment, no behaviour, the owners of the consuming arms named in the description. These merge fast.
5. Build in your arm. Add or extend the arm's tests. Add a `tools/playtests/NN-<feature>.txt` script for anything visible and read its screenshots.
6. PR (below). The integrator merges; after a merge, the other open branches merge `origin/main` into themselves.

Plan with the large model when a task crosses arms or changes a contract; single-arm execution against a written plan can run on a smaller model.

## What can run in parallel
| Pair | Safe? | Because |
|---|---|---|
| sim and presentation | yes | presentation reads `SimState`; a new state field is an additive contract change the renderer can ignore until it draws it |
| sim and input | after a contract PR | a new `PlayerInput` field is the seam; agree the field name first |
| art and presentation | yes | art adds a role or key; presentation consumes it in a later PR; an unused role costs one fetch |
| audio and anything | yes | audio only needs the event name; a missing case returns null |
| levels and anything | yes, unless the level needs a mechanic | JSON only; a level that needs a new tile waits on the sim PR and the `LEGEND` entry |
| input and presentation | mostly | `ControllerScene.ts` is the input arm's; hint labels in other scenes are presentation's; agree on `labelFor` |
| research and anything | yes | nothing in `docs/research/` is loaded by the game |
| two branches in one arm | no | split by file, or serialise |

Integrator-owned files (`src/main.ts`, `src/config.ts`, `package.json`, configs, `README.md`, `docs/ROADMAP.md`, `docs/DESIGN.md`, `docs/WORKFLOW.md`) change only in their own PR or with an explicit line in the description.

## Merge order for a feature that spans arms
contract → sim → art and audio (in parallel) → presentation → input → levels → docs. Each step can open its PR as soon as the previous one merges; nothing waits on a step it does not consume. Example, throwing (roadmap item 4): contract PR adds `PlayerInput.throwPressed?`, `SimState.flying?`, `GameAction 'throw'`, `SfxName 'throw'`; then sim rules and tests; art needs nothing; audio maps the event; presentation draws the arc; input binds the button and adds the row; levels gives 1-6 its real drop; `docs/CONTROLS.md`, `README.md`, `docs/ROADMAP.md` move it to done.

## Verification before a PR
```bash
npm test                 # every arm's tests
npm run typecheck
npm run build            # only when touching config, main.ts or the manifest
npx vite --host --port 5173 &                                   # then, for anything visible:
node tools/playtest.mjs --url http://localhost:5173/ --out shots --file tools/playtests/NN-feature.txt
```
Read the screenshots. Determinism for sim changes: the `run(seed)` harness in `tests/sim.kitchen.test.ts`. Levels: walk it in `npm run dev`. Input: a real pad if one is available. Art: `npm run models` reports every missing source. The Chrome extension tab is hidden in agent sessions and never runs Phaser; use the harness.

## The PR
Title: `<Arm>: <what changed>` in a sentence (`Sim: throwing and the gap tile`). Body:
- What and why, two or three lines.
- Contract changes: the members added, or "none".
- Files outside the arm, each with a reason, or "none".
- How it was verified: the test files, the harness script, the screenshot names.
- Play notes acted on, by their timestamp, or "none".
- Docs updated: the arm's `CLAUDE.md` if its rules changed, `README.md` for anything a player sees, `docs/ROADMAP.md` when an item ships, `docs/LEVELS.md` per level, `docs/CONTROLS.md` for input.

The integrator merges with a merge commit, never force-pushes, never pushes to `main` directly. Branches stay until merged.

## Rules that apply everywhere
- Strict TypeScript, no `any`, no non-null assertions except Phaser field initialisation.
- No new npm dependencies. No `console.*` outside `src/log.ts`. Every tuned number in `src/sim/constants.ts` or level JSON.
- Sim code is deterministic and JSON-snapshot friendly. Presentation never mutates `SimState`.
- Never commit secrets, `node_modules/`, `dist/`, `certs/`, `playnotes/`, `playtest-shots/`.
- Playtest browsers launch muted.
- Facts confirmed by the user in play notes are ground truth; reproduce with the note's seed before changing a number.

## Picking parallel work from the roadmap
Items that touch one arm and can start at once: item 3 controller setup (input), item 6 kit vendoring and theme dressing (art, then presentation), item 8 stage 1 generator (levels), item 11 catalog converter (tools), item 12 recorded samples (audio). Items that begin with a contract PR: item 2 custom difficulty (sim modifiers, then presentation rows), item 4 throwing and dashing (contract, then sim, input, presentation, audio), item 7 character maker (art `ChefSkin.paint`, then presentation). Item 5, the remaining levels, is a stream of small level PRs gated on the mechanic PRs listed in `docs/ROADMAP.md`.
