/**
 * Checks that every page's built HTML carries the page, and that the app takes it over in place:
 *
 * - Each page's HTML in dist/ holds the page's own h1 and the paragraph after it, as the page's
 *   components render them from the source data here (under scripts/test-preload.ts, apart from
 *   the build's server entry), and the story's HTML holds its title and its first section's
 *   opening paragraph as data/story.md has them.
 * - Opened in Chrome with JavaScript off, every page shows its heading; Nothing here too.
 * - The app hydrates every page and an unknown path in place, opened at 1440 and 390 px wide in
 *   Perth's zone (the build's is UTC): the console logs no error or warning, the app keeps the
 *   server's DOM rather than drawing its own, and from the story each nav link routes client-side.
 *   First in a build of the same site with React's development build, which names every
 *   difference between the server's HTML and the client's first render, served the documents as
 *   Pages serves them (each page from its own file, any other path from 404.html with status
 *   404); then dist/ itself, as it ships, in `wrangler pages dev` (from the PATH, or bunx).
 *
 *   TZ=UTC bun run build && bun run check:prerender [--shots <dir> [--base http://127.0.0.1:8791]]
 *
 * `--shots` also saves each page with JavaScript off, and with `--base` (the built site served by
 * `wrangler pages dev dist`), the story page on a 300 ms, 1.6 Mbps link at the moment its HTML,
 * stylesheets and fonts are in and its scripts, held back, are not.
 * Exits 1 on any failure.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { chromium, type Browser, type Page } from 'playwright-core';
import { NAV } from '../src/components/Layout';
import { NOT_FOUND_FILE, PAGE_PATHS, pageFile, type PagePath } from '../src/meta';
import { renderPage } from '../src/server';
import { inlineTokens } from '../src/story/draft';
import { story } from '../src/story/story';
import { writePages } from './page-heads';

const { values: args } = parseArgs({ options: { shots: { type: 'string' }, base: { type: 'string' } } });

(globalThis as Record<string, unknown>).__BUILD_DATE__ = '2026-10-26';

const problems: string[] = [];
const check = (ok: boolean, what: string) => {
  if (!ok) problems.push(what);
};

const ENTITIES: Readonly<Record<string, string>> = { '&amp;': '&', '&#x27;': "'", '&quot;': '"', '&lt;': '<', '&gt;': '>', '&rsquo;': '’' };
/** An element's text as a reader sees it. */
const text = (html: string) =>
  html
    .replace(/<!-- -->/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&[#\w]+;/g, (e) => ENTITIES[e] ?? e)
    .replace(/\s+/g, ' ')
    .trim();
const plain = (s: string) => inlineTokens(s).map((t) => t.text).join('');

/** The page's main heading, and the paragraph after it. */
function opening(html: string): { h1: string; p: string } | null {
  const main = html.slice(html.indexOf('<main'));
  const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(main);
  if (!h1) return null;
  const p = /<p[^>]*>([\s\S]*?)<\/p>/.exec(main.slice(h1.index + h1[0].length));
  return { h1: text(h1[1]!), p: text(p?.[1] ?? '') };
}

const rootOf = (html: string) => html.slice(html.indexOf('<div id="root"'), html.lastIndexOf('</body>'));

// 1. What each built file says, against the page rendered here from the source data.
const consoleError = console.error;
console.error = (...a: unknown[]) => (typeof a[0] === 'string' && a[0].includes('useLayoutEffect') ? undefined : consoleError(...a));
for (const p of PAGE_PATHS) {
  const built = readFileSync(join('dist', pageFile(p)), 'utf8');
  const root = rootOf(built);
  const want = opening(await renderPage(p));
  const got = opening(root);
  check(root.startsWith(`<div id="root" data-prerendered="${p}">`), `${p}: the root is not marked as the page's own`);
  check(!!want && !!got && got.h1 === want.h1 && got.p === want.p && got.p.length > 0, `${p}: built h1 and first paragraph ${JSON.stringify(got)}, rendered ${JSON.stringify(want)}`);
  check(root.includes('<header') && root.includes('<footer'), `${p}: no masthead or footer in the built HTML`);
  console.log(`${p}: ${pageFile(p)} opens on “${got?.h1}”, then “${got?.p.slice(0, 70)}…”`);
}
console.error = consoleError;

const home = text(rootOf(readFileSync('dist/index.html', 'utf8')));
const firstProse = story.sections[0]!.blocks.find((b) => b.kind === 'p');
check(opening(rootOf(readFileSync('dist/index.html', 'utf8')))?.h1 === plain(story.title), '/: the built title is not the story’s');
check(!!firstProse && home.includes(plain(firstProse.text)), '/: the built HTML lacks the first section’s opening paragraph');
check(home.includes(plain(story.byline)), '/: the built HTML lacks the byline');

const notFound = readFileSync(join('dist', NOT_FOUND_FILE), 'utf8');
check(rootOf(notFound).startsWith('<div id="root" data-prerendered="*">') && opening(rootOf(notFound))?.h1 === 'Nothing here', `${NOT_FOUND_FILE}: not the Nothing here page`);

/** A tab served from `dir` as Pages serves a deploy, at a made-up origin no analytics host matches. */
const ORIGIN = 'http://rune.test';
async function servedFrom(page: Page, dir: string): Promise<void> {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const path = new URL(route.request().url()).pathname;
    const isPage = (PAGE_PATHS as readonly string[]).includes(path);
    const file = isPage ? pageFile(path as PagePath) : path.slice(1);
    if (isPage || (file && existsSync(join(dir, file)))) return route.fulfill({ path: join(dir, file) });
    if (route.request().resourceType() === 'document') return route.fulfill({ status: 404, path: join(dir, NOT_FOUND_FILE) });
    return route.fulfill({ status: 404, body: 'Not found\n' });
  });
}

