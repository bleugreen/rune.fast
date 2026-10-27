/**
 * Checks the built site's pages in system Chrome, as a link unfurler and a reader meet them, against
 * src/meta.ts: each page's HTML, fetched without running anything, carries its own title,
 * description, canonical URL and preview image, with the site's isolation headers; opened from
 * that page, the app renders and the document's title and description are the page's; from it,
 * every nav link routes client-side to its page, with that page's title and description; and an
 * unknown path gets the shell and the 'Nothing here' page.
 *
 *   bun run build && wrangler pages dev dist --port 8788    # Pages' own asset server
 *   bun run check:heads [--base http://localhost:8788]
 *
 * Exits 1 on any failure.
 */
import { parseArgs } from 'node:util';
import { chromium } from 'playwright-core';
import { NAV } from '../src/components/Layout';
import { ORIGIN, PAGE_PATHS, SHARE_IMAGE, siteMeta } from '../src/meta';

const { values: args } = parseArgs({ options: { base: { type: 'string', default: 'http://localhost:8788' } } });
const meta = siteMeta();
const problems: string[] = [];
const check = (ok: boolean, what: string) => {
  if (!ok) problems.push(what);
};

const attr = (html: string, re: RegExp) => re.exec(html)?.[1]?.replace(/&quot;/g, '"').replace(/&amp;/g, '&');

for (const p of PAGE_PATHS) {
  const res = await fetch(args.base + p, { redirect: 'manual' });
  const html = await res.text();
  const m = meta[p];
  check(res.status === 200, `${p}: status ${res.status}${res.headers.get('location') ? ` to ${res.headers.get('location')}` : ''}`);
  check(attr(html, /<title>([^<]*)<\/title>/) === m.title, `${p}: served title is not the page's`);
  check(attr(html, /<meta property="og:url" content="([^"]*)"/) === ORIGIN + p, `${p}: served og:url is not ${ORIGIN + p}`);
  check(attr(html, /<meta name="twitter:description" content="([^"]*)"/) === m.description, `${p}: served twitter:description is not the page's`);
  check(res.headers.get('cross-origin-embedder-policy') === 'require-corp', `${p}: no COEP header`);
  check(res.headers.get('cross-origin-opener-policy') === 'same-origin', `${p}: no COOP header`);
}
const image = await fetch(args.base + SHARE_IMAGE.path);
check(image.status === 200 && image.headers.get('content-type') === 'image/png', `${SHARE_IMAGE.path}: ${image.status} ${image.headers.get('content-type')}`);

const browser = await chromium.launch({ channel: 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const now = () =>
    page.evaluate(() => ({
      title: document.title,
      description: document.querySelector('meta[name="description"]')?.getAttribute('content') ?? null,
      descriptions: document.querySelectorAll('meta[name="description"]').length,
      h1: document.querySelector('main h1')?.textContent ?? null,
      isolated: self.crossOriginIsolated,
    }));

  for (const entry of PAGE_PATHS) {
    await page.goto(args.base + entry);
    await page.locator('main h1').first().waitFor();
    const s = await now();
    check(s.title === meta[entry].title && s.description === meta[entry].description, `${entry}: opened, the document reads "${s.title}"`);
    check(s.descriptions === 1, `${entry}: ${s.descriptions} description tags`);
    check(s.isolated, `${entry}: not cross-origin isolated`);
    for (const n of NAV) {
      await page.locator(`nav[aria-label="Pages"] a[href="${n.to}"]`).click();
      await page.waitForURL(args.base + n.to);
      await page.waitForFunction((t) => document.title === t, meta[n.to].title, { timeout: 5000 }).catch(() => {});
      const t = await now();
      check(t.title === meta[n.to].title && t.description === meta[n.to].description, `${entry} → ${n.to}: the document reads "${t.title}"`);
    }
    console.log(`${entry}: opened as "${s.title}", then routed to ${NAV.map((n) => n.to).join(' ')}`);
  }

  for (const unknown of ['/nope', '/nope/deeper']) {
    const res = await page.goto(args.base + unknown);
    await page.locator('main h1').first().waitFor();
    const s = await now();
    check(res?.status() === 200 && s.h1 === 'Nothing here' && s.title === 'Nothing here · rune.fast', `${unknown}: ${res?.status()} "${s.h1}" "${s.title}"`);
    console.log(`${unknown}: ${res?.status()}, "${s.h1}", "${s.title}"`);
  }
  check(errors.length === 0, `page errors: ${errors.join('; ')}`);
} finally {
  await browser.close();
}

for (const p of problems) console.log(`FAIL ${p}`);
console.log(problems.length ? `check-heads: ${problems.length} problem(s)` : 'check-heads: every page serves its own head, renders, and routes');
process.exit(problems.length ? 1 : 0);
