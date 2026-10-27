import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { timeline } from '../data/timeline';
import { fmtInt } from '../lib/numbers';
import { fmtDuration, fmtPacificHm, HOUR } from '../lib/time';
import { openingFacts, RoutePage } from '../pages/RoutePage';
import { route } from './data';
import { deathWallTicks, GAME_FACTS, WORDS } from './prose';

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

/** The page's text as a reader sees it, less its charts' SVG and the clips, whose captions the clip registry owns. */
const text = html
  .replace(/<svg[\s\S]*?<\/svg>/g, ' ')
  .replace(/<figure[^>]*data-embed[\s\S]*?<\/figure>/g, ' ')
  .replace(/<!-- -->/g, '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&[#\w]+;/g, (e) => ENTITIES[e] ?? e)
  .replace(/\s+/g, ' ');

/** Every way the page writes a number the model holds. */
function renderings(model: unknown, out = new Set<string>()): Set<string> {
  const seen = new Set<unknown>();
  const walk = (v: unknown) => {
    if (typeof v === 'number') {
      out.add(fmtInt(v)).add(fmtInt(Math.round(v))).add(String(v));
      if (v > 1e12) {
        out.add(fmtPacificHm(v));
        out.add(new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Los_Angeles', day: 'numeric' }).format(v));
      }
    } else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object' && !seen.has(v)) {
      seen.add(v);
      Object.values(v).forEach(walk);
    }
  };
  walk(model);
  return out;
}

/** What the page's words derive from the model's figures: differences, roundings, durations. */
function derived(): number[] {
  const f = openingFacts(timeline);
  const ret = route.logins.find((l) => l.id === 'return')!;
  const outs = route.breaks.flatMap((b) => b.parts.flatMap((p) => (p.kind === 'out' ? [p.to - p.from] : [])));
  return [
    route.record - route.finish,
    Math.round(((route.record - route.finish) * route.tickMs) / 1000),
    Math.round(route.finish - route.planTotal),
    Math.floor((f.last99 - f.start) / HOUR),
    Math.round(deathWallTicks(ret, route) / 10) * 10,
    route.tickMs / 1000,
    ...route.steps.map((s) => Math.round(Math.abs(s.took - s.planned))),
    ...outs.flatMap((ms) => (fmtDuration(ms).match(/\d+/g) ?? []).map(Number)),
    ...(fmtDuration(0).match(/\d+/g) ?? []).map(Number),
  ];
}

const allowed = renderings([route, openingFacts(timeline), derived(), Object.values(GAME_FACTS)]);
// The attempt's own name, and the hours and minutes the rail's logged-in time shows at rest.
for (const t of timeline.attempts.find((a) => a.id === 'A5')!.name.match(/\d+/g) ?? []) allowed.add(t);
for (const d of fmtDuration(0).match(/\d+/g) ?? []) allowed.add(d);
for (const d of [...fmtDuration(0).matchAll(/\d+/g)].map((m) => m[0])) allowed.add(d);
allowed.add('09');

/** Numbers as a reader picks them out: '35,787', '0.4', '12:33 AM'; not the '03' of 'T02-03'. */
const NUMBER = /(?<![\w.\-])(?:\d{1,2}:\d{2}(?: [AP]M)?|\d[\d,]*(?:\.\d+)?)/g;

describe('the Route page', () => {
  test('renders every step, in order, and the finish', () => {
    const ids = [...html.matchAll(/<section id="([^"]+)"[^>]*data-step="(\d+)"/g)].map((m) => m[1]);
    expect(ids).toEqual(route.steps.map((s) => s.spec.id));
    expect(text).toContain('Agility 99, and the two clocks');
    for (const s of route.steps) expect(WORDS[s.spec.id]).toBeDefined();
  });

  test('every number in its text is one the model holds or the words derive from it', () => {
    const tokens = (text.match(NUMBER) ?? []).map((t) => t.replace(/[,.]+$/, ''));
    expect(tokens.length).toBeGreaterThan(150);
    expect([...new Set(tokens.filter((t) => !allowed.has(t)))]).toEqual([]);
  });

  test('prints the run’s headline figures', () => {
    for (const s of ['35,787', '35,916', '35,225', '562', '541', '2,099', '2,288']) expect(text).toContain(s);
  });

  test('keeps its sources behind closed disclosures, in plain words', () => {
    const details = html.match(/<details[\s\S]*?<\/details>/g) ?? [];
    expect(details.length).toBe(route.steps.length);
    for (const d of details) {
      expect(d).not.toMatch(/ open[ >=]/);
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
      expect(readFileSync(f, 'utf8')).not.toMatch(/transition|animation|@keyframes|scroll-behavior/);
    }
  });

  test('writes no figure into its JSX text', () => {
    for (const f of ['src/pages/RoutePage.tsx', 'src/route/StepSection.tsx', 'src/route/Break.tsx', 'src/route/Rail.tsx', 'src/route/PlanBars.tsx']) {
      const runs = [...readFileSync(f, 'utf8').matchAll(/(?<![=\-])>([^<>{}();=[\]]*)</g)].map((r) => r[1]!.trim());
      expect(runs.filter((r) => /\d/.test(r))).toEqual([]);
    }
  });
});
