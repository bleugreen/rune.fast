import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import costRaw from '../../data/cost-data.json';
import rolesRaw from '../../data/roles.json';
import timelineRaw from '../../data/attempts-timeline.json';
import type { CostInputs, RawCostData, RawRoles } from '../data/costTypes';
import type { Timeline } from '../data/types';
import { projectCostData, projectRoles } from '../../scripts/public-cost';
import { projectTimeline } from '../../scripts/public-timeline';
import { costInputs } from '../data/cost';
import { fmtInt, fmtPercent, fmtUsd, fmtUsdCents } from '../lib/numbers';
import { fmtPacificHm, fmtUtcHm, pacificDayKey, pacificZone } from '../lib/time';
import { CostPage } from '../pages/CostPage';
import { buildCostModel, listValue } from './model';

const rawCost = costRaw as unknown as RawCostData;
const rawRoles = rolesRaw as unknown as RawRoles;
/** What the build ships: the same inputs with the archival files replaced by their projections. */
const inputs: CostInputs = { ...costInputs, cost: projectCostData(rawCost), roles: projectRoles(rawRoles) };
const timeline = projectTimeline(timelineRaw as unknown as Timeline);
const m = buildCostModel(inputs, timeline);
const { summary } = inputs;

const usd = (n: number) => Math.round(n);

describe('public projection', () => {
  const shipped = JSON.stringify(inputs);
  const archival = JSON.stringify([rawCost, rawRoles]);
  test.each([
    ['helper and test accounts', /\bcairn_[a-z]/],
    ['run hosts', /ashburn|bgsrv/i],
    ['the previous record holder', /stunbaron/i],
  ])('drops %s, which the archival exports carry', (_, re) => {
    expect(archival).toMatch(re);
    expect(shipped).not.toMatch(re);
  });
  test('ships no issue titles', () => {
    expect(Object.keys(inputs.cost)).not.toContain('merged');
    expect(Object.keys(inputs.cost)).not.toContain('top');
    expect(Object.keys(inputs.roles)).toEqual(['hourly']);
  });
  test('keeps every concurrency bucket', () => {
    expect(inputs.cost.conc).toEqual(rawCost.conc);
  });
});

describe('the exports agree with each other', () => {
  test('the price table reproduces the cost of every model from the hourly tokens', () => {
    const byModel: Record<string, number> = {};
    for (const row of inputs.hourly) byModel[row[1]] = (byModel[row[1]] ?? 0) + listValue(row, inputs.billing.list_prices.usd_per_million_tokens);
    for (const [model, v] of Object.entries(summary.model_usd)) expect(byModel[model] ?? 0).toBeCloseTo(v, 6);
  });
  test('each Pacific day costs the same by role and by model, and matches the summary', () => {
    expect(m.days.map((d) => d.key)).toEqual(Object.keys(summary.day_usd));
    for (const d of m.days) {
      expect(d.total).toBeCloseTo(summary.day_usd[d.key]!, 6);
      expect(Object.values(d.byModel).reduce((a, b) => a + b, 0)).toBeCloseTo(d.total, 6);
    }
  });
  test('totals, status groups and counts match the summary', () => {
    expect(m.total).toBeCloseTo(summary.total_list_usd, 6);
    expect(inputs.cost.groups).toEqual(summary.groups);
    expect(inputs.cost.cnt).toEqual(summary.cnt);
    expect(inputs.cost.median).toBe(summary.median_merge_usd);
  });
  test('the median is the median of the merged issues', () => {
    const xs = rawCost.merged.map(([c]) => c).sort((a, b) => a - b);
    expect(xs.length).toBe(summary.merged_n);
    expect((xs[xs.length / 2 - 1]! + xs[xs.length / 2]!) / 2).toBeCloseTo(m.status.median, 6);
  });
  test('the concurrency peak is the bucket the summary names', () => {
    expect(m.concurrency.peak.t / 1000).toBe(summary.peak_t);
    expect(Math.round(m.concurrency.peak.v)).toBe(Math.round(summary.peak_conc));
  });
});

