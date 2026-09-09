import { describe, expect, it } from 'vitest';
import { fillLabels, goalMet, TutorialRunner, type TutorialProgress } from '../src/game/tutorial';
import { LEVELS } from '../src/levels';
import type { LevelDef, TutorialDef } from '../src/levels/schema';
import { Sim } from '../src/sim';
import { RESTOCK_UNLOAD_SEC, SIM_DT, TRAY_WINDUP_SEC } from '../src/sim/constants';
import {
  NO_INPUT, type Chef, type Facing, type PlateItem, type PlayerInput, type SimEvent, type SimState,
} from '../src/sim/types';

// ─── Helpers ────────────────────────────────────────────────────────────────
// The walkthroughs below drive each tutorial kitchen through the real Sim, built with NO
// modifiers: the level's own `mechanics` block has to switch its mechanic on. Chefs are
// teleported between steps the way the playtest harness does; the buttons are real.

const PLAYERS = 2;

function level(id: string): LevelDef {
  const l = LEVELS[id];
  expect(l, `level ${id} is missing`).toBeTruthy();
  return l;
}

function tutorialOf(id: string): TutorialDef {
  const t = level(id).tutorial;
  expect(t, `${id} has no tutorial`).toBeTruthy();
  return t as TutorialDef;
}

function mutable(sim: Sim): SimState {
  return sim.getState() as SimState;
}

function place(sim: Sim, index: number, x: number, y: number, facing: Facing): Chef {
  const chef = mutable(sim).chefs[index];
  chef.x = x;
  chef.y = y;
  chef.facing = facing;
  return chef;
}

function inp(patch: Partial<PlayerInput>): PlayerInput {
  return { ...NO_INPUT, ...patch };
}

/** A Sim on the tutorial kitchen plus a runner past its rules panel. */
function begin(id: string, players = PLAYERS, seed = 3): { sim: Sim; runner: TutorialRunner; events: SimEvent[] } {
  const sim = new Sim(level(id), { players, seed });
  const runner = new TutorialRunner(tutorialOf(id), players);
  runner.start();
  return { sim, runner, events: [] };
}

interface Drive { sim: Sim; runner: TutorialRunner; events: SimEvent[]; }

/** One stepped frame with the given inputs per chef; the runner sees what the sim reports. */
function frame(d: Drive, inputs: readonly PlayerInput[]): TutorialProgress {
  const events = d.sim.step(inputs, SIM_DT);
  d.events.push(...events);
  return d.runner.observe(d.sim.getState(), events, SIM_DT);
}

function inputsFor(chef: number, patch: Partial<PlayerInput>, players = PLAYERS): PlayerInput[] {
  return Array.from({ length: players }, (_, i) => (i === chef ? inp(patch) : NO_INPUT));
}

function tap(d: Drive, chef: number, patch: Partial<PlayerInput>): TutorialProgress {
  return frame(d, inputsFor(chef, patch, d.sim.getState().chefs.length));
}

/** Runs `seconds` of frames with these inputs; returns the last verdict the runner gave. */
function hold(d: Drive, inputs: readonly PlayerInput[], seconds: number): TutorialProgress {
  let last: TutorialProgress = null;
  const steps = Math.round(seconds / SIM_DT);
  for (let i = 0; i < steps; i++) {
    const verdict = frame(d, inputs);
    if (verdict) last = verdict;
  }
  return last;
}

function idle(d: Drive, seconds: number): TutorialProgress {
  const none = Array.from({ length: d.sim.getState().chefs.length }, () => NO_INPUT);
  return hold(d, none, seconds);
}

function soupPlate(id: number, ingredient: 'onion' | 'tomato'): PlateItem {
  return { kind: 'plate', id, dish: { type: 'soup', ingredients: [ingredient, ingredient, ingredient] } };
}

/** Puts a finished soup in a chef's hands in front of the serve and drops it: the last step of every tutorial. */
function serveSoup(d: Drive, chef: number, x: number, y: number, facing: Facing, ingredient: 'onion' | 'tomato' = 'onion'): TutorialProgress {
  place(d.sim, chef, x, y, facing).holding = soupPlate(9900 + chef, ingredient);
  return tap(d, chef, { pickupPressed: true });
}

function eventCount(d: Drive, type: SimEvent['type']): number {
  return d.events.filter((e) => e.type === type).length;
}

