import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import raw from '../../data/harness.json';
import events from '../../data/swarm-events.json';
import summary from '../../data/summary.json';
import { findForbidden, withoutAddresses } from '../../scripts/forbidden';
import { projectHarness } from '../../scripts/public-harness';
import { fmtInt, fmtPercent } from '../lib/numbers';
import { HOUR, MINUTE, SECOND, fmtPacificHm, fmtPacificHms } from '../lib/time';
import { HarnessPage } from '../pages/HarnessPage';
import { ADDRESSES, TAUGHT } from './addresses';
import { axisAt, buildHarnessModel } from './model';
import type { RawHarnessData } from './types';

const data = raw as unknown as RawHarnessData;
const shipped = projectHarness(data);
const m = buildHarnessModel(shipped);
const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);

describe('the counts reconcile', () => {
  test('recipes: every execution ran one, 962 in all', () => {
    expect(m.recipeTotal).toBe(m.totals.executions);
    expect(m.recipeTotal).toBe(962);
    expect([m.build.executions, m.planbuild.executions]).toEqual([910, 20]);
  });

  test('verbs: the three verbs and the roles both sum to the 83,193 calls', () => {
    expect(sum(Object.values(m.totals.verbs))).toBe(m.totals.verbCalls);
    expect(m.verbs.total).toBe(m.totals.verbCalls);
    expect(sum(m.verbs.rows.map((r) => r.total)) + m.verbs.rest).toBe(83_193);
  });

  test('filing, up to the record: by author, the threads, coordinators, builders and the harness make the 862', () => {
    const f = m.filing;
    expect(f.threads + f.coordinators + f.builders + f.harness).toBe(f.issues);
    expect([f.issues, f.threads, f.main, f.coordinators, f.builders, f.harness]).toEqual([862, 119, 97, 719, 22, 2]);
    // The home page's tree counts the same issues, filed by the same agents, to the same moment.
    expect(data.lifelines.cut).toBe(summary.cut);
    expect(f.issues).toBeLessThan(m.totals.issues);
  });

  test('the lifelines hold nothing after the record, and bin every message and filing they are given', () => {
    const L = data.lifelines;
    const times = [...L.threads.flatMap((th) => [...th.operator, ...th.filed]), ...L.coordinators, ...L.builders, ...L.harness];
    expect(Math.max(...times)).toBeLessThanOrEqual(L.cut);
    expect(m.lifelines.to).toBe(m.filing.cut);
    for (const [r, th] of m.lifelines.rows.slice(0, -1).map((r, k) => [r, L.threads[k]!] as const)) {
      expect(sum(r.operator!)).toBe(th.operator.length);
      expect(sum(r.filed)).toBe(th.filed.length);
    }
    expect(sum(m.lifelines.rows.at(-1)!.filed)).toBe(L.coordinators.length);
    expect(m.filing.operatorToThreads).toBe(526);
    expect(m.filing.operatorTyped).toBe(737);
    expect(m.filing.operatorTyped).toBeLessThanOrEqual(m.totals.operatorMessages);
  });

  test('each mark sits on its filer’s row: rs/3 on main’s, rs/843 on the coordinators’, though main is its parent', () => {
    const rowOf = (key: string) => m.lifelines.rows[m.lifelines.marks.find((mk) => mk.key === key)!.row]!.name;
    expect([rowOf('rs3'), rowOf('rs843')]).toEqual(['main', 'coordinators']);
    expect(m.filing.crossed).toEqual({ issue: 843, filer: 158, filerRole: 'coordinator', parent: 'main' });
    // The coordinator that filed rs/843 is the one that reviewed it.
    expect(m.filing.crossed.filer).toBe(m.issue.reviewerIssue);
  });

  test('wakes: the kinds drawn, the message notices, the catch-up pointers and the rest sum to every briefing item', () => {
    expect(m.wakes.kindItems + m.wakes.messageItems + m.wakes.catchUp + m.wakes.other).toBe(m.wakes.items);
    expect(sum(data.wakes.kinds.map((k) => k.n))).toBe(m.wakes.items);
  });

  test('wakes: messages are split by the sender each briefing names, agents from the harness', () => {
    const w = data.wakes.messages;
    expect([w.agents, w.harness, w.other]).toEqual([27_449, 4_222, 0]);
    expect(m.wakes.messages).toBe(w.agents + w.harness + w.other);
    // One notice can deliver several messages, never fewer than one.
    expect(m.wakes.messages).toBeGreaterThanOrEqual(m.wakes.messageItems);
    // The agents sent no more messages than the export holds from agents; the harness delivered at least its backstops.
    expect(w.agents).toBeLessThanOrEqual(m.totals.agentMessages);
    expect(w.harness).toBeGreaterThanOrEqual(m.totals.backstops);
    expect(m.wakes.rows.slice(0, 2).map((r) => [r.kind, r.n])).toEqual([
      ['agent-message', 27_449],
      ['harness-message', 4_222],
    ]);
    expect(Math.round(m.wakes.messageShare * 100)).toBe(81);
  });

  test('git notices: two classes per day, all of them harness messages', () => {
    for (const d of m.git.days) expect(d.total).toBe(d.auto + d.blocking);
    expect(m.git.total).toBeLessThanOrEqual(m.totals.systemMessages);
    expect(m.git.peak.key).toBe('2026-10-22');
  });

  test('messages: the agents and the harness make the 35,598', () => {
    expect(m.totals.agentMessages + m.totals.systemMessages).toBe(m.totals.messages);
    expect(m.totals.messages).toBe(35_598);
  });

  test('agrees with the cost page’s exports where they overlap', () => {
    expect(m.totals.issues).toBe(events.issues);
    expect(m.totals.threads).toBe(events.threads);
    // The cost refresh was cut at the builder’s start on 26 October, before rs/843’s merge.
    expect(summary.cut * SECOND).toBeLessThanOrEqual(m.window.end);
  });
});