const shots = args.shots ? resolve(args.shots) : null;
if (shots) mkdirSync(shots, { recursive: true });
const PATHS = [...PAGE_PATHS, '/nothing-here'] as const;
const nameOf = (p: string) => (p === '/' ? 'story' : p.slice(1));

/** 2. Every page readable with JavaScript off. */
async function withoutScript(browser: Browser): Promise<void> {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await servedFrom(page, 'dist');
  for (const p of PATHS) {
    const res = await page.goto(ORIGIN + p);
    const h1 = page.locator('main h1').first();
    const visible = await h1.isVisible();
    check(visible && (await h1.innerText()).length > 0, `${p}, JavaScript off: no visible heading`);
    check(res?.status() === (p === '/nothing-here' ? 404 : 200), `${p}: status ${res?.status()}`);
    if (shots) await page.screenshot({ path: join(shots, `no-js-${nameOf(p)}.png`) });
  }
  console.log(`JavaScript off: ${PATHS.join(' ')} each show their heading`);
  await context.close();
}

/** The story page from `base` on the slow link, its HTML in and its scripts held back. */
async function beforeScript(browser: Browser, base: string): Promise<void> {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 300, downloadThroughput: 200_000, uploadThroughput: 93_750 });
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  await page.route(/\/assets\/.*\.js$/, async (route) => {
    await held;
    await route.fallback();
  });
  await page.goto(`${base}/`, { waitUntil: 'commit' });
  await page.locator('main h1').first().waitFor();
  await page.waitForFunction(() => performance.getEntriesByName('first-contentful-paint').length > 0);
  await page.evaluate(() => document.fonts.ready);
  const at = await page.evaluate(() => performance.getEntriesByName('first-contentful-paint')[0]!.startTime);
  const hydrated = await page.evaluate(() => Object.keys(document.getElementById('root')!).some((k) => k.startsWith('__reactContainer')));
  check(!hydrated, 'the story before its scripts: the app ran');
  await page.screenshot({ path: join(shots!, 'story-before-js.png') });
  console.log(`The story page before its scripts, first painted at ${(at / 1000).toFixed(2)} s on 300 ms RTT, 1.6 Mbps`);
  release();
  await context.close();
}

/** A desktop and a phone: either side of every layout switch the pages make by width. */
const WIDTHS = [1440, 390] as const;
/**
 * The reader's zone, never the build's: package.json `check` builds under TZ=UTC, as Cloudflare
 * Pages does, and every time the site shows is Pacific whatever zone either side is in.
 */
const READER_ZONE = 'Australia/Perth';

/** The site built as `bun run build` builds it, with React's development build; returns its dist. */
async function developmentBuild(): Promise<string> {
  const out = resolve('node_modules/.cache/rune-prerender');
  const [client, server] = [join(out, 'client'), join(out, 'server')];
  const before = { NODE_ENV: process.env.NODE_ENV, VITE_WORLD_ASSET_BASE: process.env.VITE_WORLD_ASSET_BASE, TZ: process.env.TZ };
  process.env.NODE_ENV = 'development';
  // In UTC, as package.json `check` builds dist/ and as Pages builds the site.
  process.env.TZ = 'UTC';
  // scripts/test-preload.ts sets the dev asset base for the renders above; the build takes .env.production's.
  delete process.env.VITE_WORLD_ASSET_BASE;
  try {
    const { createBuilder } = await import('vite');
    // The production mode, and with it .env.production's asset host, with React's development build.
    const builder = await createBuilder({
      mode: 'production',
      logLevel: 'error',
      build: { outDir: client },
      environments: { ssr: { build: { outDir: server } } },
    });
    await builder.buildApp();
  } finally {
    Object.assign(process.env, before);
  }
  await writePages(client, server);
  const entry = readFileSync(join(client, 'index.html'), 'utf8').match(/src="(\/assets\/[^"]+\.js)"/)![1]!;
  check(readFileSync(join(client, entry), 'utf8').includes('did not match. Server:'), 'the hydration build is not React’s development build');
  return client;
}

/**
 * dist/ in Pages' own server, functions/ and _routes.json included, at a free port. Wrangler is a
 * tool on the machine, not a dependency (Pages installs every devDependency on each deploy): the
 * one on the PATH, or else bunx fetches it. Its logs go to a scratch directory: wrangler's default
 * is under the user's preferences, not always writable.
 */
