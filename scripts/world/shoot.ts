/**
 * Screenshots replay ticks in system Chrome, waiting for the page's data-replay-ready signal
 * (requested tick reached, the followed account drawn, no map squares or bakes outstanding).
 *
 *   bun scripts/world/shoot.ts [--base http://localhost:4173] [--out .world/shots] [--headed] \
 *     [--shot 6095:finish-agility-99] [--shot 1:finish-login]
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
    clip: { type: 'string', default: 'finish' },
    out: { type: 'string', default: '.world/shots' },
    shot: { type: 'string', multiple: true, default: ['6095:finish-agility-99', '1:finish-login'] },
    headed: { type: 'boolean', default: false },
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
    const [tick, name] = spec.split(':') as [string, string];
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
    const errors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(e.message));
    const url = `${args.base}/replay/${args.clip}?t=${tick}&paused`;
    const started = Date.now();
    await page.goto(url);
    const replay = page.locator('[data-replay]');
    try {
      await page.locator('[data-replay-ready]').waitFor({ timeout: Number(args.timeout) });
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
    console.log(`${name}: tick ${tick}, ready in ${((Date.now() - started) / 1000).toFixed(1)} s, renderer ${webgl}, ${file}`);
    for (const e of errors.slice(0, 10)) console.error(`${name}: console error: ${e}`);
    await page.close();
  }
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
