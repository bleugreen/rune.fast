/**
 * After a deploy, the live site as Cloudflare's edge serves it. On rune.fast and www.rune.fast:
 *
 * - Each page's HTML, and the HTML for an unknown path, is served with Cache-Control no-transform
 *   and refers to the Web Analytics beacon nowhere. The zone injects its own beacon into HTML it is
 *   allowed to transform (Cloudflare's free-plan RUM), and the app adds ours at runtime
 *   (src/lib/analytics.ts), so the served HTML must have none.
 * - Opened in Chrome, the home page holds exactly one beacon script once it has loaded, ours, and
 *   the beacon reports to the zone's own /cdn-cgi/rum and is answered 2xx. Each run therefore
 *   records one real page view per host.
 *
 *   bun run check:live
 *   bun run check:live --local 8797   # wrangler pages dev dist --port 8797; Chrome resolves rune.fast to it
 *
 * Locally there is no zone to answer /cdn-cgi/rum, so a report need only be sent.
 *
 * Exits 1 on any failure.
 */
import { parseArgs } from 'node:util';
import { chromium } from 'playwright-core';
import { ANALYTICS_HOSTS, BEACON_SRC, RUM_ENDPOINT } from '../src/lib/analytics';
import { PAGE_PATHS } from '../src/meta';

const { values: args } = parseArgs({ options: { local: { type: 'string' } } });

const BEACON_REFERENCE = /cloudflareinsights|data-cf-beacon/g;

/** Where each host's HTML is fetched from, and the address Chrome opens it at. */
const sites = args.local
  ? [{ fetchFrom: `http://127.0.0.1:${args.local}`, open: `http://rune.fast:${args.local}` }]
  : ANALYTICS_HOSTS.map((h) => ({ fetchFrom: `https://${h}`, open: `https://${h}` }));

const problems: string[] = [];
const check = (ok: boolean, what: string) => {
  if (!ok) problems.push(what);
};

for (const site of sites) {
  for (const p of [...PAGE_PATHS, '/nope']) {
    const url = site.fetchFrom + p;
    const res = await fetch(url, { headers: { Accept: 'text/html' } });
    const html = await res.text();
    const cache = res.headers.get('cache-control') ?? '';
    const refs = html.match(BEACON_REFERENCE)?.length ?? 0;
    check(res.headers.get('content-type')?.startsWith('text/html') ?? false, `${url}: ${res.status} ${res.headers.get('content-type')}`);
    check(/\bno-transform\b/.test(cache), `${url}: Cache-Control "${cache}" lacks no-transform`);
    check(refs === 0, `${url}: the served HTML refers to the beacon ${refs} times (the zone injected it)`);
    console.log(`${url}: ${res.status}, Cache-Control "${cache}", ${refs} beacon references`);
  }
}

const browser = await chromium.launch({
  channel: 'chrome',
  args: args.local ? ['--host-resolver-rules=MAP rune.fast 127.0.0.1'] : [],
});
try {
  for (const site of sites) {
    const context = await browser.newContext();
    const page = await context.newPage();
    const rum = site.open + RUM_ENDPOINT;
    const reports: Promise<string>[] = [];
    context.on('request', (r) => {
      if (!r.url().startsWith(rum)) return;
      reports.push(r.response().then((res) => `${r.method()} ${res?.status() ?? 'no response'}`, (e) => `${r.method()} failed: ${e}`));
    });
    await page.goto(site.open + '/', { waitUntil: 'load' });
    const added = await page
      .waitForFunction((src) => document.querySelector(`script[src^="${src}"]`) !== null, BEACON_SRC, { timeout: 15_000 })
      .then(() => true, () => false);
    const scripts = await page.evaluate(() => [...document.scripts].filter((s) => s.src.includes('cloudflareinsights')).map((s) => s.src));
    check(added && scripts.length === 1, `${site.open}/: ${scripts.length} beacon scripts after load (${scripts.join(', ')})`);
    // The beacon reports on load and again when the page is hidden; leaving the page sends the latter.
    await page.waitForTimeout(3000);
    await page.goto('about:blank');
    await page.waitForTimeout(2000);
    const answered = await Promise.all(reports);
    const accepted = args.local ? /^POST / : /^POST 2\d\d$/;
    check(answered.some((a) => accepted.test(a)), `${site.open}/: the beacon's reports to ${rum}: ${answered.join(', ') || 'none'}`);
    console.log(`${site.open}/: ${scripts.length} beacon script after load; reports to ${rum}: ${answered.join(', ') || 'none'}`);
    await context.close();
  }
} finally {
  await browser.close();
}

for (const p of problems) console.log(`FAIL ${p}`);
console.log(problems.length ? `check-live: ${problems.length} problem(s)` : 'check-live: the HTML is served untransformed, and the app adds the one beacon');
process.exit(problems.length ? 1 : 0);
