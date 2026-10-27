/**
 * Time to first frame of a replay embed the reader scrolls to and plays, from the page's own User
 * Timing marks, in system Chrome. Each run gets a fresh browser context, so Cache Storage and the
 * HTTP cache start empty. The reader scrolls the embed to just inside the near-view margin, reads
 * for `--dwell` ms, scrolls it into view and plays it. Runs alternate between the embed's
 * near-view cache start and none (the browser reporting Save-Data, which turns it off), so both
 * see the same machine load.
 *
 *   bun scripts/world/bench-load.ts [--base http://localhost:4173] [--page /] [--embed agility-lap] \
 *     [--runs 5] [--dwell 3000] [--headed] [--json out.json]
 *
 * The shared Mac's load swings results by seconds: compare in alternating rounds, as this does.
 */
import { writeFileSync } from 'node:fs';
import { loadavg } from 'node:os';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright-core';

const { values: args } = parseArgs({
  options: {
    base: { type: 'string', default: 'http://localhost:4173' },
    page: { type: 'string', default: '/' },
    embed: { type: 'string', default: 'agility-lap' },
    runs: { type: 'string', default: '5' },
    dwell: { type: 'string', default: '3000' },
    headed: { type: 'boolean', default: false },
    json: { type: 'string' },
    timeout: { type: 'string', default: '120000' },
  },
});

type Mode = 'near-view' | 'none';
type Run = { mode: Mode; load: number; marks: Record<string, number> };

// Stages reported, in load order, as ms after the click (replay:start).
const STAGES = [
  'replay:workers-started', 'replay:manifest', 'replay:fonts', 'replay:cache-fetched', 'replay:cache-indexed',
  'replay:seeked', 'world:renderer-init', 'world:renderer-loader', 'replay:first-frame', 'replay:maps-loaded',
  'replay:followed-drawn', 'replay:shown', 'replay:ready',
];

const browser = await chromium.launch({
  channel: 'chrome',
  headless: !args.headed,
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=metal', '--enable-unsafe-swiftshader'],
});
const runs: Run[] = [];
try {
  for (let round = 0; round < Number(args.runs); round++) {
    for (const mode of ['near-view', 'none'] as const) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
      try {
        if (mode === 'none') {
          await context.addInitScript(() => Object.defineProperty(navigator, 'connection', { value: { saveData: true } }));
        }
        const page = await context.newPage();
        page.on('pageerror', (e) => console.error(`page error: ${e.message}`));
        const load = loadavg()[0]!;
        await page.goto(args.base + args.page);
        const figure = page.locator(`[data-embed="${args.embed}"]`);
        await figure.waitFor({ state: 'attached' });
        // Half a viewport below the screen: inside the one-viewport margin, not yet in view.
        await page.evaluate((id) => {
          const el = document.querySelector(`[data-embed="${id}"]`)!;
          window.scrollTo(0, window.scrollY + el.getBoundingClientRect().top - window.innerHeight * 1.5);
        }, args.embed);
        await page.waitForTimeout(Number(args.dwell));
        await figure.scrollIntoViewIfNeeded();
        await figure.locator('[role="button"]').click();
        await page.locator(`[data-embed="${args.embed}"] [data-replay-ready]`).waitFor({ timeout: Number(args.timeout) });
        const marks = await page.evaluate(() => {
          const all = performance.getEntriesByType('mark').filter((m) => /^(replay|world):[\w-]+$/.test(m.name));
          const start = all.find((m) => m.name === 'replay:start')!.startTime;
          return Object.fromEntries(all.filter((m) => m.startTime >= start).map((m) => [m.name, Math.round(m.startTime - start)]));
        });
        runs.push({ mode, load, marks });
        console.log(`round ${round + 1} ${mode}: first-frame ${marks['replay:first-frame']} ms, shown ${marks['replay:shown']} ms after the click (load ${load.toFixed(1)})`);
      } finally {
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
}

for (const mode of ['none', 'near-view'] as const) {
  const of = runs.filter((r) => r.mode === mode);
  console.log(`--- ${mode === 'none' ? 'no cache start before the click' : 'cache started near view'}: median of ${of.length} runs, ms after the click (load average ${of.map((r) => r.load.toFixed(0)).join(', ')})`);
  for (const stage of STAGES) {
    const values = of.map((r) => r.marks[stage]).filter((v): v is number => v !== undefined);
    if (values.length) console.log(`  ${String(median(values)).padStart(6)}  ${stage}   [${values.join(', ')}]`);
  }
}
if (args.json) writeFileSync(args.json, JSON.stringify(runs, null, 1));

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return Math.round(sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2);
}