describe('rs/843', () => {
  const i = m.issue;

  test('seven turns, 62 verb calls (28 read, 26 run, 8 write) and seven pull-request versions', () => {
    expect(i.turns).toHaveLength(7);
    expect(i.callCounts).toEqual({ read: 28, run: 26, write: 8 });
    expect(i.calls).toHaveLength(62);
    expect(i.versions).toHaveLength(7);
    expect(m.address.turns).toBe(7);
  });

  test('every turn but the first began with a wake, and each wake is a resumed turn', () => {
    i.turns.forEach((tn, k) => {
      const rawTurn = data.issue843.turns[k]!;
      expect(tn.wake === null).toBe(rawTurn.reason === 'initial');
      if (tn.wake?.kind === 'batch' || tn.wake?.kind === 'both') expect(rawTurn.reason).toBe('wait_resolved');
      if (tn.wake?.kind === 'message') expect(rawTurn.reason).toBe('follow_up');
    });
    expect([i.testWakes, i.messageWakes, i.bothWakes, i.bothMessages]).toEqual([3, 2, 1, 2]);
  });

  test('its turns follow one another and every call falls inside the builder’s hour', () => {
    for (let k = 1; k < i.turns.length; k++) expect(i.turns[k]!.start).toBeGreaterThanOrEqual(i.turns[k - 1]!.end);
    for (const c of i.calls) expect(c.t >= i.start && c.t <= i.end).toBe(true);
  });

  test('the broken axis is monotonic, and its held segment compresses exactly 26.84 hours', () => {
    const held = i.segments[0]!;
    expect((held.to - held.from) / HOUR).toBeCloseTo(26.84, 2);
    let last = -1;
    for (let tt = i.filed - HOUR; tt <= i.merged + HOUR; tt += 30 * SECOND) {
      const f = axisAt(i.segments, tt);
      expect(f).toBeGreaterThanOrEqual(last);
      last = f;
    }
    expect([axisAt(i.segments, i.filed), axisAt(i.segments, i.merged)]).toEqual([0, 1]);
  });

  test('its wakes are labelled in two runs: three test runs, then three wakes by the reviewer', () => {
    expect(i.wakeRuns.map((w) => [w.source, w.turns.map((tn) => tn.n)])).toEqual([
      ['tests', [2, 3, 4]],
      [i.reviewer, [5, 6, 7]],
    ]);
    // Every turn after the first is marked, once.
    expect(i.wakeRuns.flatMap((w) => w.turns.map((tn) => tn.n))).toEqual(i.turns.slice(1).map((tn) => tn.n));
  });

  test('its recipe is the build recipe the run stored', () => {
    expect(i.recipe.map((n) => n.name)).toEqual(['Trigger', 'Builder', 'PR']);
    expect(m.build.nodes.map((n) => n.name)).toEqual(['Trigger', 'Builder', 'PR']);
    expect(m.planbuild.nodes.filter((n) => n.waits).map((n) => n.name)).toEqual(['Plan']);
  });

  test('merged by the integration thread', () => {
    expect([i.mergedBy, i.pr, i.reviewer]).toEqual(['integration', 708, 'rs/158']);
  });
});

