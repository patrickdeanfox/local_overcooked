# local_overcooked

A two-player Overcooked clone that runs in a browser on your home network. One screen, two Bluetooth gamepads (or keyboard). Phaser 3 + TypeScript.

## Run it
```bash
npm install
npm run build
npm start        # prints http://<your-lan-ip>:8080/
```
Development with hot reload: `npm run dev` (also reachable on the LAN).

## Controls
- Keyboard P1: WASD move, Space pick up / put down, Left Shift chop / wash / spray.
- Keyboard P2: Arrows move, Enter pick up / put down, Right Shift chop / wash / spray.
- Gamepads: left stick or d-pad move, A / Cross pick up, X / Square chop. Press C on the title screen to test and remap.

See `docs/PLAN.md` for the build plan and `docs/LEVEL_SCHEMA.md` to author levels.
