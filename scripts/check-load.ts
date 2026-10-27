/**
 * The home page's first-load budget, checked against the built site in `vite preview`:
 *
 * - The JavaScript the home page's HTML loads before anything runs (its entry module and the chunks
 *   it modulepreloads) stays under ENTRY_BUDGET, brotli-compressed as Pages serves it.
 * - Loaded without scrolling, on a desktop and a phone, the home page requests only what its first
 *   screen needs: the shell, the story text and the tree, which is the document, hashed files under
 *   /assets/, the roman serif, the sans and the favicon. Anything else (a clip poster, a figure) is
 *   below the fold and must wait for the reader. Two requests are allowed later: the italic, only
 *   once the tree is drawn and the page has loaded (src/lib/fonts.ts), and Cloudflare's analytics
 *   beacon, only after the load event (src/lib/analytics.ts). Chrome resolves rune.fast to the preview server, so the page
 *   runs as on the site; the beacon is answered here with an empty script, so nothing is sent.
 *
 * `--measure` also prints, for the desktop page loaded plainly and over an emulated slow link
 * (300 ms RTT, 1.6 Mbps down, cache disabled): DOMContentLoaded, load, when the first screen is
 * drawn (the tree), and the bytes and requests before load and once the network settles.
 * `vite preview` serves gzip where Pages serves brotli, so its bytes run a little over the site's.
 * It also measures a repeat visit, the cache warm from a first; for that to mean what it does on
 * the site, serve dist/ with Pages' own server, which applies public/_headers, and pass its port:
 *
 *   bun run build && bun run check:load [--measure]
 *   wrangler pages dev dist --ip 127.0.0.1 --port 8791 & bun run check:load --measure --port 8791
 *
 * Exits 1 if any budget is exceeded.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { brotliCompressSync, constants } from 'node:zlib';
import { chromium, type Browser, type BrowserContext, type BrowserContextOptions, type Page } from 'playwright-core';
import { preview } from 'vite';
import { BEACON_SRC } from '../src/lib/analytics';
import { PAGE_ONLY } from '../src/lib/site';

const { values: args } = parseArgs({ options: { measure: { type: 'boolean', default: false }, port: { type: 'string' } } });

/** Brotli bytes of the home page's initial JavaScript. */
const ENTRY_BUDGET = 150 * 1024;

/** What the first screen may request, by path. */
const FIRST_SCREEN: readonly RegExp[] = [
  /^\/$/,
  /^\/assets\/[^/]+\.(js|css)$/,
  /^\/assets\/RuneSerif-Roman\.var-[\w-]+\.woff2$/,
  /^\/assets\/IBMPlexSans-[A-Za-z]+-Latin1-[\w-]+\.woff2$/,
  /^\/favicon[^/]*$/,
];
const ITALIC = /^\/assets\/RuneSerif-Italic\.var-[\w-]+\.woff2$/;

const VIEWPORTS: Record<string, BrowserContextOptions> = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
};

/** The slow link, in DevTools' units: ms, and bytes per second. */
const SLOW = { offline: false, latency: 300, downloadThroughput: 1_600_000 / 8, uploadThroughput: 750_000 / 8 };

const kb = (n: number) => `${(n / 1024).toFixed(0)} KB`;
const s = (ms: number) => `${(ms / 1000).toFixed(2)} s`;

/** Brotli at a middling level, as a CDN compresses on the fly; the maximum would flatter the budget. */
const brotli = (buf: Buffer) => brotliCompressSync(buf, { params: { [constants.BROTLI_PARAM_QUALITY]: 5 } }).length;

/**
 * The entry and the chunks it imports, which the build modulepreloads. A preload marked for one
 * page (the story's tree data, vite.config.ts) is data fetched beside them, not code, and the
 * first-screen check holds it.
 */
function initialScripts(): string[] {
  const html = readFileSync('dist/index.html', 'utf8');
  const entry = [...html.matchAll(/<script\b[^>]*\btype="module"[^>]*\bsrc="([^"]+)"/g)].map((m) => m[1]!);
  const preloads = [...html.matchAll(/<link\b[^>]*\brel="modulepreload"[^>]*>/g)]
    .filter((m) => !m[0].includes(`${PAGE_ONLY}=`))
    .map((m) => /\bhref="([^"]+)"/.exec(m[0])![1]!);
  return [...entry, ...preloads];
}

/** `vite preview` of dist/, answering for rune.fast, which Chrome is told is this machine. */
async function startPreview(): Promise<{ port: number; stop(): Promise<void> }> {
  const server = await preview({
    logLevel: 'warn',
    preview: { host: '127.0.0.1', port: 0, allowedHosts: ['rune.fast'] },
  });
  const address = server.httpServer.address();
  if (!address || typeof address === 'string') throw new Error('vite preview has no port');
  return { port: address.port, stop: () => server.close() };
}

interface Request {
  path: string;
  bytes: number;
  start: number;
}

interface Load {
  dcl: number;
  load: number;
  /** When the tree finished drawing, or null if it never did. */
  drawn: number | null;
  /** The document and every resource, until the network settles. */
  requests: Request[];
}

