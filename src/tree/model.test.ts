import { describe, expect, test } from 'bun:test';
import raw from '../../data/tree.json';
import { projectTree } from '../../scripts/public-tree';
import { EDGE_WINDOW, buildTree, layout, type Layout } from './model';
import type { RawTreeData } from './types';

const archival = raw as unknown as RawTreeData;
const data = projectTree(archival);
const tree = buildTree(data);
const { units, totals } = tree;
const issues = units.filter((u) => u.kind === 'issue');
const threads = units.filter((u) => u.kind === 'thread');
const named = (name: string) => units.find((u) => u.kind === 'thread' && u.name === name)!;
const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);

const desk = layout(tree, { width: 1220, height: 495, compact: false });
const phone = layout(tree, { width: 350, height: 506, compact: true });
const LAYOUTS: ReadonlyArray<readonly [string, Layout]> = [
  ['desktop', desk],
  ['phone', phone],
];

describe('the counts match the export', () => {
  test('862 issues drawn, the 900 the export holds less the 38 filed after the #1, and 6 threads', () => {
    expect([totals.exportIssues, totals.issues, totals.threads]).toEqual([900, 862, 6]);
    expect(issues.length).toBe(totals.issues);
    expect(threads.length).toBe(totals.threads);
  });

  test('merged, closed and still open at the #1 make up the issues drawn', () => {
    const by = (o: string) => issues.filter((u) => u.outcome === o).length;
    expect([by('m'), by('c'), by('o')]).toEqual([totals.merged, totals.closed, totals.open]);
    expect([totals.merged, totals.closed, totals.open]).toEqual([553, 224, 85]);
    expect(totals.merged + totals.closed + totals.open).toBe(totals.issues);
  });

  test('filed by their authors: coordinators 719, threads 119, builders 22, the harness 2', () => {
    const kind = (by: string) =>
      by === 'the harness' ? 'harness' : by.endsWith(' coordinator') ? 'coordinator' : by.endsWith(' builder') ? 'builder' : 'thread';
    const count = (k: string) => issues.filter((u) => kind(u.by) === k).length;
    expect([count('coordinator'), count('thread'), count('builder'), count('harness')]).toEqual([719, 119, 22, 2]);
  });

  test('every labelled problem message is a tick, and the edges carry the messages between branches', () => {
    expect(tree.problems.length).toBe(totals.problemTicks);
    expect(totals.problemTicks).toBe(totals.problem);
    expect([totals.agentMessages, totals.labelled, totals.problem]).toEqual([27_921, 27_919, 5_790]);
    expect(tree.edges.length).toBe(totals.edgeLines);
    expect(sum(tree.edges.map((e) => e.n))).toBe(totals.edgeMessages);
    expect([totals.edgeLines, totals.edgeMessages]).toEqual([19_002, 25_619]);
  });
});

describe('every branch has a parent', () => {
  test('an issue grows from an earlier unit, alive when it was filed', () => {
    for (const u of issues) {
      const p = units[u.parent]!;
      expect(u.parent).toBeLessThan(u.index);
      expect(p.s <= u.s && u.s <= p.e).toBe(true);
    }
  });

  test('every chain ends at a root, and the only roots are main and document', () => {
    for (const u of units) {
      let r = u;
      while (r.parent >= 0) r = units[r.parent]!;
      expect(['main', 'document']).toContain(r.name);
    }
    expect(tree.roots.map((r) => units[r]!.name)).toEqual(['main', 'document']);
  });

  test('the harness’s own filings grow from main', () => {
    for (const u of issues.filter((u) => u.by === 'the harness')) expect(u.parent).toBe(named('main').index);
  });
});

describe('thread attachment', () => {
  test('host, integration, markets and autoresearch grow from main, which created them', () => {
    const fromMain = threads.filter((t) => t.parent === named('main').index);
    expect(fromMain.map((t) => t.name)).toEqual(['host', 'integration', 'markets', 'autoresearch']);
    for (const t of fromMain) expect(t.by).toBe('main');
    expect(totals.threadsFromMain).toBe(4);
  });

  test('document and main are roots the operator opened', () => {
    for (const name of ['main', 'document']) {
      expect(named(name).parent).toBe(-1);
      expect(named(name).by).toBe('the operator');
    }
  });

  test.each(LAYOUTS)('%s: each attached thread leaves main where main is at its creation', (_, L) => {
    const main = named('main').index;
    for (const t of threads.filter((t) => t.parent === main)) expect(L.xAt(t.index, t.s)).toBeCloseTo(L.xAt(main, t.s), 9);
  });
});