// ─── Text ───────────────────────────────────────────────────────────────────
describe('fillLabels', () => {
  const labelFor = (action: string): string => ({ pickup: 'A', interact: 'X', throw: 'Y', dash: 'B', back: 'Circle' })[action] ?? action;

  it('swaps every placeholder for the player\'s own label', () => {
    expect(fillLabels('Press {pickup}, hold {interact}, {throw} or {dash}. {pickup} again.', labelFor))
      .toBe('Press A, hold X, Y or B. A again.');
  });

  it('leaves unknown braces alone', () => {
    expect(fillLabels('{back} and {nothing}', labelFor)).toBe('{back} and {nothing}');
  });
});

// ─── Runner ─────────────────────────────────────────────────────────────────
describe('TutorialRunner', () => {
  const def: TutorialDef = {
    title: 't',
    intro: ['a'],
    steps: [
      { text: 'one', goal: { type: 'event', event: 'pickup' } },
      { text: 'two', goal: { type: 'event', event: 'pickup' }, minPlayers: 2 },
      { text: 'three', goal: { type: 'wait', sec: 1 } },
    ],
  };
  const state = new Sim(level('tutorial-1-1'), { players: 1, seed: 1 }).getState();

  it('starts on the rules panel and blocks until started', () => {
    const r = new TutorialRunner(def, 2);
    expect(r.phase).toBe('intro');
    expect(r.isBlocking).toBe(true);
    expect(r.current).toBeNull();
    expect(r.observe(state, [{ type: 'pickup' }], SIM_DT)).toBeNull();
    r.start();
    expect(r.phase).toBe('steps');
    expect(r.isBlocking).toBe(false);
    expect(r.current?.text).toBe('one');
    expect(r.describe()).toEqual({ phase: 'steps', step: 1, of: 3 });
  });

  it('drops the steps a smaller party cannot do', () => {
    expect(new TutorialRunner(def, 1).steps.map((s) => s.text)).toEqual(['one', 'three']);
    expect(new TutorialRunner(def, 2).steps.map((s) => s.text)).toEqual(['one', 'two', 'three']);
  });

  it('is done at once when no step is left for the party', () => {
    const r = new TutorialRunner({ ...def, steps: [def.steps[1]] }, 1);
    r.start();
    expect(r.phase).toBe('done');
    expect(r.isActive).toBe(false);
  });

  it('counts events per step and lets one frame finish several steps', () => {
    const r = new TutorialRunner(def, 2);
    r.start();
    expect(r.observe(state, [{ type: 'drop' }], SIM_DT)).toBeNull();
    // Two pickups in one frame: the first finishes step one, the second counts for step two.
    expect(r.observe(state, [{ type: 'pickup' }, { type: 'pickup' }], SIM_DT)).toBe('advanced');
    expect(r.current?.text).toBe('three');
  });

  it('measures a wait in sim seconds from the step\'s own start', () => {
    const r = new TutorialRunner(def, 1);
    r.start();
    expect(r.observe(state, [{ type: 'pickup' }], 5)).toBe('advanced'); // the frame's time is spent on step one
    expect(r.observe(state, [], 0.5)).toBeNull();
    expect(r.observe(state, [], 0.5)).toBe('completed');
    expect(r.phase).toBe('done');
    expect(r.observe(state, [], 1)).toBeNull();
  });

  it('can be skipped from the panel or mid-way, and then does nothing', () => {
    const a = new TutorialRunner(def, 1);
    a.skip();
    expect(a.phase).toBe('skipped');
    a.start();
    expect(a.phase).toBe('skipped');
    const b = new TutorialRunner(def, 1);
    b.start();
    b.skip();
    expect(b.isActive).toBe(false);
    expect(b.observe(state, [{ type: 'pickup' }], SIM_DT)).toBeNull();
  });
});

