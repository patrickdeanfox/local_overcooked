# Controls

Two players share one screen. Each player holds one keyboard set (WASD or the arrows) at
all times and a gamepad layers on top of it, so the game plays with two pads, one pad, or
none. Every hint line in the menus, the pause screen and the results names the buttons of
the device player 1 holds: keys on the keyboard, A / X on an Xbox pad, Cross / Square on
a PlayStation pad.

## Pairing a controller

The browser pairs nothing itself. Pair the pad with the operating system first, then let
the page see it.

1. **Pair over Bluetooth at the OS level.**
   - Xbox Wireless Controller: hold the pair button on the back until the Xbox button
     flashes quickly, then pair from the OS Bluetooth panel.
   - DualShock 4: hold Share + PS until the light bar flashes twice per pulse.
   - DualSense: hold Create + PS until the light bar flashes.
   - 8BitDo: put the pad in the mode its manual calls "X-input" (usually Start + X on
     power-on) before pairing; other modes report a non-standard button layout.
   - A USB cable works too and skips this step entirely.
2. **Open the game, then press a button on the pad.** The Gamepad API hides a pad until
   the page has seen input from it, so Chrome lists nothing until you press something.
   One press of A / Cross is enough.
3. **Check it on the controller screen.** Open **Controllers** from the title menu. Each player gets
   a column with the device name and a live view of the stick, d-pad, face buttons and
   keyboard keys. Move the stick and the dot moves with it.

Pads are handed out in connection order: first pad to player 1, second to player 2,
anything beyond that stays unassigned. To place a pad yourself, use the **Device** row at
the top of a player's column: left / right cycles through Keyboard set 1, Keyboard set 2
and every connected pad by name. Choosing a pad another player holds swaps the two pads;
choosing a keyboard set releases the pad, and whoever held that set takes the one you
gave up, so the two players never share a set. Pressing any button on an unassigned pad
also gives it to the highlighted player.

Unplugging a pad frees its slot at once and leaves that player on the keyboard. Plug it
back in and it takes the first free slot, with the map it had before: pads are remembered
by their id.

## Defaults

### Keyboard

Both keyboard sets are always live, whatever pads are connected. Player 1 starts on set 1
and player 2 on set 2; the Device row swaps them.

| Action | Player 1 | Player 2 |
| --- | --- | --- |
| Move | `W` `A` `S` `D` | arrow keys |
| Pick up / put down | `Space` | `Enter` |
| Chop / wash / spray (hold) | `Left Shift` or `Left Ctrl` | `Right Shift` or `Right Ctrl` |
| Throw the held ingredient | `E` | `/` |
| Dash | `Q` | `.` |
| Pause | `Esc` | `Esc` |
| Menu back | `Backspace` | `Backspace` |

### Gamepad

Standard mapping, as reported by the browser. Labels follow the pad: Xbox names by
default, PlayStation names when the device id says PlayStation, DualShock, DualSense or
Sony's vendor id `054c`.

| Action | Xbox | PlayStation | Button index |
| --- | --- | --- | --- |
| Move | left stick or d-pad | left stick or d-pad | axes 0/1, buttons 12–15 |
| Pick up / put down | A | Cross | 0 |
| Chop / wash / spray (hold) | X | Square | 2 |
| Throw the held ingredient | Y | Triangle | 3 |
| Dash | B | Circle | 1 |
| Pause | Start | Options | 9 |
| Menu back | B | Circle | 1 |

B / Circle does double duty on purpose: menus read it as back and the kitchen reads it as
dash, and no screen listens for both. The throw and dash defaults are the clone's own; the
original game's layout was not recorded in the research notes.

The left stick uses a radial deadzone of 0.25 and is renormalised afterwards, so the
usable travel covers a full 0..1 and a diagonal never exceeds full speed. The d-pad
overrides the stick while it is held. Triggers and other analog buttons count as pressed
above 0.5. The **Left stick**, **D-pad** and **Stick deadzone** rows on the controller
screen change these per pad (deadzone from 0 to 0.8 in steps of 0.05); the settings are
stored with that pad's id and come back with it.

Menu back is fixed on `Backspace` and B / Circle. It is the one action you cannot remap,
so a bad binding can never strand you on a screen.

