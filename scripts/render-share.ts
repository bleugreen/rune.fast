/**
 * Draws the link-preview image and the favicon's PNGs in system Chrome, into public/:
 *
 *   share.png             the dev-only /share screen (src/dev/Share.tsx) at 1200 by 630, shot at
 *                         --scale and drawn down to size, so hairlines and type keep their weight,
 *                         then encoded here, losslessly, to stay well inside unfurlers' size limits
 *   favicon-32.png        favicon.svg at 32 px, its corners clear
 *   apple-touch-icon.png  favicon.svg at 180 px on paper to the edges (iOS rounds the corners)
 *
 *   bun run dev
 *   bun run render:share [--base http://localhost:5173] [--scale 2]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { deflateSync } from 'node:zlib';
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

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Uint8Array): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'latin1');
  out.set(data, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const [pa, pb, pc] = [Math.abs(p - a), Math.abs(p - b), Math.abs(p - c)];
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/**
 * An opaque RGBA image as an RGB PNG, each row under whichever of the five filters leaves it the
 * smallest sum, deflated at level 9. Lossless; about three quarters the size of Chrome's encoding.
 */
function encodePng(width: number, height: number, rgba: Uint8Array): Buffer {
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  let prev = new Uint8Array(stride);
  const filtered = Array.from({ length: 5 }, () => new Uint8Array(stride));
  for (let y = 0; y < height; y++) {
    const row = new Uint8Array(stride);
    for (let x = 0; x < width; x++) row.set(rgba.subarray((y * width + x) * 4, (y * width + x) * 4 + 3), x * 3);
    let best = 0;
    let bestCost = Infinity;
    for (let f = 0; f < 5; f++) {
      const out = filtered[f]!;
      let cost = 0;
      for (let i = 0; i < stride; i++) {
        const a = i >= 3 ? row[i - 3]! : 0;
        const b = prev[i]!;
        const c = i >= 3 ? prev[i - 3]! : 0;
        const pred = f === 0 ? 0 : f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : paeth(a, b, c);
        const v = (row[i]! - pred) & 0xff;
        out[i] = v;
        cost += v < 128 ? v : 256 - v;
      }
      if (cost < bestCost) [best, bestCost] = [f, cost];
    }
    raw[y * (stride + 1)] = best;
    raw.set(filtered[best]!, y * (stride + 1) + 1);
    prev = row;
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bits per channel
  ihdr[9] = 2; // RGB
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9, memLevel: 9 })),
    pngChunk('IEND', new Uint8Array(0)),
  ]);
}

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
  const rgba = await page.evaluate(
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
      const px = ctx.getImageData(0, 0, width, height).data;
      let s = '';
      for (let i = 0; i < px.length; i += 0x8000) s += String.fromCharCode(...px.subarray(i, i + 0x8000));
      return btoa(s);
    },
    { b64: shot.toString('base64'), width: SHARE_IMAGE.width, height: SHARE_IMAGE.height },
  );
  const share = encodePng(SHARE_IMAGE.width, SHARE_IMAGE.height, Buffer.from(rgba, 'base64'));
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
