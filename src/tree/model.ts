import { HOUR, SECOND, fmtPacificWeekdayDay, pacificMidnights } from '../lib/time';
import type { Outcome, TreeData, TreeIssue, TreeTotals } from './types';

/*
 * The hero tree, as pure functions of its data: the units and who each grew from (buildTree), and
 * where each is drawn at a given size (layout). The y axis is exact time, top to bottom; a branch
 * leaves its parent at an angle and then runs straight down to its merge, close or the #1.
 */

export const EDGE_WINDOW = 300;
/** Seconds between the points a branch is drawn and hit-tested through. */
export const STEP = 900;
const HOUR_S = HOUR / SECOND;

export interface Unit {
  index: number;
  kind: 'thread' | 'issue';
  /** A thread's name, or an issue's number. */
  name: string;
  number: number | null;
  s: number;
  e: number;
  /** The unit it grew from; -1 for a root. */
  parent: number;
  by: string;
  outcome: Outcome | null;
  after: TreeIssue['after'] | null;
  /** Agent messages to or from it, by hour from t0. */
  hours: ReadonlyMap<number, number>;
}

/** Messages from unit a to unit b in one five-minute window, drawn at t. */
export interface Edge {
  a: number;
  b: number;
  t: number;
  n: number;
}

export interface Tick {
  u: number;
  t: number;
}

export interface Tree {
  t0: number;
  cut: number;
  /** Seconds from t0 to the cut. */
  span: number;
  totals: TreeTotals;
  units: Unit[];
  /** Each unit's children, earliest first. */
  children: number[][];
  /** Units in each unit's subtree, itself included. */
  weight: number[];
  roots: number[];
  threads: number[];
  edges: Edge[];
  problems: Tick[];
}

function hourMap(a: readonly number[]): Map<number, number> {
  const m = new Map<number, number>();
  for (let k = 0; k + 1 < a.length; k += 2) m.set(a[k]!, a[k + 1]!);
  return m;
}

export function buildTree(data: TreeData): Tree {
  const span = data.cut - data.t0;
  const units: Unit[] = [];
  const threadIndex = new Map<string, number>();
  const issueIndex = new Map<number, number>();
  const parentOf = (p: string | number | null, who: string): number => {
    if (p === null) return -1;
    const i = typeof p === 'number' ? issueIndex.get(p) : threadIndex.get(p);
    if (i === undefined) throw new Error(`tree: ${who} grows from ${p}, which is not an earlier unit`);
    return i;
  };
  for (const t of data.threads) {
    const index = units.length;
    units.push({
      index,
      kind: 'thread',
      name: t.name,
      number: null,
      s: t.s,
      e: span,
      parent: parentOf(t.p, t.name),
      by: t.by,
      outcome: null,
      after: null,
      hours: hourMap(t.a),
    });
    threadIndex.set(t.name, index);
  }
  for (const i of data.issues) {
    const index = units.length;
    units.push({
      index,
      kind: 'issue',
      name: `rs/${i.n}`,
      number: i.n,
      s: i.s,
      e: i.e,
      parent: parentOf(i.p, `rs/${i.n}`),
      by: i.by,
      outcome: i.o,
      after: i.after ?? null,
      hours: hourMap(i.a),
    });
    issueIndex.set(i.n, index);
  }

  const children: number[][] = units.map(() => []);
  for (const u of units) if (u.parent >= 0) children[u.parent]!.push(u.index);
  for (const c of children) c.sort((a, b) => units[a]!.s - units[b]!.s || a - b);
  // A parent always precedes its children, so one backward pass sums every subtree.
  const weight = units.map(() => 1);
  for (let i = units.length - 1; i >= 0; i--) {
    const p = units[i]!.parent;
    if (p >= 0) weight[p]! += weight[i]!;
  }

  const edges: Edge[] = [];
  let window = 0;
  for (const [a, b, dw, n] of data.edges) {
    window += dw;
    const ua = units[a]!;
    const ub = units[b]!;
    // The window's middle, kept inside both lives (the messages themselves are).
    const lo = Math.max(ua.s, ub.s, window * EDGE_WINDOW);
    const hi = Math.min(ua.e, ub.e, window * EDGE_WINDOW + EDGE_WINDOW - 1);
    const t = Math.min(hi, Math.max(lo, window * EDGE_WINDOW + EDGE_WINDOW / 2));
    edges.push({ a, b, t, n });
  }

  const problems: Tick[] = [];
  let t = 0;
  for (const [u, dt] of data.problems) {
    t += dt;
    problems.push({ u, t });
  }

  return {
    t0: data.t0,
    cut: data.cut,
    span,
    totals: data.totals,
    units,
    children,
    weight,
    roots: units.filter((u) => u.parent < 0).map((u) => u.index),
    threads: units.filter((u) => u.kind === 'thread').map((u) => u.index),
    edges,
    problems,
  };
}

