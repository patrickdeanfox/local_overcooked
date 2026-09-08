# Controls

Two players share one screen. The keyboard drives both player slots at all times and a
gamepad layers on top of it, so the game plays with two pads, one pad, or none.

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
3. **Check it on the controller screen.** Press `C` on the title screen. Each player gets
   a column with the device name and a live view of the stick, d-pad, face buttons and
   keyboard keys. Move the stick and the dot moves with it.

Pads are handed out in connection order: first pad to player 1, second to player 2,
anything beyond that stays unassigned. To place an unassigned pad yourself, open the
controller screen, move the highlight onto the player you want with left/right, and press
any button on that pad.

Unplugging a pad frees its slot at once and leaves that player on the keyboard. Plug it
back in and it takes the first free slot.

## Defaults

### Keyboard

Both keyboard sets are always live, whatever pads are connected.

| Action | Player 1 | Player 2 |
| --- | --- | --- |
| Move | `W` `A` `S` `D` | arrow keys |
| Pick up / put down | `Space` | `Enter` |
| Chop / wash / spray (hold) | `Left Shift` or `Left Ctrl` | `Right Shift` or `Right Ctrl` |
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
| Pause | Start | Options | 9 |
| Menu back | B | Circle | 1 |

The left stick uses a radial deadzone of 0.25 and is renormalised afterwards, so the
usable travel covers a full 0..1 and a diagonal never exceeds full speed. The d-pad
overrides the stick while it is held. Triggers and other analog buttons count as pressed
above 0.5.

Menu back is fixed on `Backspace` and B / Circle. It is the one action you cannot remap,
so a bad binding can never strand you on a screen.

## Remapping

Everything happens on the controller screen (`C` from the title).

- **Move the highlight** with up/down on any device; left/right switches between the
  player 1 and player 2 columns.
- **Rebind an action**: highlight its row and press pick up (`Space`, `Enter`, or A on a
  pad). The row lights up and the next key or button you press becomes the new binding.
  `Esc` cancels without changing anything.
- Keyboard and gamepad bindings are separate. Pressing a key rebinds only the keyboard
  entry for that player; pressing a pad button rebinds only the gamepad entry.
- **Reset to defaults** is the last row of each column and only affects that player.
- **Leave** with `Esc` or B / Circle.

Every change is written to `localStorage` straight away, under
`local-overcooked.bindings.v1`. The saved payload is validated on load: a wrong version, a
missing action, or a value of the wrong type sends the whole payload to the bin and the
defaults load instead. Pad assignments last for the session only and are never saved.

To wipe the saved bindings by hand, run this in the browser console and reload:

```js
localStorage.removeItem('local-overcooked.bindings.v1');
```

## Known quirks

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