describe('goalMet', () => {
  const sim = new Sim(level('tutorial-1-3'), { players: 2, seed: 1 });
  const state = mutable(sim);
  const none = { events: 0, waited: 0 };

  it('reads what a chef holds, how many plates and where it stands', () => {
    state.chefs[0].holding = { kind: 'plate', id: 1, dish: null, count: 2 };
    expect(goalMet({ type: 'holding', kind: 'plate' }, state, none)).toBe(true);
    expect(goalMet({ type: 'holding', kind: 'plate', count: 2 }, state, none)).toBe(true);
    expect(goalMet({ type: 'holding', kind: 'plate', count: 1 }, state, none)).toBe(false);
    expect(goalMet({ type: 'holding', kind: 'tray' }, state, none)).toBe(false);
    const zone = { x: 0, y: 0, w: 2, h: 2 };
    expect(goalMet({ type: 'holding', kind: 'plate', zone }, state, none)).toBe(false);
    state.chefs[0].x = 1.5;
    state.chefs[0].y = 1.5;
    expect(goalMet({ type: 'holding', kind: 'plate', zone }, state, none)).toBe(true);
  });

  it('reads a tray\'s load', () => {
    state.chefs[1].holding = { kind: 'tray', id: 2, items: [{ kind: 'ingredient', id: 3, type: 'onion', chopped: false, chopProgress: 0 }] };
    expect(goalMet({ type: 'holding', kind: 'tray', load: 1 }, state, none)).toBe(true);
    expect(goalMet({ type: 'holding', kind: 'tray', load: 3 }, state, none)).toBe(false);
  });

  it('reads items on a tile or a block of tiles', () => {
    expect(goalMet({ type: 'tileItem', x: 0, y: 1, kind: 'plate' }, state, none)).toBe(true);
    expect(goalMet({ type: 'tileItem', x: 1, y: 1, kind: 'plate' }, state, none)).toBe(false);
    expect(goalMet({ type: 'tileItem', x: 1, y: 0, w: 4, h: 2, kind: 'plate' }, state, none)).toBe(false);
    expect(goalMet({ type: 'tileItem', x: 0, y: 0, w: 2, h: 2, kind: 'plate' }, state, none)).toBe(true);
  });

  it('reads crate stock, serves, assists and waits', () => {
    expect(goalMet({ type: 'stock', x: 1, y: 0, max: 0 }, state, none)).toBe(false); // no 86 here: bottomless
    state.tiles[1].stock = 0;
    expect(goalMet({ type: 'stock', x: 1, y: 0, max: 0 }, state, none)).toBe(true);
    expect(goalMet({ type: 'served', count: 1 }, state, none)).toBe(false);
    state.servedCount = 1;
    expect(goalMet({ type: 'served', count: 1 }, state, none)).toBe(true);
    expect(goalMet({ type: 'assisting' }, state, none)).toBe(false);
    state.chefs[1].assisting = true;
    expect(goalMet({ type: 'assisting' }, state, none)).toBe(true);
    expect(goalMet({ type: 'wait', sec: 2 }, state, { events: 0, waited: 1.9 })).toBe(false);
    expect(goalMet({ type: 'wait', sec: 2 }, state, { events: 0, waited: 2 })).toBe(true);
    expect(goalMet({ type: 'event', event: 'serve', count: 2 }, state, { events: 1, waited: 0 })).toBe(false);
    expect(goalMet({ type: 'event', event: 'serve' }, state, { events: 1, waited: 0 })).toBe(true);
  });
});