async function pagesDev(dir: string): Promise<{ base: string; stop(): void }> {
  const probe = Bun.serve({ port: 0, hostname: '127.0.0.1', fetch: () => new Response() });
  const port = probe.port;
  probe.stop(true);
  const wrangler = Bun.which('wrangler') ? ['wrangler'] : ['bunx', 'wrangler@4'];
  const proc = Bun.spawn([...wrangler, 'pages', 'dev', dir, '--ip', '127.0.0.1', '--port', String(port)], {
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false', WRANGLER_LOG_PATH: mkdtempSync(join(tmpdir(), 'rune-wrangler-')) },
    stdout: 'ignore',
    stderr: 'pipe',
  });
  const base = `http://127.0.0.1:${port}`;
  for (const until = Date.now() + 180_000; Date.now() < until; await Bun.sleep(250)) {
    if (proc.exitCode !== null) throw new Error(`wrangler pages dev exited ${proc.exitCode}: ${await new Response(proc.stderr).text()}`);
    if ((await fetch(`${base}/`).catch(() => null))?.ok) return { base, stop: () => proc.kill() };
  }
  proc.kill();
  throw new Error('wrangler pages dev did not answer within three minutes');
}

/**
 * 3. The app hydrates every page in place, opened at each width in the reader's zone: the console
 * logs no error or warning, the app keeps the server's DOM rather than drawing its own, and from
 * the story each nav link routes client-side. `serve`, if given, answers the tab's requests.
 */
async function hydrates(browser: Browser, what: string, base: string, serve?: (page: Page) => Promise<void>): Promise<void> {
  for (const width of WIDTHS) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, timezoneId: READER_ZONE });
    for (const p of PATHS) {
      const where = `${p} at ${width} px, ${what}`;
      const page = await context.newPage();
      const said: string[] = [];
      // A failed request is reported by its address below; the console's own line for it names none.
      page.on('console', (m) => {
        if ((m.type() === 'error' || m.type() === 'warning') && !m.text().startsWith('Failed to load resource')) said.push(`${m.type()}: ${m.text().slice(0, 300)}`);
      });
      page.on('pageerror', (e) => said.push(`pageerror: ${e.message}`));
      page.on('response', (r) => {
        const unknownPage = r.request().resourceType() === 'document' && p === '/nothing-here';
        if (r.status() >= 400 && !unknownPage) said.push(`${r.status()}: ${r.url()}`);
      });
      // The server's nodes, held before any script runs, to compare with what the app ends on.
      await page.addInitScript(() => {
        document.addEventListener('readystatechange', () => {
          if (document.readyState !== 'interactive') return;
          const w = window as unknown as Record<string, unknown>;
          w.__served = [document.querySelector('#root > *'), document.querySelector('main h1'), document.querySelector('footer')];
        });
      });
      if (serve) await serve(page);
      await page.goto(base + p, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => Object.keys(document.getElementById('root')!).some((k) => k.startsWith('__reactContainer')));
      await page.waitForTimeout(500);
      const kept = await page.evaluate(() => {
        const served = (window as unknown as Record<string, Element[]>).__served!;
        const now = [document.querySelector('#root > *'), document.querySelector('main h1'), document.querySelector('footer')];
        return served.every((el, i) => el !== null && el === now[i]);
      });
      check(said.length === 0, `${where}: the console said\n    ${said.join('\n    ')}`);
      check(kept, `${where}: the app replaced the server's HTML instead of hydrating it`);

      if (p === '/') {
        await page.evaluate(() => ((window as unknown as Record<string, unknown>).__sameTab = true));
        for (const n of NAV.slice(1)) {
          await page.locator(`nav[aria-label="Pages"] a[href="${n.to}"]`).click();
          await page.waitForURL(base + n.to);
          await page.locator('main h1').first().waitFor();
        }
        const same = await page.evaluate(() => (window as unknown as Record<string, unknown>).__sameTab === true);
        check(same, `${where}: a nav link reloaded the page instead of routing client-side`);
        check(said.length === 0, `${where} → the nav: the console said\n    ${said.join('\n    ')}`);
      }
      await page.close();
    }
    await context.close();
  }
  console.log(
    `Hydration, ${what}, at ${WIDTHS.join(' and ')} px in ${READER_ZONE}: ${PATHS.join(' ')} keep the server’s HTML and log nothing; the nav routes client-side`,
  );
}

const browser = await chromium.launch({ channel: 'chrome' });
try {
  await withoutScript(browser);
  if (shots && args.base) await beforeScript(browser, args.base);
  const development = await developmentBuild();
  await hydrates(browser, 'React’s development build', ORIGIN, (page) => servedFrom(page, development));
  // The site as it ships: dist/ as the build left it, in the server Pages runs it on.
  const pages = await pagesDev('dist');
  try {
    await hydrates(browser, 'the production build in wrangler pages dev', pages.base);
  } finally {
    pages.stop();
  }
} finally {
  await browser.close();
}

for (const p of problems) console.log(`FAIL ${p}`);
console.log(problems.length ? `check-prerender: ${problems.length} problem(s)` : 'check-prerender: every page is in its HTML and hydrates in place');
process.exit(problems.length ? 1 : 0);
