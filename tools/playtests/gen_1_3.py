#!/usr/bin/env python3
"""Generates tools/playtests/04-1-3-sliders-and-mushroom-soup.txt.

1-3 Savoury Seas: the sliding counters in column 6, a mushroom soup made round the open
bottom row, and the 'stack' plate mode. Run from the repository root:
    python3 tools/playtests/gen_1_3.py
"""

L = []


def add(*ls):
    L.extend(ls)


S = "__oc.sim.getState()"
K = {
    0: dict(up='KeyW', down='KeyS', left='KeyA', right='KeyD', pick='Space', act='ShiftLeft'),
    1: dict(up='ArrowUp', down='ArrowDown', left='ArrowLeft', right='ArrowRight', pick='Enter', act='ShiftRight'),
}


def C(ci, a):
    return f"{S}.chefs[{ci}].{a}"


def walk(ci, d, cond, ms=8000):
    return [f"holduntil {K[ci][d]} {ms} {cond}"]


def snap_col(ci, cx):
    return [f"holduntil {K[ci]['left']} 900 {C(ci,'x')} <= {cx}.55",
            f"holduntil {K[ci]['right']} 900 {C(ci,'x')} >= {cx}.45"]


def snap_row(ci, cy):
    return [f"holduntil {K[ci]['up']} 900 {C(ci,'y')} <= {cy}.55",
            f"holduntil {K[ci]['down']} 900 {C(ci,'y')} >= {cy}.45"]


def act_at(ci, d, cx, cy, tx, ty, note):
    out = snap_col(ci, cx) if d in ('up', 'down') else snap_row(ci, cy)
    out += [f"hold {K[ci][d]} 250",
            f"eval ['{note}', 'target', __oc.sim.getTargetTile({ci}), 'want', [{tx},{ty}]]",
            f"tap {K[ci]['pick']}", "wait 250"]
    return out


def fetch_mushroom(dest_x, label):
    """P2: mushroom crate (9,6) round the open bottom row to (dest_x,6), then back."""
    out = [f"# P2: {label} - mushroom crate (9,6) round the bottom row to ({dest_x},6)"]
    out += walk(1, 'right', f"{C(1,'x')} >= 10.45", 6000)
    out += walk(1, 'up', f"{C(1,'y')} <= 5.55", 6000)
    out += walk(1, 'down', f"{C(1,'y')} >= 5.45", 6000)
    out += walk(1, 'left', f"{C(1,'x')} <= 9.55", 6000)
    out += act_at(1, 'down', 9, 5, 9, 6, f"P2 at the mushroom crate for {label}")
    out += [f"eval ['P2 holds', {C(1,'holding')}?.type]"]
    out += walk(1, 'right', f"{C(1,'x')} >= 10.45", 6000)
    out += walk(1, 'down', f"{C(1,'y')} >= 7.4", 6000)
    out += walk(1, 'left', f"{C(1,'x')} <= {dest_x}.55", 9000)
    out += act_at(1, 'up', dest_x, 7, dest_x, 6, f"P2 drops {label}")
    out += [f"eval ['{label} landed', __oc.sim.itemAt({dest_x},6)]",
            "# P2 walks back round the bottom"]
    out += walk(1, 'right', f"{C(1,'x')} >= 10.45", 9000)
    out += walk(1, 'up', f"{C(1,'y')} <= 5.55", 6000)
    return out


def deck_to_kitchen():
    """Row 7 is open deck, but the boards at (2,6) and (4,6) and the counters either side of
    them seal it off: the only way back up on the left is column 0, then row 0."""
    out = ["# P1: back off the open deck - column 0 is the only way up on the left"]
    out += walk(0, 'down', f"{C(0,'y')} >= 7.4", 6000)
    out += walk(0, 'left', f"{C(0,'x')} <= 0.55", 9000)
    out += walk(0, 'up', f"{C(0,'y')} <= 0.6", 9000)
    out += walk(0, 'right', f"{C(0,'x')} >= 2.45", 6000)
    out += walk(0, 'down', f"{C(0,'y')} >= 1.45", 6000)
    return out