describe('rs/3, four minutes', () => {
  const r = m.routing;
  const drawn = new Set(['operator', 'main', 'rs3', 'rs22', 'rs23', ...r.children.map((c) => c.key)]);

  test('the steps are strictly in time order', () => {
    for (let k = 1; k < r.steps.length; k++) expect(r.steps[k]!.t).toBeGreaterThan(r.steps[k - 1]!.t);
    expect(r.steps.map((s) => s.kind)).toEqual(['report', 'question', 'answer', 'start', 'decision', 'fanout', 'report', 'confirm']);
  });

  test('every step goes between nodes the figure draws', () => {
    for (const s of r.steps) for (const k of [s.from, ...s.to]) expect(drawn.has(k)).toBe(true);
    expect(r.childCount).toBe(18);
    expect(r.fanout).toBe(8);
  });

  test('the answer follows its question, from the operator back to rs/3', () => {
    const qi = r.steps.findIndex((s) => s.kind === 'question');
    const answer = r.steps[qi + 1]!;
    expect(answer).toMatchObject({ kind: 'answer', from: 'operator', to: ['rs3'], words: 'Start both' });
    expect(r.answerSeconds).toBe(39);
  });

  test('main’s starts of rs/22 and rs/23 superseded rs/3’s', () => {
    expect(r.started).toEqual([22, 23]);
    expect([r.mainExecution, r.superseded]).toEqual([2, 2]);
  });
});

describe('tenets', () => {
  const T = m.tenets;

  test('39 rows, 34 answered, one awaiting', () => {
    expect(T.rows.map((r) => r.n)).toEqual(Array.from({ length: 39 }, (_, k) => k + 1));
    expect([T.answered, T.proposed]).toEqual([34, 1]);
    expect(T.approved + T.superseded + T.declined).toBe(T.answered);
  });

  test('every supersession points back to an earlier tenet', () => {
    expect(T.arcs.length).toBeGreaterThan(0);
    for (const a of T.arcs) expect(a.from).toBeLessThan(a.to);
    expect(m.mergeChain).toEqual([5, 14, 19]);
  });

  test('half of the answers came within a minute, counted', () => {
    expect(T.withinMinute).toBe(17);
    expect(T.withinMinute * 2).toBeGreaterThanOrEqual(T.answered);
  });

  test('three were filing gates; the rest were standing rules', () => {
    expect(T.gates).toEqual([13, 15, 36]);
  });

  test('the quoted part of tenet 3 is the statement’s own words', () => {
    expect(T.researchWhy).toStartWith('We do not run research as blocking sub-agent tasks (');
    expect(T.research.statement).toContain(T.researchWhy);
  });
});

/* ------------------------------------------------------------------------- */
/* The public surface                                                         */
/* ------------------------------------------------------------------------- */

function pageHtml(): string {
  const error = console.error;
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('useLayoutEffect does nothing on the server')) return;
    error(...args);
  };
  try {
    return renderToStaticMarkup(createElement(HarnessPage));
  } finally {
    console.error = error;
  }
}

