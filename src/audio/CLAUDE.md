# src/audio — the audio arm

Web Audio only: every sound is synthesised, there are no audio files. The `AudioContext` is created lazily on the first `resume()` or `play()`, and every method is a no-op where Web Audio does not exist, so the tests run in Node.

Owner: the audio agent (shared with art). Files: `src/audio/**`, `tests/audio.test.ts`. Branch prefix `audio/`. Read `docs/DESIGN.md` once for the whole picture and `docs/WORKFLOW.md` for how PRs land.

## Files
- `types.ts` — the contract: `SfxName` (43 names), `AudioBus` (`resume`, `play`, `startMusic`, `stopMusic`, `setMuted` / `isMuted`, `setMusicEnabled` / `isMusicEnabled`, `setSfxEnabled` / `isSfxEnabled`), `SfxForEvent`. Additive changes only.
- `index.ts` — `createAudioBus()` and `sfxForEvent(event)`, a switch over every `SimEventType` returning an `SfxName` or null.
- `sfx.ts` — `SFX_TABLE`, one synthesised one-shot per `SfxName`, each given the synth context and an absolute start time. Keep every sound under about half a second; they fire several times a second. The mechanics group (`docs/MECHANICS.md`): `crateEmpty` a hollow low knock, `orderRewritten` a chalk squeak over a falling pair (the mirror of `orderNew`'s rise, so a rewrite never reads as a new ticket), `restockDue` a two-tone doorbell, `restockTick` a cardboard rustle per unloading tick, `restocked` a fast high triad (higher and quicker than `serve`), `trayLift` a metallic scrape up, `traySet` a clink over a thud, `trayWobble` three falling clinks.
- `music.ts` — the loop: 8 bars at 120 bpm, I-vi-IV-V twice, bass on eighth steps, a triangle lead (softened from a square for long sessions), scheduled 250 ms ahead on the audio clock from a 25 ms interval.
- `synth.ts` — `tone`, `noise`, the 16-voice pool, the shared one-second noise buffer, `safely()` so one bad parameter cannot kill the game.

## Boundary
- Imports: `STORAGE_KEYS` from `src/config.ts`, `log`, and the `SimEvent` type. No Phaser, no Three, no `src/game`.
- Consumers: `src/game/audioBus.ts` owns the one bus for the whole page (mute persistence, gesture resume, the M key); `GameScene` starts and stops music and forwards every sim event through `sfxForEvent`; `MenuList` and `PauseMenu` play `uiMove`, `uiConfirm`, `uiBack` directly; the Settings page and pause menu flip the music and effects switches through `audioBus.ts`.

## Rules the code enforces
- Never schedule into a suspended context: the whole backlog would fire at once on resume. `play()` returns early unless the context is running.
- The same sound plays at most every 60 ms. Sounds are scheduled 2 ms ahead, never in the past.
- Music runs only while wanted, enabled, unmuted and the context is running, so a muted game costs nothing. `startMusic()` before the context exists defers to the next `resume()`; `onstatechange` restarts it when the browser un-suspends.
- The music scheduler clamps its next step to the audio clock: a hidden tab throttles `setInterval` while the audio clock keeps running, and without the clamp every missed note would fire together on return.
- Mute ramps the master gain over 30 ms rather than cutting. Mute is persisted under `local-overcooked.muted.v1`; `src/game/audioBus.ts` writes the same key a second time, which is harmless duplication.
- Every method must survive a missing `AudioContext`; the test asserts it.

## How to add
- **A sound for a new sim event**: the event in `src/sim/types.ts` (sim arm); the name in `SfxName` (the `SFX_TABLE` type then fails to compile until the sound exists, which is the point); the definition in `SFX_TABLE` in the right comment group, composed from `tone` and `noise`; the `case` in `sfxForEvent`; and both hand-maintained arrays in `tests/audio.test.ts`, `ALL_EVENT_TYPES` and `ALL_SFX`. `GameScene` needs no change.
- **A menu sound**: `SfxName` and `SFX_TABLE` only, then `getAudioBus().play(name)` at the call site.
- **Per-level music** (roadmap item 12): no hook exists. Extract the constants in `music.ts` into a `MusicTheme` record, give `createMusicPlayer` and `startMusic` a theme argument, rebuild the player in `syncMusic()` when the theme changes, and pass `level.theme` from the single call site in `GameScene`.
- **Recorded samples** (roadmap item 12): keep `SfxName` as the contract and load samples behind it, with the synth table as the fallback when a file is missing.

## Tests (`tests/audio.test.ts`)
`sfxForEvent` maps every event type to a name in `ALL_SFX`; `SFX_TABLE` defines exactly those names; the bus survives `resume`, every `play`, `startMusic` and `stopMusic` with no `AudioContext` and no `localStorage`, and tracks mute state anyway.

## Roadmap work that lands here
Sounds for every new station (`docs/ROADMAP.md` item 5), recorded CC0 samples and per-level music (item 12).