def chop_pot(board_x, label):
    """P1: chop what is on board (board_x,6) from above, then into the pot at (3,0)."""
    out = [f"# P1: chop {label} on the board at ({board_x},6), then into the pot at (3,0)"]
    out += walk(0, 'down', f"{C(0,'y')} >= 5.45", 6000)
    out += walk(0, 'left', f"{C(0,'x')} <= {board_x}.55", 7000)
    out += walk(0, 'right', f"{C(0,'x')} >= {board_x}.45", 7000)
    out += snap_row(0, 5)
    out += ["hold KeyS 250",
            f"eval ['P1 at the board', __oc.sim.getTargetTile(0), 'want', [{board_x},6]]",
            "hold ShiftLeft 3400",
            f"eval ['chopped?', __oc.sim.itemAt({board_x},6)]"]
    out += act_at(0, 'down', board_x, 5, board_x, 6, f"P1 lifts the chopped {label}")
    out += [f"eval ['P1 holds', {C(0,'holding')}]"]
    out += walk(0, 'up', f"{C(0,'y')} <= 1.6", 8000)
    out += walk(0, 'right', f"{C(0,'x')} >= 3.45", 6000)
    out += act_at(0, 'up', 3, 1, 3, 0, f"P1 at the burner with {label}")
    out += [f"eval ['pot (3,0)', __oc.sim.itemAt(3,0)]"]
    return out


add("# -- 1-3 Savoury Seas: sliding counters, mushroom soup, plate stack ---------------",
    "# The ship's divider is column 6: slider group 1 covers rows 1-3 and group 2 rows 4-5,",
    "# in opposite phase, so the gap in the divider moves up and down. Row 7 is open deck and",
    "# is always a way round. Plates come off a three-tile stack at (1,2)-(1,4), no sink.",
    "# NOTE: leave >=200 ms between two taps of the same key or the input manager sees one hold.",
    "wait 1600",
    "tap ArrowDown",
    "wait 500",
    "tap ArrowDown",
    "wait 500",
    "tap Enter",
    "wait 1200",
    "until 20000 typeof __oc !== 'undefined' && __oc.level && __oc.sim",
    f"eval ['level', __oc.level.id, 'players', {S}.chefs.length, 'timeLeft', Math.round({S}.timeLeft)]",
    "eval (0, eval)(await (await fetch('/tools/playtests/monitor.txt')).text())",
    "shot 40-1-3-start.png")

# ── 1. the dividers move, in opposite phase ────────────────────────────────
add("# 1. the two slider groups move, in opposite phase")
for _ in range(8):
    add(f"eval ['t', +{S}.elapsed.toFixed(1), 'group 1 offsetY', +__oc.sim.sliderOffset('1').y.toFixed(3), "
        f"'group 2 offsetY', +__oc.sim.sliderOffset('2').y.toFixed(3)]",
        "wait 700")

# ── 2. the gap opens and a chef can cross ─────────────────────────────────
add("# 2. wait for slider group 1 to drop clear of row 1, then walk through the gap and back")
add(*walk(0, 'up', f"{C(0,'y')} <= 1.6", 8000))
add(*walk(0, 'right', f"{C(0,'x')} >= 5.4", 6000))
add(f"eval ['waiting west of the divider at', +{C(0,'x')}.toFixed(3), +{C(0,'y')}.toFixed(3), "
    f"'group 1 offsetY', +__oc.sim.sliderOffset('1').y.toFixed(3)]",
    "until 12000 __oc.sim.sliderOffset('1').y >= 0.85",
    f"eval ['gap open, group 1 offsetY', +__oc.sim.sliderOffset('1').y.toFixed(3)]",
    f"holduntil KeyD 4000 {C(0,'x')} >= 7.4",
    f"eval ['crossed east to', +{C(0,'x')}.toFixed(3), +{C(0,'y')}.toFixed(3)]",
    "shot 42-1-3-crossed-the-gap.png",
    "until 12000 __oc.sim.sliderOffset('1').y >= 0.85",
    f"holduntil KeyA 4000 {C(0,'x')} <= 5.5",
    f"eval ['and back west to', +{C(0,'x')}.toFixed(3), +{C(0,'y')}.toFixed(3)]",
    "eval ['invariants after two crossings', JSON.parse(JSON.stringify(__mon))]")


# ── 3. a chef standing in the divider's path is pushed out of the way ──────
add("# 3. stand in the path of slider group 2 at (6,5) while it sweeps down onto the chef",
    "eval __monReset()",
    "until 12000 __oc.sim.sliderOffset('2').y <= -0.9")
add(*walk(0, 'down', f"{C(0,'y')} >= 5.45", 6000))
add(*walk(0, 'right', f"{C(0,'x')} >= 6.45", 6000))
add(f"eval ['chef parked in the divider column', +{C(0,'x')}.toFixed(3), +{C(0,'y')}.toFixed(3), "
    f"'group 2 offsetY', +__oc.sim.sliderOffset('2').y.toFixed(3)]")