describe('no crossing at the root', () => {
  test.each(LAYOUTS)('%s: main’s children, threads included, are placed earliest-outermost on each side', (_, L) => {
    const main = named('main').index;
    const kids = tree.children[main]!;
    const leftSide = kids.filter((c) => L.slot[c]! < L.slot[main]!);
    const rightSide = kids.filter((c) => L.slot[c]! > L.slot[main]!);
    expect(leftSide.length + rightSide.length).toBe(kids.length);
    const byFiling = (xs: number[]) => [...xs].sort((a, b) => units[a]!.s - units[b]!.s || a - b);
    // Outermost first: rising x on the left, falling x on the right.
    expect(byFiling(leftSide)).toEqual([...leftSide].sort((a, b) => L.slot[a]! - L.slot[b]!));
    expect(byFiling(rightSide)).toEqual([...rightSide].sort((a, b) => L.slot[b]! - L.slot[a]!));
  });

  test('siblings filed in the same second land on opposite sides, as host and integration do', () => {
    const [host, integration, main] = ['host', 'integration', 'main'].map((n) => named(n).index);
    expect(units[host!]!.s).toBe(units[integration!]!.s);
    for (const [, L] of LAYOUTS) {
      expect(Math.sign(L.slot[host!]! - L.slot[main!]!)).toBe(-Math.sign(L.slot[integration!]! - L.slot[main!]!));
    }
    for (const kids of tree.children) {
      for (let k = 1; k < kids.length; k++) {
        const [a, b] = [kids[k - 1]!, kids[k]!];
        if (units[a]!.s !== units[b]!.s) continue;
        const p = units[a]!.parent;
        expect(Math.sign(desk.slot[a]! - desk.slot[p]!)).toBe(-Math.sign(desk.slot[b]! - desk.slot[p]!));
      }
    }
  });
});

describe('times are monotonic', () => {
  test('units are in filing order, each living from its filing to its end, by the cut', () => {
    for (let k = 1; k < issues.length; k++) expect(issues[k]!.s).toBeGreaterThanOrEqual(issues[k - 1]!.s);
    for (const u of units) expect(0 <= u.s && u.s <= u.e && u.e <= tree.span).toBe(true);
    expect(tree.span).toBe(tree.cut - tree.t0);
  });

  test('every hourly count falls within its unit’s life', () => {
    for (const u of units) {
      for (const [h, n] of u.hours) {
        expect(n).toBeGreaterThan(0);
        expect(h * 3600 <= u.e && u.s < (h + 1) * 3600).toBe(true);
      }
    }
  });

  test('edges are in time order, each inside its window and both its units’ lives', () => {
    let window = 0;
    for (const [, , dw] of data.edges) {
      expect(dw).toBeGreaterThanOrEqual(0);
      window += dw;
    }
    let prevWindow = -1;
    for (const e of tree.edges) {
      const w = Math.floor(e.t / EDGE_WINDOW);
      expect(w).toBeGreaterThanOrEqual(prevWindow);
      prevWindow = w;
      for (const u of [units[e.a]!, units[e.b]!]) expect(u.s <= e.t && e.t <= u.e).toBe(true);
      expect(e.a).not.toBe(e.b);
    }
  });

  test('problem ticks are in time order, each inside its unit’s life', () => {
    let prev = 0;
    for (const p of tree.problems) {
      expect(p.t).toBeGreaterThanOrEqual(prev);
      prev = p.t;
      const u = units[p.u]!;
      expect(u.s <= p.t && p.t <= u.e).toBe(true);
    }
  });

  test('an issue open at the #1 that resolved later says how and when, after the cut', () => {
    for (const u of issues) {
      if (!u.after) continue;
      expect(u.outcome).toBe('o');
      expect(u.after[1]).toBeGreaterThan(tree.span);
    }
  });
});

describe.each(LAYOUTS)('layout, %s', (_, L) => {
  test('slots fall inside their root band and the figure', () => {
    const rootOf = (u: number): number => (units[u]!.parent < 0 ? u : rootOf(units[u]!.parent));
    for (const u of units) {
      const band = L.bands.find((b) => b.root === rootOf(u.index))!;
      const x = L.slot[u.index]!;
      expect(band.x0 <= x && x <= band.x1).toBe(true);
      expect(0 <= x && x <= L.width).toBe(true);
    }
    expect(L.bands.map((b) => units[b.root]!.name)).toEqual(['document', 'main']);
  });

  test('a child starts where its parent is at its filing; y is exact time', () => {
    for (const u of units) {
      if (u.parent >= 0) expect(L.xAt(u.index, u.s)).toBeCloseTo(L.xAt(u.parent, u.s), 9);
      expect(L.y(u.s)).toBeCloseTo(L.top + (u.s / tree.span) * (L.height - L.top - L.bottom), 9);
    }
    expect(L.y(tree.span)).toBeCloseTo(L.height - L.bottom, 9);
  });

  test('every drawn point is inside the figure', () => {
    for (const { xy } of L.paths) {
      for (let k = 0; k < xy.length; k += 2) {
        expect(xy[k]! >= 0 && xy[k]! <= L.width && xy[k + 1]! >= 0 && xy[k + 1]! <= L.height).toBe(true);
      }
    }
  });

  test('the day rules are the Pacific midnights, labelled from TUE 20 to MON 26', () => {
    expect(L.days.map((d) => d.label)).toEqual(['TUE 20', 'WED 21', 'THU 22', 'FRI 23', 'SAT 24', 'SUN 25', 'MON 26']);
    expect(L.days.map((d) => d.rule)).toEqual([false, true, true, true, true, true, true]);
  });

  test('it is deterministic for a given size', () => {
    const again = layout(tree, { width: L.width, height: L.height, compact: L.compact });
    expect(again.slot).toEqual(L.slot);
    expect(again.limbs).toEqual(L.limbs);
    expect(again.labels).toEqual(L.labels);
  });
});

describe('the projection', () => {
  test('the drawing ships no message ids and no write ids', () => {
    expect(archival.problems.every((p) => typeof p[2] === 'string')).toBe(true);
    const shipped = JSON.stringify(data);
    expect(shipped).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);
    expect(data.threads.every((t) => !('w' in t))).toBe(true);
    expect(data.problems.every((p) => p.length === 2)).toBe(true);
  });
});
