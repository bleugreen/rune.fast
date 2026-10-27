import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { timeline } from '../data/timeline';
import { fmtInt } from '../lib/numbers';
import { fmtDuration, fmtPacificHm, HOUR } from '../lib/time';
import { openingFacts, RoutePage } from '../pages/RoutePage';
import { route } from './data';
import { MAX_LEVEL } from './log';
import { GAME_FACTS, WORDS } from './prose';

const ENTITIES: Readonly<Record<string, string>> = { '&amp;': '&', '&#x27;': "'", '&quot;': '"', '&lt;': '<', '&gt;': '>' };

function render(): string {
  const error = console.error;
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('useLayoutEffect does nothing on the server')) return;
    error(...args);
  };
  try {
    return renderToStaticMarkup(
      <MemoryRouter initialEntries={['/route']}>
        <RoutePage />
      </MemoryRouter>,
    );
  } finally {
    console.error = error;
  }
}

const html = render();

/** The page's text as a reader sees it, less the clips, whose captions the clip registry owns. */
const text = html
  .replace(/<svg[\s\S]*?<\/svg>/g, ' ')
  .replace(/<figure[^>]*data-embed[\s\S]*?<\/figure>/g, ' ')
  .replace(/<!-- -->/g, '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&[#\w]+;/g, (e) => ENTITIES[e] ?? e)
  .replace(/\s+/g, ' ');

/** Every way the page writes the numbers it is given. */
function renderings(values: unknown, out = new Set<string>()): Set<string> {
  const walk = (v: unknown) => {
    if (typeof v === 'number') {
      out.add(fmtInt(v)).add(fmtInt(Math.round(v))).add(String(v));
      if (v > 1e12) {
        out.add(fmtPacificHm(v));
        out.add(new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Los_Angeles', day: 'numeric' }).format(v));
      }
    } else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(values);
  return out;
}

/**
 * What the page may print: each step's own figures (its ticks, price and rows, the levels at its two
 * ends, its 99s, its breaks and their logins), the finish and the record, the opening's facts, the
 * figures the words derive from those, and GAME_FACTS. Not the rest of the log: its 1,852 level-ups
 * alone would admit every level.
 */
function allowed(): Set<string> {
  const f = openingFacts(timeline);
  const steps = route.steps.map((s) => ({
    start: s.start,
    end: s.end,
    took: s.took,
    planned: s.planned,
    rows: s.rows.map((r) => [r.expected, r.scenario.map((x) => x.ticks)]),
    composition: s.composition,
    levelsFrom: s.levelsFrom,
    levelsTo: s.levelsTo,
    nineties: s.nineties.map((n) => n.tick),
    breaks: s.breaks.map((b) => [b.tick, b.from, b.to, b.loginTicks, b.parts.map((p) => (p.kind === 'out' ? [p.from, p.to] : []))]),
    logins: s.breaks.flatMap((b) => b.logins.map((l) => [l.at, l.ticks, l.unassigned, l.ticks + l.unassigned])),
  }));
  const outs = route.breaks.flatMap((b) => b.parts.flatMap((p) => (p.kind === 'out' ? [p.to - p.from] : [])));
  const derived = [
    route.record - route.finish,
    ((route.record - route.finish) * route.tickMs) / 1000,
    Math.floor((f.last99 - f.start) / HOUR),
    route.tickMs / 1000,
    ...route.steps.map((s) => Math.round(Math.abs(s.took - s.planned))),
    ...route.breaks.map((b) => b.logins.reduce((s, l) => s + l.ticks + l.unassigned, 0)),
  ];
  const out = renderings([steps, route.finish, route.record, derived, Object.values(GAME_FACTS), MAX_LEVEL]);
  // Durations as fmtDuration writes them, '9 h 09 min': the rail's at rest, and each logged-out stretch.
  for (const ms of [0, ...outs]) for (const d of fmtDuration(ms).match(/\d+/g) ?? []) out.add(d);
  // The attempt's own name, 'Attempt 5'.
  for (const d of f.name.match(/\d+/g) ?? []) out.add(d);
  return out;
}

/** Numbers as a reader picks them out: '35,787', '0.4', '12:33 AM'; not the '03' of 'T02-03'. */
const NUMBER = /(?<![\w.\-])(?:\d{1,2}:\d{2}(?: [AP]M)?|\d[\d,]*(?:\.\d+)?)/g;

/**
 * The static text of a source file's string literals: comments and `${…}` interpolations taken out.
 * Spelled-out numbers ('sixty enchants', 'five continues') are not checked here; each is covered by
 * its step's Sources lines.
 */
function staticStrings(file: string): string[] {
  const src = readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ');
  let flat = '';
  for (let i = 0; i < src.length; i++) {
    if (src[i] === '$' && src[i + 1] === '{') {
      let depth = 0;
      for (i++; i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}' && --depth === 0) break;
      }
      flat += ' ';
    } else flat += src[i];
  }
  return flat.match(/'(?:[^'\\\n]|\\.)*'|`[^`]*`/g) ?? [];
}

describe('the Route page', () => {
  test('renders every step, in order, and ends on the record', () => {
    const ids = [...html.matchAll(/<section id="([^"]+)"[^>]*data-step="(\d+)"/g)].map((m) => m[1]);
    expect(ids).toEqual(route.steps.map((s) => s.spec.id));
    for (const s of route.steps) expect(WORDS[s.spec.id]).toBeDefined();
    expect(text).toContain('Agility 99, and the record');
    expect(text).toContain('129 ticks (51.6 seconds) under the record of 35,916');
  });

  test('opens with the operator’s three paragraphs', () => {
    const opening = [...html.matchAll(/<p class="prose">([\s\S]*?)<\/p>/g)].slice(0, 3).map((m) => m[1]!.replace(/&#x27;/g, "'"));
    expect(opening).toEqual([
      'The hiscore doesn’t time a run by the clock on the wall. It counts game ticks, 0.4 seconds each, and only while the account is logged in. Attempt 5 took 28 hours from logging in to its last 99. The hiscore counted 35,787 ticks, just under four hours.',
      '“Wall clock is free, ticks are not,” as the operator put it, so the route spent ticks only on training. When something went wrong, the account logged out and waited for free. Helpers brought its supplies, and where one skill left it idle, another filled the gap.',
      'This page follows those ticks in order. The line on the left is the hiscore’s clock. It moves as you scroll and breaks wherever the account was logged out, however long the wait. Each stretch says what the account did, why it came then, and what it cost against the plan.',
    ]);
  });

  test('prints no ledger and no account of where the two clocks disagree (the operator’s ruling)', () => {
    for (const gone of ['35,225', '562', '558', 'two clocks', 'ledger']) expect(text).not.toContain(gone);
  });

  test('every number in its text is one of its steps’ figures, the finish’s, or derived from them', () => {
    const tokens = (text.match(NUMBER) ?? []).map((t) => t.replace(/[,.]+$/, ''));
    expect(tokens.length).toBeGreaterThan(150);
    const ok = allowed();
    expect([...new Set(tokens.filter((t) => !ok.has(t)))]).toEqual([]);
  });

  test('its words type no figure: every number in them comes in from the model or GAME_FACTS', () => {
    const typed = staticStrings('src/route/prose.ts')
      .map((s) => s.replace(/\b[Aa]ttempt 5\b/g, ' ').replace(new RegExp(`\\b${MAX_LEVEL}\\b`, 'g'), ' '))
      .filter((s) => /\d/.test(s));
    // Run-order ids ('S18') and code ('3_600_000', 'T') are not prose; a digit in a phrase is.
    expect(typed.filter((s) => /(?:^|[\s(])\d/.test(s.slice(1, -1)))).toEqual([]);
  });

  test('prints the run’s headline figures', () => {
    for (const s of ['35,787', '35,916', '541', '2,099', '2,288']) expect(text).toContain(s);
  });

  test('keeps its sources behind closed disclosures, in plain words', () => {
    const details = html.match(/<details[\s\S]*?<\/details>/g) ?? [];
    expect(details.length).toBe(route.steps.length);
    for (const d of details) {
      expect(d).not.toMatch(/^<details[^>]* open/);
      expect(d).not.toMatch(/cairn:\/\/|\/Users\/|rs\/\d/);
    }
  });

  test('links each break to the story, and each trick to its card', () => {
    expect(html).toContain('href="/#twenty-eight-hours"');
    expect(html).toContain('href="/#the-death"');
    expect(html).toContain('href="/tricks#stun-pack"');
  });

  test('has no motion of its own: no transition or animation in its styles', () => {
    for (const f of ['src/route/Route.module.css', 'src/pages/RoutePage.module.css']) {
      expect(readFileSync(f, 'utf8')).not.toMatch(/(?<![\w-])(?:transition|animation|scroll-behavior)\s*:|@keyframes/);
    }
  });

  test('writes no figure into its JSX text', () => {
    for (const f of ['src/pages/RoutePage.tsx', 'src/route/StepSection.tsx', 'src/route/Break.tsx', 'src/route/Rail.tsx', 'src/route/PlanBars.tsx']) {
      const runs = [...readFileSync(f, 'utf8').matchAll(/(?<![=\-])>([^<>{}();=[\]]*)</g)].map((r) => r[1]!.trim());
      expect(runs.filter((r) => /\d/.test(r))).toEqual([]);
    }
  });
});