/** Opens `url` in a fresh tab and waits until no new resource has started for three seconds. */
async function visit(context: BrowserContext, url: string, slow: boolean, cold: boolean): Promise<Page> {
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: cold });
  // The beacon is answered here, through DevTools rather than Playwright's routing, which would
  // turn the browser's cache off and leave a repeat visit nothing to show.
  cdp.on('Fetch.requestPaused', (e) => {
    void cdp.send('Fetch.fulfillRequest', {
      requestId: e.requestId,
      responseCode: 200,
      responseHeaders: [{ name: 'Content-Type', value: 'text/javascript' }],
      body: '',
    });
  });
  await cdp.send('Fetch.enable', { patterns: [{ urlPattern: `${BEACON_SRC}*` }] });
  if (slow) await cdp.send('Network.emulateNetworkConditions', SLOW);
  await page.goto(url, { waitUntil: 'load', timeout: 120_000 });
  let seen = -1;
  for (;;) {
    const n = await page.evaluate(() => performance.getEntriesByType('resource').length);
    if (n === seen) break;
    seen = n;
    await page.waitForTimeout(3000);
  }
  return page;
}

/** A load of `url` with the cache disabled, or with `repeat`, a second visit after a first has filled the cache. */
async function load(browser: Browser, url: string, options: BrowserContextOptions, slow: boolean, repeat = false): Promise<Load> {
  const context = await browser.newContext(options);
  if (repeat) await (await visit(context, url, slow, false)).close();
  const page = await visit(context, url, slow, !repeat);
  const result = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const draw = performance.getEntriesByName('rune:tree-draw')[0];
    const path = (u: string) => {
      const url = new URL(u);
      return url.origin === location.origin ? url.pathname : u;
    };
    const resources = (performance.getEntriesByType('resource') as PerformanceResourceTiming[]).map((r) => ({
      path: path(r.name),
      bytes: r.transferSize,
      start: r.startTime,
    }));
    return {
      dcl: nav.domContentLoadedEventStart,
      load: nav.loadEventStart,
      drawn: draw ? draw.startTime + draw.duration : null,
      requests: [{ path: path(nav.name), bytes: nav.transferSize, start: 0 }, ...resources],
    };
  });
  await context.close();
  return result;
}

/** What is wrong with a home page load, in words; empty if nothing. */
function problems(m: Load): string[] {
  const out: string[] = [];
  if (m.drawn === null) out.push('the tree never drew');
  const beacon = m.requests.filter((r) => r.path.startsWith(BEACON_SRC));
  if (!beacon.length) out.push('no analytics beacon was requested');
  for (const r of beacon) if (r.start < m.load) out.push(`the analytics beacon started at ${s(r.start)}, before load at ${s(m.load)}`);
  for (const r of m.requests) {
    if (r.path.startsWith(BEACON_SRC) || FIRST_SCREEN.some((re) => re.test(r.path))) continue;
    if (ITALIC.test(r.path)) {
      if (m.drawn === null || r.start < m.drawn) out.push(`the italic started at ${s(r.start)}, before the tree was drawn`);
      if (r.start < m.load) out.push(`the italic started at ${s(r.start)}, before load at ${s(m.load)}`);
      continue;
    }
    out.push(`below the fold, requested without scrolling: ${r.path}`);
  }
  return out;
}

let failed = false;

const scripts = initialScripts();
const entryBytes = scripts.reduce((sum, f) => sum + brotli(readFileSync(join('dist', f))), 0);
failed ||= entryBytes > ENTRY_BUDGET;
console.log(
  `${entryBytes > ENTRY_BUDGET ? 'FAIL' : 'ok'}: initial JavaScript ${kb(entryBytes)} brotli (budget ${kb(ENTRY_BUDGET)}): ${scripts.join(', ')}`,
);

const server = args.port ? { port: Number(args.port), stop: async () => {} } : await startPreview();
const browser = await chromium.launch({ channel: 'chrome', args: [`--host-resolver-rules=MAP rune.fast 127.0.0.1`] });
const home = `http://rune.fast:${server.port}/`;
try {
  for (const [name, options] of Object.entries(VIEWPORTS)) {
    const found = problems(await load(browser, home, options, false));
    failed ||= found.length > 0;
    console.log(found.length ? `FAIL: the ${name} home page:\n  ${found.join('\n  ')}` : `ok: the ${name} home page requests only its first screen, then the italic and the beacon`);
  }

  if (args.measure) {
    console.log(
      '\n| Load | DOMContentLoaded | Load event | First screen drawn | Before load | Settled | Over the network |\n|---|---|---|---|---|---|---|',
    );
    const rows: string[] = [];
    const runs = [
      ['Plain', false, false],
      ['300 ms RTT, 1.6 Mbps', true, false],
      ['Repeat visit, 300 ms RTT, 1.6 Mbps', true, true],
    ] as const;
    for (const [label, slow, repeat] of runs) {
      const m = await load(browser, home, VIEWPORTS.desktop!, slow, repeat);
      const early = m.requests.filter((r) => r.start < m.load);
      // A request answered from the cache transfers nothing; a revalidation transfers its headers.
      const fetched = m.requests.filter((r) => r.bytes > 0);
      const sum = (rs: Request[]) => kb(rs.reduce((t, r) => t + r.bytes, 0));
      console.log(
        `| ${label} | ${s(m.dcl)} | ${s(m.load)} | ${m.drawn === null ? 'never' : s(m.drawn)} | ` +
          `${sum(early)} in ${early.length} | ${sum(m.requests)} in ${m.requests.length} | ${fetched.length} requests |`,
      );
      if (slow) {
        rows.push(`  ${label}:`);
        for (const r of m.requests) rows.push(`    ${s(r.start).padStart(7)} ${kb(r.bytes).padStart(7)}  ${r.path}`);
      }
    }
    console.log(`\nThe slow loads' requests, by start:\n${rows.join('\n')}`);
  }
} finally {
  await browser.close();
  await server.stop();
}

process.exit(failed ? 1 : 0);