// ---------------------------------------------------------------------------

export interface LayoutOptions {
  width: number;
  height: number;
  /** The phone's half-height figure: narrower margins, thinner marks. */
  compact: boolean;
  /** The side the day labels take: the left, or the right when the story's title is beside the figure's left. */
  axis: 'left' | 'right';
}

/** How a branch reaches its slot: from x0 at y0, easing out to x1 over `reach` pixels of height. */
export interface Limb {
  x0: number;
  x1: number;
  y0: number;
  reach: number;
}

export interface Band {
  root: number;
  x0: number;
  x1: number;
}

/** A thread's name: at x, with its baseline at y, set to one side of x or centred on it. */
export interface ThreadLabel {
  unit: number;
  text: string;
  x: number;
  y: number;
  side: 'left' | 'right' | 'centre';
}

export interface DayLabel {
  /** Seconds from t0. */
  t: number;
  y: number;
  label: string;
  /** A Pacific midnight, ruled; the root's day is labelled without a rule. */
  rule: boolean;
}

/** A branch's drawn points: x, y pairs every STEP seconds and at its end, with each segment's hour count. */
export interface BranchPath {
  xy: Float64Array;
  /** Messages in the hour each segment ends in; one fewer than the points. */
  counts: Uint16Array;
}

export interface Layout {
  width: number;
  height: number;
  compact: boolean;
  axis: 'left' | 'right';
  /** The margins the branches keep clear; the day labels sit in the one on the axis's side. */
  left: number;
  right: number;
  top: number;
  bottom: number;
  bands: Band[];
  /** Each unit's lateral slot. */
  slot: number[];
  limbs: Limb[];
  paths: BranchPath[];
  labels: ThreadLabel[];
  days: DayLabel[];
  y(t: number): number;
  tAt(y: number): number;
  xAt(unit: number, t: number): number;
}

/** Lateral reach: a branch may drift this many pixels plus LAT_PER_PX per pixel it lives, plus its subtree's share. */
const LAT0 = 6;
const LAT_PER_PX = 0.9;
/** A branch reaches its slot over this many times its lateral distance. */
const LEAN = 2.2;
/** No root band narrower than this share of the units. */
const BAND_FLOOR = 0.03;

