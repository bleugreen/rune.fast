/**
 * Screenshots replay ticks in system Chrome, waiting for the page's data-replay-ready signal
 * (requested tick reached, the followed account drawn, no map squares or bakes outstanding).
 *
 *   bun scripts/world/shoot.ts [--base http://localhost:4173] [--out .world/shots] [--headed] \
 *     [--shot agility-99@6095:agility-99] [--shot rekit@10:rekit] [--timings] [--reload]
 *
 * Prints each page's console errors and, against a dev server, its dev status line.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright-core';

const { values: args } = parseArgs({
  options: {
    base: { type: 'string', default: 'http://localhost:4173' },
    out: { type: 'string', default: '.world/shots' },
    shot: { type: 'string', multiple: true, default: ['rekit@12:rekit', 'cannon@232:cannon', 'agility-99@6095:agility-99'] },
    headed: { type: 'boolean', default: false },
    // Print the load stages (the page's replay:* marks), network and worker timings.
    timings: { type: 'boolean', default: false },
    // After the first load, reload once with the browser's caches warm and measure again.
    reload: { type: 'boolean', default: false },
    timeout: { type: 'string', default: '180000' },
  },
});

mkdirSync(args.out, { recursive: true });
const browser = await chromium.launch({
  channel: 'chrome',
  headless: !args.headed,
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=metal', '--enable-unsafe-swiftshader'],
});
let failed = 0;
try {
  for (const spec of args.shot) {
    const [where, name] = spec.split(':') as [string, string];
    const [moment, tick] = where.split('@') as [string, string];
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
    const errors: string[] = [];
    const logs: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
      logs.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(e.message));
    const url = `${args.base}/replay/${moment}?t=${tick}&paused`;
    const started = Date.now();
    await page.goto(url);
    const replay = page.locator('[data-replay]');
    try {
      await page.locator('[data-replay-ready]').waitFor({ timeout: Number(args.timeout) });
      console.log(`${name}: data-replay-ready ${((Date.now() - started) / 1000).toFixed(1)} s after navigation began`);
    } catch {
      failed++;
      console.error(`${name}: not ready after ${args.timeout} ms`);
    }
    const status = await page.locator('[data-dev-status]').textContent().catch(() => null);
    if (status) console.log(`${name}: ${status}`);
    const webgl = await page.evaluate(() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      const info = gl?.getExtension('WEBGL_debug_renderer_info');
      return info ? String(gl!.getParameter(info.UNMASKED_RENDERER_WEBGL)) : gl ? 'webgl2' : 'none';
    });
    const file = join(args.out, `${name}.png`);
    await replay.scrollIntoViewIfNeeded().catch(() => {});
    await (await replay.count() ? replay : page.locator('main')).screenshot({ path: file });
    console.log(`${name}: tick ${tick}, shot taken ${((Date.now() - started) / 1000).toFixed(1)} s after navigation began (the element screenshot is the slow part), renderer ${webgl}, ${file}`);
    for (const e of errors.slice(0, 10)) console.error(`${name}: console error: ${e}`);
    if (args.timings) await report(page, `${name} (cold)`, logs);
    if (args.reload) {
      logs.length = 0;
      await page.reload();
      await page.locator('[data-replay-ready]').waitFor({ timeout: Number(args.timeout) }).catch(() => console.error(`${name}: not ready after reload`));
      await report(page, `${name} (warm)`, logs);
    }
    await page.close();
  }
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);

/** The page's replay:* marks against navigation start, its cache and chunk fetches, and the workers' own timings. */
async function report(page: import('playwright-core').Page, label: string, logs: string[]): Promise<void> {
  const t = await page.evaluate(() => ({
    marks: performance.getEntriesByType('mark').filter((m) => /^(replay|world):/.test(m.name)).sort((a, b) => a.startTime - b.startTime).map((m) => [m.name, Math.round(m.startTime)] as const),
    fetches: performance
      .getEntriesByType('resource')
      .map((r) => r as PerformanceResourceTiming)
      .filter((r) => /main_file_cache|chunk-|manifest\.json|keys\.json|RenderDataWorker|ReplayPage|MomentPage/.test(r.name))
      .map((r) => [r.name.split('/').pop()!, Math.round(r.startTime), Math.round(r.responseEnd), r.transferSize] as const),
  }));
  console.log(`--- ${label}`);
  for (const [stage, at] of t.marks) console.log(`  ${String(at).padStart(6)} ms  ${stage}`);
  for (const [file, start, end, bytes] of t.fetches) console.log(`  fetch ${file}: ${start}-${end} ms (${end - start} ms, ${bytes} bytes over the wire)`);
  const workers = logs.filter((l) => l.includes('worker ready')).map((l) => l.replace('[world] ', ''));
  if (workers.length) console.log(`  workers: ${workers.join('; ')}`);
  const maps = logs.map((l) => /^load map (\d+,\d+): ([\d.]+) ?ms/.exec(l)).filter((m): m is RegExpExecArray => !!m).map((m) => Number(m[2]));
  if (maps.length) {
    maps.sort((a, b) => a - b);
    console.log(`  map squares built in workers: ${maps.length}, median ${Math.round(maps[maps.length >> 1]!)} ms, max ${Math.round(maps[maps.length - 1]!)} ms, sum ${Math.round(maps.reduce((a, b) => a + b, 0))} ms`);
  }
}