describe('the page claims', () => {
  test('list value against subscriptions', () => {
    expect(usd(m.total)).toBe(17679);
    expect(usd(m.subscription.prorated)).toBe(223);
    expect(Math.round(m.subscription.ratio)).toBe(79);
    expect(Math.round(m.window.days * 2) / 2).toBe(5.5);
  });
  test('Thursday cost the most, and workers led it', () => {
    const { peak } = m.swing;
    expect(peak.key).toBe('2026-10-22');
    expect([usd(peak.total), usd(peak.stacks.work), usd(peak.stacks.coord)]).toEqual([5448, 2789, 1757]);
  });
  test('managers led on Friday, Sunday and Monday, and on no other day', () => {
    expect(m.managerDays.map((d) => d.key)).toEqual(['2026-10-23', '2026-10-25', '2026-10-26']);
  });
  test('the lead swing: Friday to the managers, Saturday back to the workers, Sunday to the managers', () => {
    const pair = (d: (typeof m.days)[number]) => [d.key, usd(d.stacks.coord), usd(d.stacks.work)];
    expect(pair(m.swing.first)).toEqual(['2026-10-23', 1560, 956]);
    expect(pair(m.swing.back)).toEqual(['2026-10-24', 546, 703]);
    expect(pair(m.swing.again)).toEqual(['2026-10-25', 426, 344]);
  });
  test('Sunday is the GPT day', () => {
    const g = m.gptDay;
    expect([g.day.key, g.model, usd(g.usd), usd(g.day.total), fmtPercent(g.share), usd(g.opus)]).toEqual([
      '2026-10-25',
      'gpt-6-astra',
      1113,
      1529,
      '73',
      238,
    ]);
  });
  test('cost by model', () => {
    expect(m.models.map((r) => [r.name, usd(r.usd)])).toEqual([
      ['Opus', 12779],
      ['Fable', 3157],
      ['GPT-6 Astra', 1671],
      ['GPT-6.1 Sol', 37],
      ['Haiku', 17],
      ['Sonnet', 14],
      ['GPT-5.6 Luna', 3],
      ['GPT-5.6 Terra', 1],
    ]);
  });
  test('where the money went: 32 standing issues cost more than the 544 that merged', () => {
    expect(m.status.segments.map((s) => [s.key, usd(s.usd), s.count])).toEqual([
      ['merged', 4843, 544],
      ['closed', 3137, 215],
      ['standing', 5646, 32],
      ['threads', 3985, 6],
    ]);
    expect(usd(m.status.unattributed)).toBe(68);
    expect(fmtUsdCents(m.status.median)).toBe('$5.38');
  });
  test('the concurrency peak: 479 turns at 17:47 PDT on the costliest day', () => {
    const { peak } = m.concurrency;
    expect(Math.round(peak.v)).toBe(479);
    expect(`${fmtPacificHm(peak.t)} ${pacificZone(peak.t)}`).toBe('17:47 PDT');
    expect(pacificDayKey(peak.t)).toBe(m.peakDay.key);
  });
  test('the five scored attempts lie inside the concurrency curve', () => {
    expect(m.attempts.map((a) => a.n)).toEqual([1, 2, 3, 4, 5]);
    for (const a of m.attempts) {
      expect(a.from).toBeGreaterThanOrEqual(m.concurrency.from);
      expect(a.to).toBeLessThanOrEqual(m.concurrency.to);
      expect(a.to).toBeGreaterThan(a.from);
    }
  });
  test('the swarm: growth on 21 and 22 October, and the peaks all on the 22nd', () => {
    const s = m.swarm;
    expect([s.units, s.messages, s.swaps]).toEqual([906, 26898, 36]);
    expect(s.growth.map((d) => d.key)).toEqual(['2026-10-21', '2026-10-22']);
    expect([s.spawnPeak.key, s.mergePeak.key, s.messagePeak.key]).toEqual(['2026-10-22', '2026-10-22', '2026-10-22']);
    expect(s.laterSpawnsMax).toBeLessThan(Math.min(...s.growth.map((d) => d.spawns)));
  });
});

/* ------------------------------------------------------------------------- */
/* Every number in the page's text comes from the data                       */
/* ------------------------------------------------------------------------- */

/**
 * The ways the page writes a number the model holds. The concurrency curve's
 * buckets are drawn, never written, so they are left out: their 1,604 values
 * would otherwise admit nearly every small integer.
 */
function renderings(model: unknown): Set<string> {
  const out = new Set<string>();
  const walk = (v: unknown) => {
    if (typeof v === 'number') {
      for (const s of [fmtUsd(v), fmtUsdCents(v), fmtInt(Math.round(v))]) out.add(s);
      if (v > 0 && v < 1) out.add(fmtPercent(v));
      if (v > 1e12) {
        const d = new Date(v);
        out.add(String(d.getUTCDate()));
        out.add(new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Los_Angeles', day: 'numeric' }).format(d));
        out.add(fmtPacificHm(v));
        out.add(fmtUtcHm(v));
      }
    } else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.entries(v).forEach(([k, x]) => k !== 'points' && walk(x));
  };
  walk(model);
  return out;
}

const ENTITIES: Readonly<Record<string, string>> = { '&amp;': '&', '&#x27;': "'", '&quot;': '"', '&lt;': '<', '&gt;': '>' };

/** The page's text outside its charts' SVG, as a reader sees it. */
function pageText(): string {
  return renderToStaticMarkup(createElement(CostPage))
    .replace(/<svg[\s\S]*?<\/svg>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[#\w]+;/g, (e) => ENTITIES[e] ?? e);
}

/** Numbers as a reader would pick them out: '$17,679', '5.38', '17:47', '79'; not the '6' of 'GPT-6'. */
const NUMBER = /(?<![\w.\-])(?:\d{1,2}:\d{2}|\$?\d[\d,]*(?:\.\d+)?)/g;

describe('every number on the page comes from the data', () => {
  const text = pageText();
  const tokens = (text.match(NUMBER) ?? []).map((t) => t.replace(/[,.]+$/, ''));
  const allowed = renderings(m);

  test('the page renders its figures', () => {
    expect(tokens).toContain('$17,679');
    expect(tokens).toContain('$5.38');
    expect(tokens.length).toBeGreaterThan(40);
  });
  test('every number in the text is one the model derived from the data', () => {
    expect(tokens.filter((t) => !allowed.has(t))).toEqual([]);
  });

  const SOURCES = ['src/pages/CostPage.tsx', 'src/cost/Charts.tsx', 'src/cost/model.ts'];
  test.each(SOURCES)('%s writes no dollar figure', (file) => {
    expect(readFileSync(file, 'utf8')).not.toMatch(/\$\d/);
  });
  test.each(SOURCES.filter((f) => f.endsWith('.tsx')))('%s has no figure in its JSX text', (file) => {
    const runs = [...readFileSync(file, 'utf8').matchAll(/(?<![=\-])>([^<>{}();=[\]]*)</g)].map((r) => r[1]!.trim());
    expect(runs.filter((r) => /\d/.test(r))).toEqual([]);
  });
});