const ENTITIES: Readonly<Record<string, string>> = { '&amp;': '&', '&#x27;': "'", '&quot;': '"', '&lt;': '<', '&gt;': '>' };
const decode = (s: string) => s.replace(/&[#\w]+;/g, (e) => ENTITIES[e] ?? e);
const html = pageHtml();

describe('the taught addresses', () => {
  test('each appears on the page, whole: in the text, or as the accessible name of the figure that typesets it', () => {
    const page = decode(html.replace(/<!-- -->/g, ''));
    for (const a of TAUGHT) expect(page).toContain(a);
    expect(page).toContain(`aria-label="${ADDRESSES.pr}"`);
  });

  test('the data carries no address that is not taught', () => {
    const text = JSON.stringify(shipped);
    expect(findForbidden(withoutAddresses(text, TAUGHT))).toBeUndefined();
    expect(text).toContain(ADDRESSES.issues);
  });

  test('no source line carries an address, and the build ships only their plain words', () => {
    for (const lines of Object.values(shipped.sources)) {
      for (const l of lines) {
        expect(Object.keys(l)).toEqual(['plain']);
        expect(l.plain).not.toContain('cairn:');
      }
    }
  });

  test('the public scan lets through exactly the taught addresses, and still fails on any other', () => {
    const scan = (s: string) => findForbidden(withoutAddresses(s, TAUGHT))?.what;
    expect(scan(`"${ADDRESSES.pr}" and "${ADDRESSES.issue}" and ${ADDRESSES.thread}.`)).toBeUndefined();
    for (const other of ['cairn://p/rs/8431', 'cairn://p/rs/843/2/builder', 'cairn://p/rs/main/chat', 'cairn://p/rs/186', 'cairn://posts/361']) {
      expect(scan(`see ${other} here`)).toBe('cairn address');
    }
    // The replay clip scan keeps the blanket rule.
    expect(findForbidden(ADDRESSES.pr)?.what).toBe('cairn address');
  });
});

/**
 * The ways the page writes a number the model holds: as an integer, a percent, a clock time, a
 * day of the month, or the hours and minutes of a duration.
 */
function renderings(model: unknown): Set<string> {
  const out = new Set<string>();
  const walk = (v: unknown) => {
    if (typeof v === 'number') {
      out.add(fmtInt(Math.round(v)));
      out.add(String(v));
      if (v > 0 && v < 1) out.add(fmtPercent(v));
      if (v > 1e12) {
        out.add(new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Los_Angeles', day: 'numeric' }).format(v));
        for (const c of [fmtPacificHm(v), fmtPacificHms(v)]) {
          out.add(c);
          out.add(c.replace(/ [AP]M$/, ''));
        }
      } else if (v > MINUTE) {
        out.add(String(Math.floor(v / HOUR)));
        out.add(String(Math.floor((v % HOUR) / MINUTE)).padStart(Math.floor(v / HOUR) ? 2 : 1, '0'));
      }
    } else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(model);
  return out;
}

/** The page's own words as a reader sees them: not its charts, the run's quoted words, the code card or the sources. */
const text = decode(
  html
    .replace(/<svg[\s\S]*?<\/svg>/g, ' ')
    .replace(/<blockquote[\s\S]*?<\/blockquote>/g, ' ')
    .replace(/<pre[\s\S]*?<\/pre>/g, ' ')
    .replace(/<details[\s\S]*?<\/details>/g, ' ')
    .replace(/<!-- -->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' '),
);
/** Numbers as a reader picks them out: '83,193', '1:25 AM', '6:37:04 PM', the 843 of 'rs/843'; not the 43 of '43d' or the 1 of 'v1'. */
const NUMBER = /(?<![\w.])(?:\d{1,2}:\d{2}(?::\d{2})?(?: [AP]M)?|\d[\d,]*(?:\.\d+)?)(?![\w])/g;

describe('every number on the page comes from the data', () => {
  const tokens = (text.match(NUMBER) ?? []).map((tk) => tk.replace(/[,.]+$/, ''));
  const allowed = renderings(m);

  test('the page renders its figures', () => {
    expect(tokens).toContain('83,193');
    expect(tokens).toContain('1:25 AM');
    expect(tokens.length).toBeGreaterThan(80);
  });

  test('every number in the text is one the model derived from the data', () => {
    expect(tokens.filter((tk) => !allowed.has(tk))).toEqual([]);
  });

  test('the page says what the run did, in its own counts', () => {
    expect(text).toContain('910 of the 962 executions ran the one-stage build recipe');
    expect(text).toContain('Of the 862 issues filed before the record, coordinators filed 719 and the threads 119');
    expect(text).toContain('Most of what the operator typed before the run took the record, at 4:15 AM on Monday, went to them: 526 of 737 messages.');
    expect(text).toContain('Not drawn: 22 issues filed by builders and two by the harness itself.');
    expect(text).toContain('a report travels up as a message to the issue’s parent');
    expect(text).toContain('The operator answers “Start both”, 39 seconds later.');
    expect(text).toContain('main had merged 212 pull requests by write call, coordinators 203 and the integration thread 19');
    expect(text).toContain('Thursday brought 1,467 branch notices; 899 needed an agent');
  });

  const SOURCES = ['src/pages/HarnessPage.tsx', ...readdirSync('src/harness/figures').filter((f) => f.endsWith('.tsx')).map((f) => `src/harness/figures/${f}`)];
  test.each(SOURCES)('%s has no figure in its JSX text', (file) => {
    const runs = [...readFileSync(file, 'utf8').matchAll(/(?<![=\-])>([^<>{}();=[\]]*)</g)].map((x) => x[1]!.trim());
    expect(runs.filter((x) => /\d/.test(x))).toEqual([]);
  });
  test.each(SOURCES)('%s writes no cairn:// address of its own', (file) => {
    expect(readFileSync(file, 'utf8')).not.toMatch(/cairn:\/\//);
  });
});