export function layout(tree: Tree, { width, height, compact, axis }: LayoutOptions): Layout {
  const gutter = compact ? 40 : 52;
  const edge = compact ? 4 : 10;
  const left = axis === 'left' ? gutter : edge;
  const right = axis === 'left' ? edge : gutter;
  const top = compact ? 20 : 22;
  const bottom = 6;
  const { units, children, weight } = tree;
  const y = (t: number) => top + (t / tree.span) * (height - top - bottom);
  const tAt = (py: number) => ((py - top) / (height - top - bottom)) * tree.span;

  // The roots get bands in proportion to their subtrees, with a floor; main in the middle, the
  // others outside it by age, alternating sides.
  const order: number[] = [];
  tree.roots.forEach((r, k) => (k === 0 ? order.push(r) : k % 2 ? order.unshift(r) : order.push(r)));
  const floor = BAND_FLOOR * units.length;
  const share = order.map((r) => Math.max(weight[r]!, floor));
  const total = share.reduce((a, b) => a + b, 0);
  const slot = new Array<number>(units.length).fill(0);
  const bands: Band[] = [];
  let at = left;
  order.forEach((r, k) => {
    const w = ((width - left - right) * share[k]!) / total;
    bands.push({ root: r, x0: at, x1: at + w });
    place(r, at, at + w);
    at += w;
  });

  /**
   * A unit's children split into the two sides, each to the lighter so far, except that a sibling
   * filed in the same second as the one before goes to the other side. On each side the earliest
   * is outermost, so later growth peels off inside earlier growth instead of crossing it.
   */
  function place(u: number, a: number, b: number): void {
    const L: number[] = [];
    const R: number[] = [];
    let lw = 0;
    let rw = 0;
    let prev = -1;
    let prevSide = 0;
    for (const c of children[u]!) {
      let side = lw <= rw ? 0 : 1;
      if (prev >= 0 && units[prev]!.s === units[c]!.s) side = 1 - prevSide;
      if (side === 0) {
        L.push(c);
        lw += weight[c]!;
      } else {
        R.push(c);
        rw += weight[c]!;
      }
      prevSide = side;
      prev = c;
    }
    const per = (b - a) / weight[u]!;
    let x = a;
    for (const c of L) {
      place(c, x, x + weight[c]! * per);
      x += weight[c]! * per;
    }
    slot[u] = x + per / 2;
    x += per;
    for (const c of [...R].reverse()) {
      place(c, x, x + weight[c]! * per);
      x += weight[c]! * per;
    }
  }

  const limbs: Limb[] = new Array(units.length);
  const xAt = (i: number, t: number): number => {
    const g = limbs[i]!;
    const q = Math.max(0, Math.min(1, (y(t) - g.y0) / g.reach));
    return g.x0 + (g.x1 - g.x0) * (1 - (1 - q) * (1 - q));
  };
  // Parents precede children, so each parent's limb exists when its child's start is placed.
  for (const u of units) {
    if (u.parent < 0) {
      limbs[u.index] = { x0: slot[u.index]!, x1: slot[u.index]!, y0: y(u.s), reach: 1 };
      continue;
    }
    const x0 = xAt(u.parent, u.s);
    const y0 = y(u.s);
    const reachMax = LAT0 + LAT_PER_PX * (y(u.e) - y0) + Math.sqrt(weight[u.index]!) * 3;
    const x1 = x0 + Math.max(-reachMax, Math.min(reachMax, slot[u.index]! - x0));
    limbs[u.index] = { x0, x1, y0, reach: Math.max(6, Math.abs(x1 - x0) * LEAN) };
  }

  const paths: BranchPath[] = units.map((u) => {
    const n = Math.max(1, Math.ceil((u.e - u.s) / STEP)) + 1;
    const xy = new Float64Array(n * 2);
    const counts = new Uint16Array(n - 1);
    for (let k = 0; k < n; k++) {
      const t = Math.min(u.s + k * STEP, u.e);
      xy[2 * k] = xAt(u.index, t);
      xy[2 * k + 1] = y(t);
      if (k) counts[k - 1] = u.hours.get(Math.floor(Math.max(u.s, t - 1) / HOUR_S)) ?? 0;
    }
    return { xy, counts };
  });

  const labels: ThreadLabel[] = tree.threads.map((i) => {
    const u = units[i]!;
    const g = limbs[i]!;
    if (u.parent < 0) return { unit: i, text: u.name, x: slot[i]!, y: y(u.s) - 7, side: 'centre' };
    const yy = g.y0 + Math.min(g.reach * 0.55, compact ? 70 : 110);
    return { unit: i, text: u.name, x: xAt(i, tAt(yy)), y: yy - 3, side: g.x1 < g.x0 ? 'left' : 'right' };
  });

  const days: DayLabel[] = [
    { t: 0, y: y(0), label: fmtPacificWeekdayDay(tree.t0 * SECOND).toUpperCase(), rule: false },
    ...pacificMidnights(tree.t0 * SECOND, tree.cut * SECOND).map((ms) => {
      const t = ms / SECOND - tree.t0;
      return { t, y: y(t), label: fmtPacificWeekdayDay(ms).toUpperCase(), rule: true };
    }),
  ];

  return { width, height, compact, axis, left, right, top, bottom, bands, slot, limbs, paths, labels, days, y, tAt, xAt };
}
