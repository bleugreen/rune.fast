/**
 * Load time of one replay moment, from the page's own User Timing marks (replay:*, world:*), in
 * system Chrome. Each run gets a fresh browser context, so Cache Storage and the HTTP cache start
 * empty.
 *
 *   bun scripts/world/bench-load.ts [--base http://localhost:4173] [--shot cannon@200] [--runs 5] \
 *     [--mode cold] [--mode prefetched] [--headed] [--json out.json]
 *
 * Modes: `cold` opens the moment directly. `prefetched` opens /replay first, waits for its cache
 * prefetch (replay:cache-prefetched), then opens the moment in the same context. Modes alternate
 * within each round, so a swing in the machine's load lands on all of them.
 */
import { writeFileSync } from 'node:fs';
import { loadavg } from 'node:os';
import { parseArgs } from 'node:util';
import { chromium, type BrowserContext } from 'playwright-core';

const { values: args } = parseArgs({
  options: {
    base: { type: 'string', default: 'http://localhost:4173' },
    shot: { type: 'string', default: 'cannon@200' },
    runs: { type: 'string', default: '5' },
    mode: { type: 'string', multiple: true, default: ['cold'] },
    headed: { type: 'boolean', default: false },
    json: { type: 'string' },
    timeout: { type: 'string', default: '120000' },
  },
});

type Mode = 'cold' | 'prefetched';
type Run = {
  mode: Mode;
  load: number;
  marks: Record<string, number>;
  // /replay, prefetched mode only: its first contentful paint, the prefetch's span, and the
  // main-thread long tasks that overlapped the prefetch.
  index?: { fcp: number; prefetchStart: number; prefetched: number; longTasks: number[] };
};

// Stages reported, in load order; `ready` includes the page's 0.8 s settle window.
const STAGES = [
  'replay:start', 'replay:workers-started', 'replay:manifest', 'replay:fonts', 'replay:cache-fetched', 'replay:cache-indexed',
  'replay:seeked', 'world:renderer-init', 'world:renderer-loader', 'replay:first-frame', 'replay:maps-loaded',
  'replay:followed-drawn', 'replay:settled', 'replay:ready',
];

const modes = args.mode as Mode[];
for (const m of modes) if (m !== 'cold' && m !== 'prefetched') throw new Error(`unknown mode ${m}`);
const [moment, tick] = args.shot.split('@') as [string, string];
const url = `${args.base}/replay/${moment}?t=${tick}&paused`;

const browser = await chromium.launch({
  channel: 'chrome',
  headless: !args.headed,
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=metal', '--enable-unsafe-swiftshader'],
});
const runs: Run[] = [];
try {
  for (let round = 0; round < Number(args.runs); round++) {
    for (const mode of modes) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
      try {
        const run = await measure(context, mode);
        runs.push(run);
        console.log(`${mode.padEnd(10)} round ${round + 1}: first-frame ${run.marks['replay:first-frame']} ms, ready ${run.marks['replay:ready']} ms (load ${run.load.toFixed(1)})`);
      } finally {
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
}

for (const mode of modes) {
  const of = runs.filter((r) => r.mode === mode);
  console.log(`--- ${mode}: median of ${of.length} runs, ms after navigation (load average ${of.map((r) => r.load.toFixed(0)).join(', ')})`);
  for (const stage of STAGES) {
    const values = of.map((r) => r.marks[stage]).filter((v): v is number => v !== undefined);
    if (values.length) console.log(`  ${String(median(values)).padStart(6)}  ${stage}   [${values.join(', ')}]`);
  }
  const wait = of.map((r) => r.marks['world:renderer-loader']! - r.marks['world:renderer-init']!);
  console.log(`  ${String(median(wait)).padStart(6)}  renderer waiting on the workers (renderer-init to renderer-loader)   [${wait.join(', ')}]`);
  const indexes = of.flatMap((r) => (r.index ? [r.index] : []));
  if (indexes.length) {
    const span = (f: (i: NonNullable<Run['index']>) => number) => `${median(indexes.map(f))}  [${indexes.map(f).join(', ')}]`;
    console.log(`  /replay first contentful paint: ${span((i) => i.fcp)}`);
    console.log(`  /replay prefetch start: ${span((i) => i.prefetchStart)}`);
    console.log(`  /replay prefetch done: ${span((i) => i.prefetched)}`);
    console.log(`  /replay long tasks during the prefetch: ${indexes.map((i) => `[${i.longTasks.join(', ')}]`).join(' ')}`);
  }
}
if (args.json) writeFileSync(args.json, JSON.stringify(runs, null, 1));

async function measure(context: BrowserContext, mode: Mode): Promise<Run> {
  const page = await context.newPage();
  page.on('pageerror', (e) => console.error(`page error: ${e.message}`));
  let index: Run['index'];
  if (mode === 'prefetched') {
    await page.addInitScript(() => {
      const w = window as unknown as { longTasks: [number, number][] };
      w.longTasks = [];
      new PerformanceObserver((list) => list.getEntries().forEach((e) => w.longTasks.push([e.startTime, e.duration]))).observe({ type: 'longtask', buffered: true });
    });
    await page.goto(`${args.base}/replay`);
    await page.waitForFunction(() => performance.getEntriesByName('replay:cache-prefetched').length > 0, null, { timeout: Number(args.timeout) });
    index = await page.evaluate(() => {
      const at = (name: string) => Math.round(performance.getEntriesByName(name)[0]!.startTime);
      const start = at('replay:prefetch-start');
      const done = at('replay:cache-prefetched');
      const tasks = (window as unknown as { longTasks: [number, number][] }).longTasks;
      return {
        fcp: at('first-contentful-paint'),
        prefetchStart: start,
        prefetched: done,
        longTasks: tasks.filter(([s, d]) => s + d >= start && s <= done).map(([, d]) => Math.round(d)),
      };
    });
  }
  const load = loadavg()[0]!;
  await page.goto(url);
  await page.locator('[data-replay-ready]').waitFor({ timeout: Number(args.timeout) });
  const marks = await page.evaluate(() =>
    Object.fromEntries(
      performance.getEntriesByType('mark').filter((m) => /^(replay|world):/.test(m.name)).map((m) => [m.name.split(' ')[0]!, Math.round(m.startTime)]),
    ),
  );
  return { mode, load, marks, index };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return Math.round(sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2);
}
