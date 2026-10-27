import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { findForbidden } from '../../scripts/forbidden';
import { avifSize, contentTag, jpegSize, webpSize } from '../../scripts/world/media';
import { SCREEN_FIGURE } from '../harness/figures/OperatorScreen';
import { FIGURES, rendition, type Rendition } from './registry';

/** What a page may ask a reader to load for one figure: the column image, and the full size on demand. */
const MAX_COLUMN_BYTES = 600_000;
const MAX_FULL_BYTES = 1_500_000;
const EXT: Record<Rendition['type'], string> = { 'image/avif': 'avif', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
const sizeOf = (r: Rendition, buf: Buffer) =>
  r.type === 'image/avif' ? avifSize(buf) : r.type === 'image/webp' ? webpSize(buf) : jpegSize(buf);

describe.each(FIGURES.map((f) => [f.id, f] as const))('%s', (_, f) => {
  test('names its source by content, and masks only inside it', () => {
    expect(f.source.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(f.masks.length).toBeGreaterThan(0);
    for (const m of f.masks) {
      expect(m.x).toBeGreaterThanOrEqual(0);
      expect(m.y).toBeGreaterThanOrEqual(0);
      expect(m.x + m.width).toBeLessThanOrEqual(f.source.width);
      expect(m.y + m.height).toBeLessThanOrEqual(f.source.height);
      expect(m.what.trim().length).toBeGreaterThan(0);
    }
  });

  test('has a column image as AVIF and JPEG, and a full size with every source pixel', () => {
    const [avif, jpeg, full] = [rendition(f, 'column', 'image/avif'), rendition(f, 'column', 'image/jpeg'), rendition(f, 'full')];
    expect([avif.width, avif.height]).toEqual([jpeg.width, jpeg.height]);
    expect(Math.abs(avif.height - (avif.width * f.source.height) / f.source.width)).toBeLessThanOrEqual(1);
    expect([full.width, full.height]).toEqual([f.source.width, f.source.height]);
    expect(f.renditions).toHaveLength(3);
  });

  test('names each rendition in the world assets by its content, and keeps it light', () => {
    for (const r of f.renditions) {
      expect(r.src).toMatch(new RegExp(`^figures/${f.id}\\.${r.width}\\.[0-9a-f]{8}\\.${EXT[r.type]}$`));
      expect(r.bytes).toBeLessThan(r.use === 'full' ? MAX_FULL_BYTES : MAX_COLUMN_BYTES);
    }
  });

  test('describes itself in plain words: alt text, and no identifier the site keeps off its pages', () => {
    expect(f.alt.trim().length).toBeGreaterThan(80);
    expect(findForbidden(JSON.stringify(f))).toBeUndefined();
  });

  // The files are in R2, not git; where the local mirror holds one (publish-figures --build or --pull), it must be the one named.
  describe.each(f.renditions.map((r) => [r.src, r] as const))('%s', (src, r) => {
    const mirrored = join('.world', src);
    test.if(existsSync(mirrored))('matches its file in .world/: content, size and dimensions', () => {
      const buf = readFileSync(mirrored);
      expect(src).toContain(`.${contentTag(buf)}.`);
      expect(buf.length).toBe(r.bytes);
      expect(sizeOf(r, buf)).toEqual({ width: r.width, height: r.height });
    });
  });
});

test('every registered figure is placed on a page', () => {
  expect(FIGURES.map((f) => f.id)).toEqual([SCREEN_FIGURE]);
});
