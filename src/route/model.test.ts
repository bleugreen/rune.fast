import { describe, expect, test } from 'bun:test';
import rawTimeline from '../../data/attempts-timeline.json';
import rawLog from '../../data/route-log.json';
import rawPlan from '../../data/route-plan.json';
import { projectRouteLog, projectRoutePlan } from '../../scripts/public-route';
import { projectTimeline } from '../../scripts/public-timeline';
import { clipById } from '../clips/registry';
import type { ArchivalTimeline } from '../data/types';
import { SECTION_META } from '../story/sections';
import { TRICKS } from '../tricks/model';
import { SKILLS, type RouteLog, type RoutePlan } from './log';
import { buildRoute } from './model';
import { STEPS } from './plan';

const archivalLog = rawLog as unknown as RouteLog;
const archivalPlan = rawPlan as unknown as RoutePlan;
/** What the build ships. */
const log = projectRouteLog(archivalLog);
const plan = projectRoutePlan(archivalPlan);
const route = buildRoute(log, plan, projectTimeline(rawTimeline as unknown as ArchivalTimeline));
const stampOf = (skill: string) => route.stamps.find((s) => s.skill === skill)!.tick;

describe('the public projection', () => {
  test('ships the step log as imported, field for field', () => {
    expect(log).toEqual(archivalLog);
  });
  test('ships the run order’s figures without its words', () => {
    expect(JSON.stringify(plan)).not.toContain('scenario row');
    expect(plan.rows.map((r) => [r.id, r.expected, r.scenario.map((s) => s.ticks)])).toEqual(
      archivalPlan.rows.map((r) => [r.id, r.expected, r.scenario.map((s) => s.ticks)]),
    );
  });
  test('carries no error text, account names, hosts or addresses', () => {
    const text = JSON.stringify([log, plan]);
    for (const re of [/cairn_[a-z]/, /bgsrv|ashburn/i, /cairn:\/\//, /\/Users\//, /"error"/]) expect(text).not.toMatch(re);
  });
});

/**
 * Ticks inside a runner launch that no top-level step interval holds, by name: the login before
 * the runner's first record, and the few places the runner stood waiting on something.
 */
const HOLDS: Readonly<Record<string, string>> = {
  '2:7039-7040': 'the hand-off before the Mage Arena, refused one slot short',
  '4:803-804': 'the body altar refusing its precondition (the rune arrows still carried)',
  '6:6008-6026': 'Elvarg’s level-up page left open, and the logout the game held back',
  '7:8-149': 'waiting on the cannon supplier, until the operator’s logout',
  '8:230-268': 'the retreat from the spiders with no prayer, and the held logout',
};

describe('the step log', () => {
  test('each launch’s step intervals tile its sessions, apart from the login and the named holds', () => {
    const gaps: string[] = [];
    for (let run = 0; run < route.runAt.length; run++) {
      const sessions = log.sessions.filter((s) => s.run === run);
      const end = Math.max(...sessions.map((s) => s.end));
      const leaves = log.steps.filter((s) => s.run === run);
      const first = log.sessions.find((s) => s.run === run && s.session === 1)!;
      // The login: the ticks before the first interval, at most to the runner's first sight of the world.
      expect(leaves[0]!.start).toBeLessThanOrEqual(first.firstObserved);
      let cursor = leaves[0]!.start;
      for (const l of leaves) {
        expect(l.start).toBeGreaterThanOrEqual(cursor);
        if (l.start > cursor) gaps.push(`${run}:${cursor}-${l.start}`);
        cursor = l.end;
      }
      if (cursor < end) gaps.push(`${run}:${cursor}-${end}`);
    }
    expect(gaps).toEqual(Object.keys(HOLDS));
  });

  test('its sessions hold 35,058 ticks, the swarm’s own session count', () => {
    expect(route.sessionTicks).toBe(35058);
  });
});

describe('the hiscore’s clock', () => {
  test('every 99 the runner logged lands on the hiscore’s stamp for it, and the finish is 35,787', () => {
    const logged = log.levels.filter(([, l]) => l === 99);
    expect(logged.length).toBe(18);
    for (const [skill, , run, tick] of logged) expect(route.runAt[run]! + tick).toBe(stampOf(skill));
    expect(route.finish).toBe(35787);
    expect(stampOf('Agility')).toBe(route.finish);
  });

  test('Thieving 99, which no session logged, falls inside the third morning login', () => {
    const third = route.segments.find((g) => g.kind === 'login' && g.login === 'thieving-3')!;
    expect(third.from).toBeLessThan(stampOf('Thieving'));
    expect(stampOf('Thieving')).toBeLessThanOrEqual(third.to);
  });

  test('the segments run end to end from 0 to the last session tick', () => {
    let cursor = 0;
    for (const g of route.segments) {
      expect(g.from).toBe(cursor);
      cursor = g.to;
    }
    expect(cursor).toBe(route.finish + 1);
  });

  test('the steps tile the clock from 0 to the finish', () => {
    expect(route.steps.length).toBe(25);
    expect(route.steps[0]!.start).toBe(0);
    route.steps.forEach((s, i) => {
      if (i) expect(s.start).toBe(route.steps[i - 1]!.end);
      expect(s.composition.session + s.composition.login + s.composition.unassigned).toBe(s.took);
    });
    expect(route.steps.at(-1)!.end).toBe(route.finish);
  });

  test('the hiscore runs 6, then 76, then 730 ticks ahead of the session clock, and never falls back', () => {
    expect([...new Set(route.stampDrift.map((s) => s.drift))]).toEqual([0, 6, 76, 730]);
    route.stampDrift.forEach((p, i) => i && expect(p.drift).toBeGreaterThanOrEqual(route.stampDrift[i - 1]!.drift));
    expect(route.stampDrift.at(-1)).toMatchObject({ skill: 'Agility', drift: 730 });
  });
});

describe('the ledger', () => {
  const { ledger } = route;
  test('reproduces the swarm’s 35,225 and its residual of 562', () => {
    expect([ledger.swarm, ledger.residual, ledger.hiscore - ledger.swarm]).toEqual([35225, 562, 562]);
  });
  test('accounts for the 562 in named terms, with nothing left over', () => {
    expect(ledger.terms).toEqual([
      { id: 'unassigned', ticks: 558 },
      { id: 'short-logins', ticks: 5 },
      { id: 'after-finish', ticks: -1 },
    ]);
    expect(ledger.terms.reduce((s, t) => s + t.ticks, 0)).toBe(ledger.residual);
  });
  test('the unassigned segments sum to the unassigned term, each inside its bracket of stamps', () => {
    const un = route.segments.filter((g) => g.kind === 'unassigned');
    expect(un.reduce((s, g) => s + g.to - g.from, 0)).toBe(ledger.unassigned);
    for (const g of un) {
      const [a, b] = g.bracket;
      expect(g.from).toBeGreaterThanOrEqual(a ? stampOf(a) : 0);
      expect(g.to).toBeLessThanOrEqual(stampOf(b));
    }
    expect(un.map((g) => [g.login, g.to - g.from, ...g.bracket])).toEqual([
      ['greegree', 3, 'Attack', 'Magic'],
      ['arrows', 14, 'Fletching', 'Runecraft'],
      ['return', 541, 'Strength', 'Defence'],
    ]);
  });
});

describe('the rail', () => {
  test('starts every skill at 1 and Hitpoints at 10, never goes down, never passes 99, and ends at 99', () => {
    const start = route.levelsAt(-1);
    for (const s of SKILLS) expect(start[s]).toBe(s === 'Hitpoints' ? 10 : 1);
    let prev = start;
    for (let t = 0; t <= route.finish; t += 7) {
      const now = route.levelsAt(t);
      for (const s of SKILLS) {
        expect(now[s]).toBeGreaterThanOrEqual(prev[s]);
        expect(now[s]).toBeLessThanOrEqual(99);
      }
      prev = now;
    }
    for (const s of SKILLS) expect(route.levelsAt(route.finish)[s]).toBe(99);
  });

  test('each skill reaches 99 on the tick of its stamp', () => {
    for (const { skill, tick } of route.stamps) {
      expect(route.levelsAt(tick - 1)[skill]).toBeLessThan(99);
      expect(route.levelsAt(tick)[skill]).toBe(99);
    }
  });

  test('marks each 99 as just reached on the tick of its stamp, the ones on a step’s last tick included', () => {
    for (const { skill, tick } of route.stamps) expect(route.justReached(tick)).toBe(skill);
    expect(route.justReached(0)).toBeUndefined();
    // Gone once the step after the one it was reached in begins.
    const fm = route.steps.find((s) => s.spec.id === 'rings')!;
    expect(route.justReached(fm.end)).toBeUndefined();
  });

  test('at Magic 99 it shows the knights’ levels', () => {
    const at = route.levelsAt(18218);
    expect([at.Magic, at.Thieving, at.Fletching, at.Agility]).toEqual([99, 70, 1, 76]);
  });
});

describe('the plan', () => {
  test('every step’s planned figure traces to run-order rows and their lines', () => {
    for (const s of route.steps) {
      expect(s.rows.length).toBeGreaterThan(0);
      for (const r of s.rows) expect(r.line).toBeGreaterThan(0);
    }
  });
  test('every priced row is in exactly one step, the block row aside', () => {
    const used = route.steps.flatMap((s) => s.rows.map((r) => r.id));
    expect(new Set(used).size).toBe(used.length);
    expect(plan.rows.map((r) => r.id).filter((id) => !used.includes(id))).toEqual(['S25']);
  });
  test('the knights resolve to their row’s 2,026 and the 73 the row leaves to the courier’s top-ups', () => {
    const knights = route.steps.find((s) => s.spec.id === 'knights')!;
    expect(knights.rows.find((r) => r.id === 'S18')!.expected).toBe(2026);
    expect(knights.planned).toBe(2099);
    expect(knights.took).toBe(2288);
  });
  test('the run order expected 35,467.4 for the whole route when attempt 5 logged in', () => {
    expect(route.planTotal).toBe(35467.4);
    expect(plan.source.runCommit.hash.startsWith('82f6da3a')).toBe(true);
  });
});

describe('references', () => {
  test('every clip is registered, at most two a step', () => {
    for (const s of STEPS) {
      expect(s.clips.length).toBeLessThanOrEqual(2);
      for (const id of s.clips) expect(() => clipById(id)).not.toThrow();
    }
  });
  test('every trick is a card the tricks page renders', () => {
    const shown = new Set(TRICKS.filter((t) => t.kind !== 'rejected').map((t) => t.id));
    for (const s of STEPS) for (const id of s.tricks) expect(shown.has(id)).toBe(true);
  });
  test('every break links to a story section', () => {
    const anchors = new Set(SECTION_META.map((s) => s.id));
    for (const b of route.breaks) expect(anchors.has(b.story)).toBe(true);
  });
});
