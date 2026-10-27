/**
 * Screenshots footage embeds in system Chrome, through the frame's own controls.
 *
 *   bun scripts/world/shoot.ts [--base http://localhost:5173] [--page /tokens] [--out .world/shots] \
 *     [--shot agility-lap@0:agility-lap] [--mode still|playing] [--bare] [--scale 2] [--headed] [--timings]
 *
 * A shot is <embed id>@<seconds into the window>:<name>. `still` plays, pauses at once and steps
 * to the second given, then for a replay waits for its data-replay-ready signal (the followed
 * account drawn, no map squares or bakes outstanding); `playing` plays for that many seconds
 * first. Each shot writes <name>.png (the figure with its caption) and <name>-frame.png (the frame
 * alone); `--bare` hides the play mark, for a poster. Prints each page's console errors.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { chromium, type Page } from 'playwright-core';

const { values: args } = parseArgs({
  options: {
    base: { type: 'string', default: 'http://localhost:5173' },
    page: { type: 'string', default: '/tokens' },
    out: { type: 'string', default: '.world/shots' },
    shot: { type: 'string', multiple: true, default: ['agility-lap@0:agility-lap'] },
    mode: { type: 'string', default: 'still' },
    bare: { type: 'boolean', default: false },
    headed: { type: 'boolean', default: false },
    // Print the load stages (the page's replay:* marks), network and worker timings.
    timings: { type: 'boolean', default: false },
    width: { type: 'string', default: '1440' },
    // Device pixels per CSS pixel; a poster is shot above its registered size and scaled down.
    scale: { type: 'string', default: '2' },
    timeout: { type: 'string', default: '180000' },
  },
});

const timeout = Number(args.timeout);
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
    const [id, at] = where.split('@') as [string, string];
    const seconds = Number(at ?? 0);
    const page = await browser.newPage({ viewport: { width: Number(args.width), height: 900 }, deviceScaleFactor: Number(args.scale) });
    const errors: string[] = [];
    const logs: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
      logs.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(args.base + args.page);
    watchReload(page);
    const figure = page.locator(`[data-embed="${id}"]`);
    const frame = figure.locator('[role="button"]');
    const replay = (await figure.getAttribute('data-kind')) === 'replay';
    await figure.scrollIntoViewIfNeeded();
    const started = Date.now();
    try {
      await frame.click();
      if (args.mode === 'playing') {
        await page.locator(`[data-embed="${id}"][data-phase="playing"]`).waitFor({ timeout });
        console.log(`${name}: playing ${((Date.now() - started) / 1000).toFixed(1)} s after the click`);
        await page.waitForTimeout(seconds * 1000);
      } else {
        // Paused before the first frame: the replay shows its first tick, still, once drawn.
        await page.keyboard.press('Space');
        await page.locator(`[data-embed="${id}"][data-phase="paused"]`).waitFor({ timeout });
        if (replay) await ready(page, id);
        for (let i = 0; i < seconds; i++) await page.keyboard.press('ArrowRight');
        if (replay) await ready(page, id);
        else await page.waitForTimeout(800);
        console.log(`${name}: ${seconds} s into the window, ready ${((Date.now() - started) / 1000).toFixed(1)} s after the click`);
      }
    } catch (e) {
      failed++;
      console.error(`${name}: ${(e as Error).message.split('\n')[0]}`);
    }
    if (args.bare) await page.addStyleTag({ content: '[data-embed] [role="button"] > span[aria-hidden] { display: none }' });
    await figure.screenshot({ path: join(args.out, `${name}.png`) });
    await frame.screenshot({ path: join(args.out, `${name}-frame.png`) });
    console.log(`${name}: ${join(args.out, `${name}.png`)} and ${name}-frame.png`);
    for (const e of errors.slice(0, 10)) console.error(`${name}: console error: ${e}`);
    if (args.timings) await report(page, name, logs);
    await page.close();
  }
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);

/** Waits for the replay to settle, after giving a seek time to clear the previous signal. */
async function ready(page: Page, id: string): Promise<void> {
  await page.waitForTimeout(300);
  await Promise.race([page.locator(`[data-embed="${id}"] [data-replay-ready]`).waitFor({ timeout }), reloaded.get(page)]);
}

const reloaded = new WeakMap<Page, Promise<never>>();

/**
 * Fails the shot at once if the page reloads after its first load. Under `bun run dev`, Vite reloads
 * the page when a watched file changes, and on macOS the event for a file written just before the
 * server started can arrive seconds later: edit `data/clips.json`, wait a few seconds, then shoot.
 */
function watchReload(page: Page): void {
  const promise = new Promise<never>((_, reject) => {
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) reject(new Error('the page reloaded (under the dev server: a watched file changed)'));
    });
  });
  promise.catch(() => {});
  reloaded.set(page, promise);
}

/** The page's replay:* marks against navigation start, its cache and chunk fetches, and the workers' own timings. */
async function report(page: Page, label: string, logs: string[]): Promise<void> {
  const t = await page.evaluate(() => ({
    marks: performance.getEntriesByType('mark').filter((m) => /^(replay|world):/.test(m.name)).sort((a, b) => a.startTime - b.startTime).map((m) => [m.name, Math.round(m.startTime)] as const),
    fetches: performance
      .getEntriesByType('resource')
      .map((r) => r as PerformanceResourceTiming)
      .filter((r) => /main_file_cache|chunk-|manifest\.json|keys\.json|RenderDataWorker|Replay/.test(r.name))
      .map((r) => [r.name.split('/').pop()!, Math.round(r.startTime), Math.round(r.responseEnd), r.transferSize] as const),
  }));
  console.log(`--- ${label}`);
  for (const [stage, at] of t.marks) console.log(`  ${String(at).padStart(6)} ms  ${stage}`);
  for (const [file, start, end, bytes] of t.fetches) console.log(`  fetch ${file}: ${start}-${end} ms (${end - start} ms, ${bytes} bytes over the wire)`);
  const workers = logs.filter((l) => l.includes('worker ready')).map((l) => l.replace('[world] ', ''));
  if (workers.length) console.log(`  workers: ${workers.join('; ')}`);
}