## Remapping

Everything happens on the controller screen (the **Controllers** entry on the title menu).
Each player's column lists, top to bottom: Device, Set up controls, the nine actions,
Left stick, D-pad, Stick deadzone, Reset to defaults.

- **Move the highlight** with up/down on any device. Left/right switches between the
  player 1 and player 2 columns on the action rows, and changes the value on the Device,
  Left stick, D-pad and Stick deadzone rows.
- **Set up controls** walks through every action for the highlighted player: "Player 1,
  press the key for Pick up / drop", then the next, nine in all. Each press replaces that
  action's binding on the device you pressed; `Esc` keeps the current binding and moves
  on. The title's Controllers row and the page itself point at it on a first run, when
  nothing has been saved yet.
- **Add a key or button to an action**: highlight its row and press pick up (`Space`,
  `Enter`, or A on a pad). The row lights up and the next key or button you press is
  added to that action, so `Shift` and `Ctrl` can both keep chopping. `Esc` cancels.
- **Clear an action**: highlight its row and press the chop button (`Shift` / `Ctrl`, or
  X / Square). The action is emptied for the device shown on the Device row; add a new
  key or button afterwards. An action may stay unbound on one device.
- Keyboard and gamepad bindings are separate. Pressing a key changes only the keyboard set
  the player holds; pressing a pad button changes only that pad's map. A button pressed on
  a pad nobody holds gives that pad to the player first; another player's pad is ignored.
- **Reset to defaults** is the last row of each column and only affects that player: their
  keyboard set, and the map of the pad they hold.
- **Leave** with `Esc` or B / Circle.

Every change is written to `localStorage` straight away, under
`local-overcooked.bindings.v1` (payload version 2: the keyboard sets, which set each player
holds, a fallback pad map per player, and one map per pad id; version 1 payloads are
migrated on load, each player's old keyboard becoming their set). The saved payload is
validated on load: an older version, a missing action, a value of the wrong type, or two
players on one keyboard set sends the whole payload to the bin and the defaults load
instead. The exception is an action added after the map was saved (throw and dash): a map
without them keeps everything else and gets their defaults. Pad assignments last for the
session only and are never saved.

To wipe the saved bindings by hand, run this in the browser console and reload:

```js
localStorage.removeItem('local-overcooked.bindings.v1');
```

## Known quirks

- **Pads need https or localhost.** Chrome and Firefox return no gamepads on plain http from
  any address other than localhost. `npm start` serves https on port 7778 with a self-signed
  certificate (created with openssl on first start); open that address on the other device
  and accept the certificate warning once. The Controllers screen shows a red notice when the
  page is not a secure context. Without https, the keyboard still works.
- **Chrome hides pads until a button press.** A connected pad reports nothing until the
  page receives input from it. Press a button; do not go hunting for a driver.
- **The page must have focus.** Click the canvas once after switching tabs or windows.
  Without focus the browser delivers neither key events nor pad state and the game looks
  frozen. Losing focus mid-press clears the held keys, so nothing sticks down.
- **Switch Pro controllers** report a non-standard mapping in several browsers. Face
  buttons often arrive rotated, A and B swapped and X and Y with them, because Nintendo's
  physical layout differs from the standard mapping order. Remap pick up and chop from the
  controller screen; button indices are what gets stored, so the remap survives a reload.
- **8BitDo and other retro pads** vary by firmware mode. In X-input mode they behave like
  an Xbox pad. In D-input or Switch mode the indices move around; remap, or switch the pad
  to X-input.
- **A DualShock 4 on Firefox** identifies itself as plain `Wireless Controller`. So does an
  Xbox pad on Chrome, so the Xbox markers in the id are checked first; a pad that says only
  `Wireless Controller` is treated as a PlayStation pad and gets Cross / Square labels.
- **Unknown pads get Xbox labels.** The prompts may not match the printed glyphs, but the
  positions are standard-mapping positions, so button 0 is still the bottom face button.
- **Two identical pads** are told apart by connection order alone. If they land on the
  wrong players, unplug one and reconnect it, or claim it from the controller screen.
- **Safari** wants the pad connected before the page loads more often than the other
  browsers do. Reload after pairing if nothing shows up.