// ─── Walkthroughs ───────────────────────────────────────────────────────────
describe('tutorial walkthroughs', () => {
  it('every tutorial kitchen forces its mechanic on without any modifier', () => {
    const on = (id: string): Record<string, boolean> => {
      const e = new Sim(level(id), { players: 1, seed: 1 }).getEffectiveSettings();
      return { passThroughShelf: e.passThroughShelf, chopAssist: e.chopAssist, twoPlateCarry: e.twoPlateCarry, eightySix: e.eightySix, tray: e.tray };
    };
    expect(on('tutorial-1-1')).toEqual({ passThroughShelf: true, chopAssist: false, twoPlateCarry: false, eightySix: false, tray: false });
    expect(on('tutorial-1-2')).toEqual({ passThroughShelf: false, chopAssist: true, twoPlateCarry: false, eightySix: false, tray: false });
    expect(on('tutorial-1-3')).toEqual({ passThroughShelf: false, chopAssist: false, twoPlateCarry: true, eightySix: false, tray: false });
    expect(on('tutorial-1-4')).toEqual({ passThroughShelf: false, chopAssist: false, twoPlateCarry: false, eightySix: true, tray: false });
    expect(on('tutorial-1-5')).toEqual({ passThroughShelf: false, chopAssist: false, twoPlateCarry: false, eightySix: false, tray: true });
    // The switch stays additive: a run with every mechanic on keeps them on.
    const all = new Sim(level('tutorial-1-1'), { players: 1, seed: 1, modifiers: { tray: true } }).getEffectiveSettings();
    expect(all.tray).toBe(true);
    expect(all.passThroughShelf).toBe(true);
  });

  it('every tutorial kitchen starts in prep with its clock stopped', () => {
    for (const id of ['tutorial-1-1', 'tutorial-1-2', 'tutorial-1-3', 'tutorial-1-4', 'tutorial-1-5']) {
      const st = new Sim(level(id), { players: 2, seed: 1 }).getState();
      expect(st.phase).toBe('prep');
      expect(st.timerRunning).toBe(false);
    }
  });

  it('pass-through shelf: an onion crosses the hatch and the soup serves', () => {
    const d = begin('tutorial-1-1');
    // 1: take an onion from the crate at (1,0).
    place(d.sim, 0, 1.5, 1.5, 'up');
    expect(tap(d, 0, { pickupPressed: true })).toBe('advanced');
    expect(d.runner.stepNumber).toBe(2);
    // 2: onto the middle hatch (5,2) from the left room.
    place(d.sim, 0, 4.5, 2.5, 'right');
    expect(tap(d, 0, { pickupPressed: true })).toBe('advanced');
    expect(d.sim.itemAt(5, 2)?.kind).toBe('ingredient');
    // 3: the partner takes it from the right room; taking it back from the left would not count.
    place(d.sim, 1, 6.5, 2.5, 'left');
    expect(tap(d, 1, { pickupPressed: true })).toBe('advanced');
    expect(d.sim.getState().chefs[1].holding?.kind).toBe('ingredient');
    expect(d.runner.stepNumber).toBe(4);
    // 4: serve at (11,1).
    expect(serveSoup(d, 1, 10.5, 1.5, 'right')).toBe('completed');
    expect(d.runner.phase).toBe('done');
    expect(d.sim.getState().phase).toBe('running');
    expect(d.sim.getState().servedCount).toBe(1);
  });

  it('chop assist: both chefs at one board earn the x2, then the soup serves', () => {
    const d = begin('tutorial-1-2');
    // 1: an onion onto a board (3,5).
    place(d.sim, 0, 1.5, 1.5, 'up');
    expect(tap(d, 0, { pickupPressed: true })).toBeNull();
    place(d.sim, 0, 3.5, 4.5, 'down');
    expect(tap(d, 0, { pickupPressed: true })).toBe('advanced');
    // 2: both chefs hold the work button at that board.
    place(d.sim, 0, 3.15, 4.5, 'down');
    place(d.sim, 1, 3.85, 4.5, 'down');
    const both = [inp({ interactHeld: true, interactPressed: true }), inp({ interactHeld: true, interactPressed: true })];
    expect(hold(d, both, 0.2)).toBe('advanced');
    expect(d.runner.current?.text).toMatch(/Finish the chop/);
    // 3: keep chopping until it is done: two chefs finish well inside the solo time.
    expect(hold(d, both, 2)).toBe('advanced');
    expect(eventCount(d, 'chopDone')).toBe(1);
    // 4: serve at (9,1).
    expect(serveSoup(d, 0, 8.5, 1.5, 'right')).toBe('completed');
  });

  it('chop assist alone: the assist step is skipped and the rest still plays', () => {
    const d = begin('tutorial-1-2', 1);
    expect(d.runner.stepCount).toBe(3);
    place(d.sim, 0, 1.5, 1.5, 'up');
    tap(d, 0, { pickupPressed: true });
    place(d.sim, 0, 3.5, 4.5, 'down');
    expect(tap(d, 0, { pickupPressed: true })).toBe('advanced');
    expect(d.runner.current?.text).toMatch(/Finish the chop/);
    expect(hold(d, [inp({ interactHeld: true, interactPressed: true })], 3.5)).toBe('advanced');
    expect(serveSoup(d, 0, 8.5, 1.5, 'right')).toBe('completed');
  });

  it('two-plate carry: a second plate from the other stack, one put down, then a serve', () => {
    const d = begin('tutorial-1-3');
    // 1: a plate from the stack at (0,1).
    place(d.sim, 0, 1.5, 1.5, 'left');
    expect(tap(d, 0, { pickupPressed: true })).toBe('advanced');
    // 2: a second from the stack at (0,2).
    place(d.sim, 0, 1.5, 2.5, 'left');
    expect(tap(d, 0, { pickupPressed: true })).toBe('advanced');
    expect((d.sim.getState().chefs[0].holding as PlateItem).count).toBe(2);
    // 3: no dash with two; one plate down on the counter at (2,0).
    place(d.sim, 0, 2.5, 1.5, 'up');
    expect(tap(d, 0, { dashPressed: true })).toBeNull();
    expect(d.sim.getState().chefs[0].action).not.toBe('dashing');
    expect(tap(d, 0, { pickupPressed: true })).toBe('advanced');
    expect(d.sim.itemAt(2, 0)?.kind).toBe('plate');
    expect((d.sim.getState().chefs[0].holding as PlateItem).count ?? 1).toBe(1);
    // 4: serve at (10,1).
    expect(serveSoup(d, 0, 9.5, 1.5, 'right')).toBe('completed');
  });

  it('the 86 system: the tomato crate empties, the ticket rewrites, the delivery restocks, the old dish still serves', () => {
    const d = begin('tutorial-1-4');
    expect(d.sim.getState().orders.map((o) => o.recipeId)).toEqual(['tomato_soup', 'onion_soup']);
    expect(d.sim.tileAt(2, 0)).toMatchObject({ stock: 3, capacity: 3 });
    // 1: three tomatoes out of the crate at (2,0), hands emptied between takes.
    place(d.sim, 0, 2.5, 1.5, 'up');
    expect(tap(d, 0, { pickupPressed: true })).toBeNull();
    mutable(d.sim).chefs[0].holding = null;
    expect(tap(d, 0, { pickupPressed: true })).toBeNull();
    mutable(d.sim).chefs[0].holding = null;
    expect(tap(d, 0, { pickupPressed: true })).toBe('advanced');
    expect(d.sim.tileAt(2, 0)?.stock).toBe(0);
    expect(eventCount(d, 'crateEmpty')).toBe(1);
    expect(eventCount(d, 'orderRewritten')).toBe(1);
    expect(d.sim.getState().orders[0]).toMatchObject({ recipeId: 'onion_soup', originalRecipeId: 'tomato_soup' });
    // 2: a beat to read the rewrite.
    expect(d.runner.current?.goal).toEqual({ type: 'wait', sec: 6 });
    expect(idle(d, 5.5)).toBeNull();
    expect(idle(d, 0.7)).toBe('advanced');
    // 3: the delivery arrives at the door (4,0) and is unloaded with a held work button.
    expect(idle(d, 12.5)).toBeNull();
    expect(eventCount(d, 'restockDue')).toBe(1);
    mutable(d.sim).chefs[0].holding = null;
    place(d.sim, 0, 4.5, 1.5, 'up');
    expect(hold(d, inputsFor(0, { interactHeld: true, interactPressed: true }), RESTOCK_UNLOAD_SEC + 0.3)).toBe('advanced');
    expect(eventCount(d, 'restocked')).toBe(1);
    expect(d.sim.tileAt(2, 0)?.stock).toBe(3);
    // 4: the tomato soup the old ticket asked for still serves and pays.
    expect(serveSoup(d, 0, 9.5, 1.5, 'right', 'tomato')).toBe('completed');
    expect(d.sim.getState().score).toBeGreaterThan(0);
  });

  it('the tray: lifted, loaded with three onions, unloaded onto the board, set down, then a serve', () => {
    const d = begin('tutorial-1-5');
    expect(d.sim.itemAt(5, 4)?.kind).toBe('tray');
    // 1: lift from the rack at (5,4).
    place(d.sim, 0, 5.5, 3.5, 'down');
    expect(tap(d, 0, { interactPressed: true })).toBeNull();
    expect(d.sim.getState().chefs[0].action).toBe('lifting');
    expect(idle(d, TRAY_WINDUP_SEC + 0.1)).toBe('advanced');
    expect(d.sim.getState().chefs[0].holding?.kind).toBe('tray');
    // 2: three onions from the crate at (1,0).
    place(d.sim, 0, 1.5, 1.5, 'up');
    expect(tap(d, 0, { pickupPressed: true })).toBeNull();
    expect(tap(d, 0, { pickupPressed: true })).toBeNull();
    expect(tap(d, 0, { pickupPressed: true })).toBe('advanced');
    // 3: the top onion onto the board at (9,0).
    place(d.sim, 0, 9.5, 1.5, 'up');
    expect(tap(d, 0, { pickupPressed: true })).toBe('advanced');
    expect(d.sim.itemAt(9, 0)?.kind).toBe('ingredient');
    // 4: set the tray down on the counter at (3,4).
    place(d.sim, 0, 3.5, 3.5, 'down');
    expect(tap(d, 0, { interactPressed: true })).toBeNull();
    expect(idle(d, TRAY_WINDUP_SEC + 0.1)).toBe('advanced');
    expect(d.sim.itemAt(3, 4)?.kind).toBe('tray');
    expect(eventCount(d, 'traySet')).toBe(1);
    // 5: serve at (12,1).
    expect(serveSoup(d, 0, 11.5, 1.5, 'right')).toBe('completed');
  });
});
