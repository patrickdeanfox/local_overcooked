#!/usr/bin/env python3
"""Generates tools/playtests/03-1-2-two-soups.txt.

The 1-2 route blocks repeat six times with only the crate, board and burner changing,
so they are generated rather than hand-copied. Run from the repository root:
    python3 tools/playtests/gen_1_2.py
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
    """Snap onto the approach tile (cx,cy), face `d`, report the target, press pick up/drop."""
    out = snap_col(ci, cx) if d in ('up', 'down') else snap_row(ci, cy)
    out += [f"hold {K[ci][d]} 250",
            f"eval ['{note}', 'target', __oc.sim.getTargetTile({ci}), 'want', [{tx},{ty}]]",
            f"tap {K[ci]['pick']}", "wait 250"]
    return out


GAP6 = ("until 15000 !%s.pedestrians.some(p => p.x === 6.5 && p.y < 4)" % S)


def deliver(crate_x, dest_x, dest_y, label):
    """P2 fetches one ingredient and carries it across the crossing to (dest_x,dest_y)."""
    out = [f"# P2: {label} - crate ({crate_x},5) across the crossing to ({dest_x},{dest_y})",
           "# re-home first: whatever happened last time, get back to the right half"]
    out += walk(1, 'right', f"{C(1,'x')} >= 6.45", 9000)
    out += [GAP6]
    out += walk(1, 'up', f"{C(1,'y')} <= 1.6", 15000)
    out += walk(1, 'right', f"{C(1,'x')} >= 11.45", 15000)
    if crate_x == 10:
        out += walk(1, 'left', f"{C(1,'x')} <= 10.55", 5000)
    else:
        out += walk(1, 'right', f"{C(1,'x')} >= {crate_x}.45", 5000)
    out += walk(1, 'down', f"{C(1,'y')} >= 4.5", 5000)
    out += act_at(1, 'down', crate_x, 4, crate_x, 5, f"P2 at the crate for {label}")
    out += [f"eval ['P2 holds', {C(1,'holding')}?.type]"]
    out += walk(1, 'up', f"{C(1,'y')} <= 1.6", 8000)
    out += walk(1, 'left', f"{C(1,'x')} <= 6.55", 15000)
    out += [GAP6]
    out += walk(1, 'down', f"{C(1,'y')} >= 3.5", 15000)
    out += walk(1, 'left', f"{C(1,'x')} <= {dest_x}.55", 9000)
    out += walk(1, 'down', f"{C(1,'y')} >= {dest_y-1}.6", 5000)
    out += act_at(1, 'down', dest_x, dest_y - 1, dest_x, dest_y, f"P2 drops {label}")
    out += [f"eval ['{label} landed', __oc.sim.itemAt({dest_x},{dest_y})]",
            "# P2 walks back to the right half"]
    out += walk(1, 'up', f"{C(1,'y')} <= 3.55", 5000)
    out += walk(1, 'right', f"{C(1,'x')} >= 6.45", 9000)
    out += [GAP6]
    out += walk(1, 'up', f"{C(1,'y')} <= 1.6", 15000)
    out += walk(1, 'right', f"{C(1,'x')} >= 11.45", 15000)
    # park off row 1: the gap at (9,1) is one tile wide, and a chef left standing in it
    # blocks the other chef completely - two chefs cannot pass each other there.
    out += walk(1, 'down', f"{C(1,'y')} >= 3.5", 6000)
    return out


def chop_pot(board_x, stove_x, label):
    """P1 chops whatever is on board (board_x,5) and drops it in the pot at (stove_x,0)."""
    out = [f"# P1: chop {label} on the board at ({board_x},5), then into the pot at ({stove_x},0)"]
    out += walk(0, 'down', f"{C(0,'y')} >= 3.5", 5000)
    out += walk(0, 'left', f"{C(0,'x')} <= {board_x}.55", 7000)
    out += walk(0, 'right', f"{C(0,'x')} >= {board_x}.45", 7000)
    out += walk(0, 'down', f"{C(0,'y')} >= 4.6", 5000)
    out += snap_col(0, board_x)
    out += ["hold KeyS 250",
            f"eval ['P1 at the board', __oc.sim.getTargetTile(0), 'want', [{board_x},5]]",
            "hold ShiftLeft 3400",
            f"eval ['chopped?', __oc.sim.itemAt({board_x},5)]"]
    out += act_at(0, 'down', board_x, 4, board_x, 5, f"P1 lifts the chopped {label}")
    out += [f"eval ['P1 holds', {C(0,'holding')}]"]
    out += walk(0, 'up', f"{C(0,'y')} <= 1.6", 6000)
    out += act_at(0, 'up', stove_x, 1, stove_x, 0, f"P1 at the burner with {label}")
    out += [f"eval ['pot ({stove_x},0)', __oc.sim.itemAt({stove_x},0)]"]
    return out


def stage_third(board_x, label):
    """The third ingredient waits raw on the counter at (1,5): move it onto the free board."""
    out = [f"# P1: move the spare {label} off the counter at (1,5) onto the board at ({board_x},5)"]
    out += walk(0, 'down', f"{C(0,'y')} >= 3.5", 5000)
    out += walk(0, 'left', f"{C(0,'x')} <= 1.55", 7000)
    out += walk(0, 'right', f"{C(0,'x')} >= 1.45", 7000)
    out += walk(0, 'down', f"{C(0,'y')} >= 4.6", 5000)
    out += act_at(0, 'down', 1, 4, 1, 5, f"P1 lifts the spare {label}")
    out += walk(0, 'right', f"{C(0,'x')} >= {board_x}.45", 5000)
    out += act_at(0, 'down', board_x, 4, board_x, 5, f"P1 puts {label} on the board")
    return out


def deliver_plate(dest_x, dest_y):
    """P2 ferries the second clean plate from the counter at (9,2) into the left kitchen.

    (9,2) can only be reached from (10,2) on the right or (8,2) inside pedestrian lane 8, so
    the plate has to be carried across rather than handed over the counter."""
    out = ["# P2: carry the second clean plate from (9,2) over to the left half"]
    out += walk(1, 'right', f"{C(1,'x')} >= 6.45", 9000)
    out += [GAP6]
    out += walk(1, 'up', f"{C(1,'y')} <= 1.6", 15000)
    out += walk(1, 'right', f"{C(1,'x')} >= 10.45", 15000)
    out += walk(1, 'down', f"{C(1,'y')} >= 2.45", 5000)
    out += act_at(1, 'left', 10, 2, 9, 2, "P2 at the plate counter")
    out += [f"eval ['P2 holds the plate', {C(1,'holding')}]"]
    out += walk(1, 'up', f"{C(1,'y')} <= 1.6", 8000)
    out += walk(1, 'left', f"{C(1,'x')} <= 6.55", 15000)
    out += [GAP6]
    out += walk(1, 'down', f"{C(1,'y')} >= 3.5", 15000)
    out += walk(1, 'left', f"{C(1,'x')} <= {dest_x}.55", 9000)
    out += walk(1, 'down', f"{C(1,'y')} >= {dest_y-1}.6", 5000)
    out += act_at(1, 'down', dest_x, dest_y - 1, dest_x, dest_y, "P2 drops the plate")
    out += [f"eval ['plate waiting on ({dest_x},{dest_y})', __oc.sim.itemAt({dest_x},{dest_y})]"]
    out += walk(1, 'up', f"{C(1,'y')} <= 3.55", 5000)
    out += walk(1, 'right', f"{C(1,'x')} >= 6.45", 9000)
    out += [GAP6]
    out += walk(1, 'up', f"{C(1,'y')} <= 1.6", 15000)
    out += walk(1, 'right', f"{C(1,'x')} >= 11.45", 15000)
    out += walk(1, 'down', f"{C(1,'y')} >= 3.5", 6000)
    return out


def plate_and_serve(stove_x, plate_route, plate_dir, ax, ay, tx, ty, n, dish, slug):
    out = [f"# P1: plate the {dish} off the burner at ({stove_x},0) and serve it at (15,1)"]
    out += plate_route
    out += act_at(0, plate_dir, ax, ay, tx, ty, "P1 at the plate counter")
    out += [f"eval ['P1 has a plate', {C(0,'holding')}]"]
    out += walk(0, 'left', f"{C(0,'x')} <= {stove_x}.55", 6000)
    out += [f"until 25000 __oc.sim.itemAt({stove_x},0)?.state === 'cooked'",
            f"eval ['pot before pouring', __oc.sim.itemAt({stove_x},0), 'fires', {S}.fires]"]
    out += walk(0, 'up', f"{C(0,'y')} <= 1.6", 5000)
    out += act_at(0, 'up', stove_x, 1, stove_x, 0, "P1 pours the pot into the plate")
    out += [f"eval ['P1 has the {dish}', {C(0,'holding')}]",
            f"shot 3{n}-1-2-{slug}-plated.png",
            "# carry it across the crossing to the serving hatch"]
    out += walk(0, 'down', f"{C(0,'y')} >= 3.5", 5000)
    out += walk(0, 'right', f"{C(0,'x')} >= 6.45", 9000)
    out += [GAP6]
    out += walk(0, 'up', f"{C(0,'y')} <= 1.6", 15000)
    out += walk(0, 'right', f"{C(0,'x')} >= 14.45", 15000)
    out += [f"eval ['orders', {S}.orders.map(o => [o.recipeId, Math.round(o.timeLeft)])]"]
    out += act_at(0, 'right', 14, 1, 15, 1, "P1 at the serving hatch")
    out += [f"eval ['SERVE {n} {dish}', 'score', {S}.score, 'served', {S}.servedCount, "
            f"'failed', {S}.failedCount, 'elapsed', Math.round({S}.elapsed), "
            f"'timeLeft', Math.round({S}.timeLeft), 'stars', {S}.stars]",
            f"shot 3{n}-1-2-after-serve-{n}.png",
            "# P1 walks back to the left half: row 3 is walled off at (9,3), so the only way",
            "# home is back along row 1 and down the crossing."]
    out += walk(0, 'left', f"{C(0,'x')} <= 6.55", 15000)
    out += [GAP6]
    out += walk(0, 'down', f"{C(0,'y')} >= 3.5", 15000)
    out += walk(0, 'left', f"{C(0,'x')} <= 4.55", 9000)
    return out


add("# -- 1-2 Treacle Town: a tomato soup and an onion soup across the crosswalk --------",
    "# Every ingredient box sits on the right of the crossing and every cooker on the left,",
    "# and the only gap through the counters is (9,1), so each ingredient costs a full",
    "# crossing. P2 (arrows) fetches and crosses, P1 (WASD) chops, cooks, plates and serves.",
    "#",
    "# Two things this script had to be built around, both worth knowing:",
    "#  * handing items over the counter at (9,2) is unreliable - that tile can only be",
    "#    reached from (8,2), which is inside pedestrian lane 8, and a walker shoves the chef",
    "#    off the tile mid-press. Carrying items across is the workable play.",
    "#  * all three ingredients are chopped and staged BEFORE any go in the pot. Feed the pot",
    "#    one ingredient per crossing and it reaches 'cooked' with one or two in it, then",
    "#    burns and catches fire while the next one is still being fetched.",
    "# NOTE: leave >=200 ms between two taps of the same key or the input manager sees one hold.",
    "wait 1200",
    "tap ArrowDown",
    "wait 400",
    "tap Enter",
    "wait 800",
    "until 20000 typeof __oc !== 'undefined' && __oc.level && __oc.sim",
    f"eval ['level', __oc.level.id, 'timeLeft', Math.round({S}.timeLeft)]",
    "eval (0, eval)(await (await fetch('/tools/playtests/monitor.txt')).text())")

add(*deliver(10, 2, 5, "tomato 1"))
add(*deliver(10, 4, 5, "tomato 2"))
add(*deliver(10, 1, 5, "tomato 3"))
add(*chop_pot(2, 2, "tomato 1"))
add(*chop_pot(4, 2, "tomato 2"))
add(*stage_third(2, "tomato 3"))
add(*chop_pot(2, 2, "tomato 3"))
ROUTE_PLATE_5_2 = (walk(0, 'down', f"{C(0,'y')} >= 2.5", 5000)
                   + walk(0, 'right', f"{C(0,'x')} >= 4.45", 6000))
add(*plate_and_serve(2, ROUTE_PLATE_5_2, 'right', 4, 2, 5, 2, 1, "tomato soup", "tomato"))

add("# The script drives one chef at a time, so it is far slower than two humans playing.",
    "# Top the clock back up so the second recipe still gets exercised. The elapsed readings",
    "# either side of this line are what the tuning notes in docs/LEVELS.md use.",
    f"eval ({S}.timeLeft = 240, 'clock topped up')",
    f"eval ['onion soup starts at elapsed', Math.round({S}.elapsed)]")

add(*deliver(12, 2, 5, "onion 1"))
add(*deliver(12, 4, 5, "onion 2"))
add(*deliver(12, 1, 5, "onion 3"))
add(*deliver_plate(3, 5))
add(*chop_pot(2, 4, "onion 1"))
add(*chop_pot(4, 4, "onion 2"))
add(*stage_third(2, "onion 3"))
add(*chop_pot(2, 4, "onion 3"))
ROUTE_PLATE_3_5 = (walk(0, 'down', f"{C(0,'y')} >= 3.5", 5000)
                   + walk(0, 'left', f"{C(0,'x')} <= 3.55", 7000)
                   + walk(0, 'right', f"{C(0,'x')} >= 3.45", 7000)
                   + walk(0, 'down', f"{C(0,'y')} >= 4.6", 5000))
add(*plate_and_serve(4, ROUTE_PLATE_3_5, 'down', 3, 4, 3, 5, 2, "onion soup", "onion"))

add("eval ['both burners', __oc.sim.itemAt(2,0), __oc.sim.itemAt(4,0)]",
    "eval ['invariants', JSON.parse(JSON.stringify(__mon))]",
    "logs",
    "errors")

with open('tools/playtests/03-1-2-two-soups.txt', 'w') as fh:
    fh.write("\n".join(L) + "\n")
print(len(L), "lines")
