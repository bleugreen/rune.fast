/**
 * Draws the link-preview image and the favicon's PNGs in system Chrome, into public/:
 *
 *   share.png             the dev-only /share screen (src/dev/Share.tsx) at 1200 by 630, shot at
 *                         --scale and drawn down to size, so hairlines and type keep their weight
 *   favicon-32.png        favicon.svg at 32 px, its corners clear
 *   apple-touch-icon.png  favicon.svg at 180 px on paper to the edges (iOS rounds the corners)
 *
 *   bun run dev
 *   bun run render:share [--base http://localhost:5173] [--scale 2]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright-core';
import { SHARE_IMAGE } from '../src/meta';

const { values: args } = parseArgs({
  options: {
    base: { type: 'string', default: 'http://localhost:5173' },
    scale: { type: 'string', default: '2' },
  },
});

const pub = new URL('../public/', import.meta.url);
const PAPER = '#f7f3ea';

const browser = await chromium.launch({ channel: 'chrome' });
try {
  const scale = Number(args.scale);
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: scale });
  await page.goto(`${args.base}/share`);
  const card = page.locator('[data-share]');
  await card.waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => performance.getEntriesByName('rune:tree-draw').length > 0);
  const shot = await card.screenshot({ animations: 'disabled' });

  // Drawn down to its published size in the same browser, with its best resampling.
  const png = await page.evaluate(
    async ({ b64, width, height }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const cv = document.createElement('canvas');
      cv.width = width;
      cv.height = height;
      const ctx = cv.getContext('2d')!;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);
      return cv.toDataURL('image/png').split(',')[1]!;
    },
    { b64: shot.toString('base64'), width: SHARE_IMAGE.width, height: SHARE_IMAGE.height },
  );
  const share = Buffer.from(png, 'base64');
  writeFileSync(new URL(`.${SHARE_IMAGE.path}`, pub), share);
  console.log(`public${SHARE_IMAGE.path}: ${SHARE_IMAGE.width}x${SHARE_IMAGE.height}, ${Math.round(share.length / 1024)} KB`);

  const svg = readFileSync(new URL('favicon.svg', pub), 'utf8');
  for (const [file, size, paper] of [
    ['favicon-32.png', 32, false],
    ['apple-touch-icon.png', 180, true],
  ] as const) {
    const icon = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
    const background = paper ? PAPER : 'transparent';
    await icon.setContent(
      `<body style="margin:0;background:${background}"><img src="${src}" width="${size}" height="${size}" style="display:block"></body>`,
    );
    await icon.locator('img').evaluate((el: HTMLImageElement) => el.decode());
    const out = await icon.screenshot({ omitBackground: !paper });
    writeFileSync(new URL(file, pub), out);
    console.log(`public/${file}: ${size}x${size}, ${(out.length / 1024).toFixed(1)} KB`);
    await icon.close();
  }
} finally {
  await browser.close();
}
