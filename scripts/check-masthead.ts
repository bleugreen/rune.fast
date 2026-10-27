/**
 * Checks the masthead in system Chrome at phone widths and on the desktop: the nav sits on one
 * line (its links share one top and the nav is no taller than one link), it fits inside the
 * masthead with the page not scrolling sideways, and every link answers a tap 21 px above and
 * below its centre (a target at least 44 px tall). Prints each width's spare room and writes the
 * masthead at each width as a PNG.
 *
 *   bun run preview   # or bun run dev, with --base http://localhost:5173
 *   bun scripts/check-masthead.ts [--base http://localhost:4173] [--page /] [--out .world/masthead]
 *
 * Exits 1 if any width fails.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright-core';

const { values: args } = parseArgs({
  options: {
    base: { type: 'string', default: 'http://localhost:4173' },
    page: { type: 'string', default: '/' },
    out: { type: 'string', default: '.world/masthead' },
    widths: { type: 'string', default: '320,360,375,390,430,1440' },
  },
});

/** Half the shortest tap target allowed, less a pixel for rounding. */
const REACH = 21;

interface Measure {
  navHeight: number;
  linkHeight: number;
  tops: number[];
  spare: number;
  pageOverflow: number;
  untappable: string[];
  navBelowWordmark: boolean;
}

mkdirSync(args.out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
let failed = 0;
try {
  for (const width of args.widths.split(',').map(Number)) {
    const phone = width < 768;
    const page = await browser.newPage({ viewport: { width, height: phone ? 760 : 900 }, deviceScaleFactor: phone ? 3 : 2, isMobile: phone, hasTouch: phone });
    await page.goto(args.base + args.page);
    await page.locator('nav[aria-label="Pages"] a').first().waitFor();
    await page.evaluate(() => document.fonts.ready);
    const m: Measure = await page.evaluate((reach) => {
      const nav = document.querySelector<HTMLElement>('nav[aria-label="Pages"]')!;
      const links = [...nav.querySelectorAll<HTMLAnchorElement>('a')];
      const inner = nav.parentElement!.getBoundingClientRect();
      const wordmark = nav.parentElement!.querySelector('a')!.getBoundingClientRect();
      const n = nav.getBoundingClientRect();
      const boxes = links.map((a) => a.getBoundingClientRect());
      const untappable = links
        .filter((a, i) => {
          const b = boxes[i]!;
          const cx = b.left + b.width / 2;
          const cy = b.top + b.height / 2;
          return ![-reach, 0, reach].every((dy) => {
            const hit = document.elementFromPoint(cx, cy + dy);
            return hit !== null && (hit === a || a.contains(hit));
          });
        })
        .map((a) => a.textContent ?? '');
      return {
        navHeight: n.height,
        linkHeight: Math.max(...boxes.map((b) => b.height)),
        tops: boxes.map((b) => Math.round(b.top)),
        spare: inner.right - boxes.at(-1)!.right,
        pageOverflow: document.documentElement.scrollWidth - window.innerWidth,
        untappable,
        navBelowWordmark: n.top >= wordmark.bottom,
      };
    }, REACH);

    const problems: string[] = [];
    if (new Set(m.tops).size !== 1) problems.push(`links on ${new Set(m.tops).size} lines`);
    if (m.navHeight > m.linkHeight + 0.5) problems.push(`nav ${m.navHeight.toFixed(1)} px tall, one link ${m.linkHeight.toFixed(1)} px`);
    if (m.spare < 0) problems.push(`nav overruns the masthead by ${(-m.spare).toFixed(1)} px`);
    if (m.pageOverflow > 0) problems.push(`page scrolls sideways by ${m.pageOverflow} px`);
    if (m.untappable.length) problems.push(`not tappable ${REACH} px above and below centre: ${m.untappable.join(', ')}`);

    const file = join(args.out, `masthead-${width}.png`);
    await page.locator('header').first().screenshot({ path: file });
    const where = m.navBelowWordmark ? 'below the wordmark' : 'beside the wordmark';
    console.log(`${width} px: ${problems.length ? 'FAIL' : 'ok'}, one line ${where}, ${m.spare.toFixed(1)} px spare → ${file}`);
    for (const p of problems) console.log(`  ${p}`);
    if (problems.length) failed++;
    await page.close();
  }
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
