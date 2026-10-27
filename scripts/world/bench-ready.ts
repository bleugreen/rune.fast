/**
 * Cold loads of replay embeds to their data-replay-ready signal, in system Chrome, as shoot.ts
 * drives them: click, Space (paused at the window's first tick), wait for ready, then optionally
 * step with ArrowRight and wait again after each `--step` seconds. Every load is a fresh browser
 * context, so Cache Storage and the HTTP cache start empty. A load that misses `--timeout` prints
 * the page's replay marks since the click and, under `bun run dev`, `window.__replay()`: the
 * stage's claim phase, the driver's seek state, the follow and the renderer's outstanding work.
 *
 *   bun scripts/world/bench-ready.ts [--base http://localhost:5173] [--page /tokens] \
 *     [--embeds agility-lap,agility-rocks] [--runs 20] [--parallel 1] [--throttle 1] \
 *     [--steps 0] [--step 6] [--timeout 30000] [--out .world/bench-ready]
 *
 * `--throttle N` slows each page's main thread N times (DevTools CPU throttling), and
 * `--parallel` loads that many pages at once, both standing in for the shared Mac under load.
 * Exits 1 if any load or step misses its timeout.
 */
import { mkdirSync } from 'node:fs';
import { loadavg } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { chromium, type Page } from 'playwright-core';

const { values: args } = parseArgs({
  options: {
    base: { type: 'string', default: 'http://localhost:5173' },
    page: { type: 'string', default: '/tokens' },
    embeds: { type: 'string', default: 'agility-lap,agility-rocks' },
    runs: { type: 'string', default: '20' },
    parallel: { type: 'string', default: '1' },
    throttle: { type: 'string', default: '1' },
    steps: { type: 'string', default: '0' },
    step: { type: 'string', default: '6' },
    timeout: { type: 'string', default: '30000' },
    out: { type: 'string', default: '.world/bench-ready' },
    headed: { type: 'boolean', default: false },
  },
});

const embeds = args.embeds.split(',');
const runs = Number(args.runs);
const timeout = Number(args.timeout);
const throttle = Number(args.throttle);
mkdirSync(args.out, { recursive: true });

type Result = { embed: string; run: number; load: number; readyMs: (number | null)[] };

const browser = await chromium.launch({
  channel: 'chrome',
  headless: !args.headed,
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=metal', '--enable-unsafe-swiftshader'],
});
const results: Result[] = [];
const queue = embeds.flatMap((embed) => Array.from({ length: runs }, (_, run) => ({ embed, run })));
try {
  await Promise.all(
    Array.from({ length: Number(args.parallel) }, async () => {
      for (let job = queue.shift(); job; job = queue.shift()) results.push(await once(job.embed, job.run));
    }),
  );
} finally {
  await browser.close();
}

let failed = false;
for (const embed of embeds) {
  const of = results.filter((r) => r.embed === embed);
  const steps = Math.max(0, ...of.map((r) => r.readyMs.length));
  for (let s = 0; s < steps; s++) {
    const values = of.map((r) => r.readyMs[s]);
    const ok = values.filter((v): v is number => typeof v === 'number').sort((a, b) => a - b);
    const missed = values.filter((v) => v === null).length;
    if (missed) failed = true;
    const what = s === 0 ? 'cold load to ready' : `step ${s} (+${s * Number(args.step)} s) to ready`;
    console.log(
      `${embed} ${what}: ${ok.length}/${values.length} ready; ms min ${ok[0] ?? '-'}, median ${pct(ok, 0.5)}, p90 ${pct(ok, 0.9)}, max ${ok.at(-1) ?? '-'}${missed ? `; ${missed} missed ${timeout} ms` : ''}`,
    );
  }
}
process.exit(failed ? 1 : 0);

async function once(embed: string, run: number): Promise<Result> {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const result: Result = { embed, run, load: loadavg()[0]!, readyMs: [] };
  try {
    const page = await context.newPage();
    page.on('pageerror', (e) => console.error(`${embed}#${run}: page error: ${e.message}`));
    page.on('console', (m) => m.type() === 'error' && console.error(`${embed}#${run}: console error: ${m.text()}`));
    if (throttle > 1) {
      const cdp = await context.newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
    }
    await page.goto(args.base + args.page);
    const figure = page.locator(`[data-embed="${embed}"]`);
    await figure.scrollIntoViewIfNeeded();
    const frame = figure.locator('[role="button"]');
    const started = Date.now();
    await frame.click();
    await page.keyboard.press('Space');
    for (let s = 0; s <= Number(args.steps); s++) {
      if (s > 0) for (let i = 0; i < Number(args.step); i++) await page.keyboard.press('ArrowRight');
      const from = s === 0 ? started : Date.now();
      const ms = await ready(page, embed, from);
      result.readyMs.push(ms);
      const label = s === 0 ? 'cold load' : `step ${s}`;
      if (ms === null) {
        console.log(`${embed}#${run} ${label}: NOT READY after ${timeout} ms (load ${result.load.toFixed(0)})`);
        await diagnose(page, embed, join(args.out, `${embed}-${run}-${s}.png`));
        break;
      }
      console.log(`${embed}#${run} ${label}: ready ${ms} ms (load ${result.load.toFixed(0)})`);
      if (s > 0) await frame.screenshot({ path: join(args.out, `${embed}-${run}-${s}.png`) });
    }
  } catch (e) {
    console.error(`${embed}#${run}: ${(e as Error).message.split('\n')[0]}`);
    result.readyMs.push(null);
  } finally {
    await context.close();
  }
  return result;
}

/** ms from `from` until the embed is ready, after giving a seek time to clear the previous signal; null on timeout. */
async function ready(page: Page, embed: string, from: number): Promise<number | null> {
  await page.waitForTimeout(300);
  try {
    await page.locator(`[data-embed="${embed}"] [data-replay-ready]`).waitFor({ timeout });
    return Date.now() - from;
  } catch {
    return null;
  }
}

async function diagnose(page: Page, embed: string, shot: string): Promise<void> {
  const d = await page.evaluate(() => {
    const marks = performance.getEntriesByType('mark').filter((m) => /^(replay|world):/.test(m.name));
    const start = marks.find((m) => m.name === 'replay:start')?.startTime ?? 0;
    return {
      phase: document.querySelector('[data-embed]')?.getAttribute('data-phase'),
      marks: marks.map((m) => `${String(Math.round(m.startTime - start)).padStart(7)} ms  ${m.name}`),
      state: (window as unknown as { __replay?: () => unknown }).__replay?.(),
    };
  });
  console.log(`  frame phase: ${d.phase}`);
  for (const m of d.marks) console.log(`  ${m}`);
  console.log(`  __replay(): ${JSON.stringify(d.state)}`);
  await page.locator(`[data-embed="${embed}"] [role="button"]`).screenshot({ path: shot }).catch(() => {});
}

function pct(sorted: number[], p: number): number | string {
  if (!sorted.length) return '-';
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]!;
}