for _ in range(6):
    add(f"eval ['t', +{S}.elapsed.toFixed(1), 'chef', +{C(0,'x')}.toFixed(3), +{C(0,'y')}.toFixed(3), "
        f"'group 2 offsetY', +__oc.sim.sliderOffset('2').y.toFixed(3)]",
        "wait 600")
add("shot 41-1-3-pushed-by-slider.png",
    "eval ['invariants while the divider sweeps', JSON.parse(JSON.stringify(__mon))]")

# ── 4. mushroom soup ──────────────────────────────────────────────────────
add(*deck_to_kitchen())
add("# 4. mushroom soup: three mushrooms chopped and staged before any goes in the pot")
add(*fetch_mushroom(2, "mushroom 1"))
add(*fetch_mushroom(4, "mushroom 2"))
add(*fetch_mushroom(3, "mushroom 3"))
add(*chop_pot(2, "mushroom 1"))
add(*chop_pot(4, "mushroom 2"))
add("# P1: move the spare mushroom off the counter at (3,6) onto the free board at (2,6)")
add(*walk(0, 'down', f"{C(0,'y')} >= 5.45", 6000))
add(*walk(0, 'left', f"{C(0,'x')} <= 3.55", 7000))
add(*walk(0, 'right', f"{C(0,'x')} >= 3.45", 7000))
add(*act_at(0, 'down', 3, 5, 3, 6, "P1 lifts the spare mushroom"))
add(*walk(0, 'left', f"{C(0,'x')} <= 2.55", 5000))
add(*act_at(0, 'down', 2, 5, 2, 6, "P1 puts the mushroom on the board"))
add(*chop_pot(2, "mushroom 3"))

# ── 5. plate off the stack, pour, cross, serve ────────────────────────────
add("# 5. take a plate off the stack at (1,2), pour the soup and serve it at (8,0)")
add(*walk(0, 'down', f"{C(0,'y')} >= 2.45", 5000))
add(*walk(0, 'left', f"{C(0,'x')} <= 2.55", 6000))
add(*act_at(0, 'left', 2, 2, 1, 2, "P1 at the plate stack"))
add(f"eval ['P1 has a plate', {C(0,'holding')}, 'stack tile (1,2) now', __oc.sim.itemAt(1,2)]")
add(*walk(0, 'right', f"{C(0,'x')} >= 3.45", 6000))
add("until 25000 __oc.sim.itemAt(3,0)?.state === 'cooked'",
    f"eval ['pot before pouring', __oc.sim.itemAt(3,0), 'fires', {S}.fires]")
add(*walk(0, 'up', f"{C(0,'y')} <= 1.6", 6000))
add(*act_at(0, 'up', 3, 1, 3, 0, "P1 pours the pot into the plate"))
add(f"eval ['P1 has the mushroom soup', {C(0,'holding')}]")
add(*walk(0, 'right', f"{C(0,'x')} >= 5.4", 6000))
add("until 12000 __oc.sim.sliderOffset('1').y >= 0.85",
    f"holduntil KeyD 4000 {C(0,'x')} >= 7.4")
add(*walk(0, 'right', f"{C(0,'x')} >= 8.45", 6000))
add(f"eval ['orders', {S}.orders.map(o => [o.recipeId, Math.round(o.timeLeft)])]")
add(*act_at(0, 'up', 8, 1, 8, 0, "P1 at the serving hatch"))
add(f"eval ['SERVE mushroom soup', 'score', {S}.score, 'served', {S}.servedCount, "
    f"'failed', {S}.failedCount, 'elapsed', Math.round({S}.elapsed), 'stars', {S}.stars]",
    "shot 43-1-3-after-serve.png")

# ── 6. the plate stack refills after a serve ──────────────────────────────
add("# 6. plates.mode 'stack': a clean plate reappears on the stack a few seconds after a serve",
    f"eval ['pending plate returns', {S}.pendingPlateReturns.map(v => +v.toFixed(1)), 'stack tile (1,2)', __oc.sim.itemAt(1,2)]",
    "until 12000 __oc.sim.itemAt(1,2) !== null",
    "eval ['stack refilled', __oc.sim.itemAt(1,2), 'other stack tiles', __oc.sim.itemAt(1,3), __oc.sim.itemAt(1,4)]",
    "eval ['final invariants', JSON.parse(JSON.stringify(__mon))]",
    "logs",
    "errors")

with open('tools/playtests/04-1-3-sliders-and-mushroom-soup.txt', 'w') as fh:
    fh.write("\n".join(L) + "\n")
print(len(L), "lines")
