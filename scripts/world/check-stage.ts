/**
 * Checks that replay embeds share the page's one 3D world, in system Chrome: plays two replay
 * embeds in turn, `--switches` times, and after each counts the live WebGL2 contexts and the workers
 * the page has made (by wrapping getContext and Worker before the page loads), reads the JS heap after
 * a forced collection, and waits for the playing embed's data-replay-ready signal (the followed
 * account drawn), so a blank canvas after a switch fails. Each switch's frame is saved as a PNG.
 *
 *   bun scripts/world/check-stage.ts [--base http://localhost:5173] [--page /tokens] \
 *     [--embeds agility-lap,agility-rocks] [--switches 5] [--out .world/stage]
 *
 * Exits 1 if more than one context or one pool's workers are made, or an embed never draws.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright-core';

const { values: args } = parseArgs({
  options: {
    base: { type: 'string', default: 'http://localhost:5173' },
    page: { type: 'string', default: '/tokens' },
    embeds: { type: 'string', default: 'agility-lap,agility-rocks' },
    switches: { type: 'string', default: '5' },
    out: { type: 'string', default: '.world/stage' },
    timeout: { type: 'string', default: '90000' },
  },
});

const embeds = args.embeds.split(',');
const timeout = Number(args.timeout);
mkdirSync(args.out, { recursive: true });
const browser = await chromium.launch({
  channel: 'chrome',
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=metal', '--enable-unsafe-swiftshader', '--js-flags=--expose-gc', '--enable-precise-memory-info'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await page.addInitScript(() => {
  const made = { contexts: new Set<WebGL2RenderingContext>(), workers: 0 };
  (window as unknown as { __made: typeof made }).__made = made;
  const getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string, ...rest: unknown[]) {
    const ctx = (getContext as (...a: unknown[]) => unknown).call(this, kind, ...rest);
    if (kind === 'webgl2' && ctx) made.contexts.add(ctx as WebGL2RenderingContext);
    return ctx;
  } as typeof getContext;
  const NativeWorker = window.Worker;
  window.Worker = class extends NativeWorker {
    constructor(...a: ConstructorParameters<typeof Worker>) {
      super(...a);
      made.workers++;
    }
  };
});
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(args.base + args.page);

type Row = { step: number; embed: string; contexts: number; workers: number; heapMb: number; readyMs: number | null };
const rows: Row[] = [];
let failed = false;
for (let step = 0; step < Number(args.switches) * embeds.length; step++) {
  const id = embeds[step % embeds.length]!;
  const figure = page.locator(`[data-embed="${id}"]`);
  await figure.scrollIntoViewIfNeeded();
  const started = Date.now();
  await figure.locator('[role="button"]').click();
  let readyMs: number | null = null;
  try {
    await page.locator(`[data-embed="${id}"][data-phase="playing"]`).waitFor({ timeout });
    await page.locator(`[data-embed="${id}"] [data-replay-ready]`).waitFor({ timeout });
    readyMs = Date.now() - started;
  } catch {
    failed = true;
  }
  await figure.locator('[role="button"]').screenshot({ path: join(args.out, `${step}-${id}.png`) });
  const m = await page.evaluate(() => {
    (window as unknown as { gc?: () => void }).gc?.();
    const made = (window as unknown as { __made: { contexts: Set<WebGL2RenderingContext>; workers: number } }).__made;
    const heap = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0;
    // Live contexts only: the engine's WebGL2 probe makes one and releases it at once.
    const live = [...made.contexts].filter((c) => !c.isContextLost()).length;
    return { contexts: live, workers: made.workers, heapMb: Math.round(heap / 1e5) / 10 };
  });
  rows.push({ step, embed: id, ...m, readyMs });
  console.log(`switch ${step}: ${id} drawn ${readyMs === null ? 'NEVER' : `${readyMs} ms`} after the click; ${m.contexts} WebGL2 context(s), ${m.workers} worker(s), JS heap ${m.heapMb} MB`);
}
await browser.close();

const last = rows.at(-1)!;
if (last.contexts !== 1) {
  console.error(`expected one live WebGL2 context, the page holds ${last.contexts}`);
  failed = true;
}
if (last.workers > 4) {
  console.error(`expected one pool (at most 4 workers), the page made ${last.workers}`);
  failed = true;
}
for (const e of errors.slice(0, 10)) console.error(`page error: ${e}`);
process.exit(failed ? 1 : 0);
