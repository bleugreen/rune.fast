/**
 * The home page's first-load budget, checked against the built site in `vite preview`:
 *
 * - The JavaScript the home page's HTML loads before anything runs (its entry module and the chunks
 *   it modulepreloads) stays under ENTRY_BUDGET, brotli-compressed as Pages serves it.
 * - What the home page requests before its load event is only what its first screen needs: the
 *   shell, the story text and the tree, which is the document, hashed files under /assets/, the
 *   roman serif, the sans and the favicon. Anything else there (a clip poster, the italic, a figure)
 *   is below the fold and should wait until the reader nears it. Checked on a desktop and a phone.
 *
 * `--measure` also prints, for the desktop page loaded plainly and over an emulated slow link
 * (300 ms RTT, 1.6 Mbps down, cache disabled), DOMContentLoaded, load, and the bytes and requests
 * before load and once the network settles. `vite preview` serves files uncompressed, so its bytes
 * are larger than Pages' (which serves brotli) and the slow-link times are pessimistic.
 *
 *   bun run build && bun run check:load [--measure] [--base http://localhost:4173]
 *
 * Without --base it starts `vite preview` itself. Exits 1 if either budget is exceeded.
 */
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { brotliCompressSync, constants } from 'node:zlib';
import { chromium, type Browser, type BrowserContextOptions } from 'playwright-core';

const { values: args } = parseArgs({
  options: {
    base: { type: 'string' },
    measure: { type: 'boolean', default: false },
  },
});

/** Brotli bytes of the home page's initial JavaScript. */
export const ENTRY_BUDGET = 150 * 1024;

/** What the first screen may request before the load event, by path. */
const FIRST_SCREEN: readonly RegExp[] = [
  /^\/$/,
  /^\/assets\/[^/]+\.(js|css|json)$/,
  /^\/fonts\/RuneSerif-Roman\.var\.woff2$/,
  /^\/fonts\/IBMPlexSans-[A-Za-z]+-Latin1\.woff2$/,
  /^\/favicon[^/]*$/,
];

const VIEWPORTS: Record<string, BrowserContextOptions> = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
};

/** The slow link: DevTools' units, bytes per second and ms. */
const SLOW = { offline: false, latency: 300, downloadThroughput: 1_600_000 / 8, uploadThroughput: 750_000 / 8 };

const kb = (n: number) => `${(n / 1024).toFixed(0)} KB`;

/** Pages compresses at a lower brotli level than the maximum; 5 matches what it served for the same files. */
const brotli = (buf: Buffer) => brotliCompressSync(buf, { params: { [constants.BROTLI_PARAM_QUALITY]: 5 } }).length;

function initialScripts(): string[] {
  const html = readFileSync('dist/index.html', 'utf8');
  const entry = [...html.matchAll(/<script\b[^>]*\btype="module"[^>]*\bsrc="([^"]+)"/g)].map((m) => m[1]!);
  const preloads = [...html.matchAll(/<link\b[^>]*\brel="modulepreload"[^>]*\bhref="([^"]+)"/g)].map((m) => m[1]!);
  return [...entry, ...preloads];
}

async function startPreview(): Promise<{ base: string; stop(): void }> {
  const port = 4300 + Math.floor(Math.random() * 600);
  const child = spawn('node_modules/.bin/vite', ['preview', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
  const base = `http://localhost:${port}`;
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(base)).ok) return { base, stop: () => child.kill() };
    } catch {
      // not listening yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  child.kill();
  throw new Error(`vite preview did not answer on ${base}`);
}

interface Load {
  dcl: number;
  load: number;
  /** [path, transfer bytes, started before load] for the document and every resource. */
  requests: [string, number, boolean][];
}

async function load(browser: Browser, base: string, options: BrowserContextOptions, slow: boolean): Promise<Load> {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  if (slow) await cdp.send('Network.emulateNetworkConditions', SLOW);
  await page.goto(`${base}/`, { waitUntil: 'load', timeout: 120_000 });
  // Settled: no new resource for two seconds.
  let seen = -1;
  for (;;) {
    const n = await page.evaluate(() => performance.getEntriesByType('resource').length);
    if (n === seen) break;
    seen = n;
    await page.waitForTimeout(2000);
  }
  const result = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const path = (u: string) => {
      const url = new URL(u);
      return url.origin === location.origin ? url.pathname : u;
    };
    const resources = (performance.getEntriesByType('resource') as PerformanceResourceTiming[]).map(
      (r) => [path(r.name), r.transferSize, r.startTime < nav.loadEventStart] as [string, number, boolean],
    );
    return {
      dcl: nav.domContentLoadedEventStart,
      load: nav.loadEventStart,
      requests: [[path(nav.name), nav.transferSize, true] as [string, number, boolean], ...resources],
    };
  });
  await context.close();
  return result;
}

let failed = false;

const scripts = initialScripts();
const entryBytes = scripts.reduce((sum, s) => sum + brotli(readFileSync(join('dist', s))), 0);
const over = entryBytes > ENTRY_BUDGET;
failed ||= over;
console.log(
  `${over ? 'FAIL' : 'ok'}: initial JavaScript ${kb(entryBytes)} brotli (budget ${kb(ENTRY_BUDGET)}): ${scripts.join(', ')}`,
);

const preview = args.base ? { base: args.base, stop() {} } : await startPreview();
const browser = await chromium.launch({ channel: 'chrome' });
try {
  for (const [name, options] of Object.entries(VIEWPORTS)) {
    const { requests } = await load(browser, preview.base, options, false);
    const extra = requests.filter(([p, , early]) => early && !FIRST_SCREEN.some((re) => re.test(p))).map(([p]) => p);
    failed ||= extra.length > 0;
    console.log(
      extra.length
        ? `FAIL: the ${name} home page requests what its first screen does not show before load: ${extra.join(', ')}`
        : `ok: the ${name} home page requests only its first screen before load`,
    );
  }

  if (args.measure) {
    console.log('\n| Link | DOMContentLoaded | Load | Before load | Settled |\n|---|---|---|---|---|');
    for (const slow of [false, true]) {
      const m = await load(browser, preview.base, VIEWPORTS.desktop!, slow);
      const early = m.requests.filter(([, , e]) => e);
      const sum = (rs: typeof m.requests) => kb(rs.reduce((s, [, b]) => s + b, 0));
      console.log(
        `| ${slow ? '300 ms RTT, 1.6 Mbps' : 'Plain'} | ${(m.dcl / 1000).toFixed(2)} s | ${(m.load / 1000).toFixed(2)} s | ` +
          `${sum(early)} in ${early.length} | ${sum(m.requests)} in ${m.requests.length} |`,
      );
      if (slow) for (const [p, b, e] of m.requests) console.log(`    ${e ? 'before load' : 'after load '} ${kb(b).padStart(7)}  ${p}`);
    }
  }
} finally {
  await browser.close();
  preview.stop();
}

process.exit(failed ? 1 : 0);
