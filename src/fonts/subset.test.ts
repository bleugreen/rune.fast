import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { features } from './subset.json';

/** The OpenType features each CSS font-variant keyword turns on. */
const KEYWORD_FEATURES: Record<string, string[]> = {
  'lining-nums': ['lnum'],
  'oldstyle-nums': ['onum'],
  'tabular-nums': ['tnum'],
  'proportional-nums': ['pnum'],
  'diagonal-fractions': ['frac'],
  'stacked-fractions': ['afrc'],
  ordinal: ['ordn'],
  'slashed-zero': ['zero'],
  'small-caps': ['smcp'],
  'all-small-caps': ['smcp', 'c2sc'],
  'petite-caps': ['pcap'],
  'all-petite-caps': ['pcap', 'c2pc'],
  unicase: ['unic'],
  'titling-caps': ['titl'],
  super: ['sups'],
  sub: ['subs'],
};

function* cssFiles(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    // The dev-only screens are not served; /tokens shows small caps synthesized.
    if (p === join('src', 'dev')) continue;
    if (statSync(p).isDirectory()) yield* cssFiles(p);
    else if (/\.(css|tsx)$/.test(name)) yield p;
  }
}

describe('Rune Serif as served (scripts/fonts/subset.py)', () => {
  test('keeps every layout feature the site’s CSS turns on', () => {
    const needed = new Map<string, string>();
    for (const f of cssFiles('src')) {
      const text = readFileSync(f, 'utf8');
      for (const [, prop, value] of text.matchAll(/font-(variant(?:-[a-z]+)?|feature-settings)\s*:\s*([^;}]+)/g)) {
        if (prop === 'feature-settings') {
          for (const [, tag] of value!.matchAll(/['"]([a-z0-9]{4})['"]/g)) needed.set(tag!, f);
          continue;
        }
        for (const word of value!.trim().split(/\s+/)) for (const tag of KEYWORD_FEATURES[word] ?? []) needed.set(tag, f);
      }
    }
    const missing = [...needed].filter(([tag]) => !features.includes(tag)).map(([tag, f]) => `${tag} (${f})`);
    expect(missing).toEqual([]);
  });

  test('is lighter than the full subset it is cut from', () => {
    for (const face of ['RuneSerif-Roman.var.woff2', 'RuneSerif-Italic.var.woff2']) {
      expect(statSync(join('src/fonts', face)).size).toBeLessThan(statSync(join('src/fonts/full', face)).size);
    }
  });

  test('every face in base.css swaps in when it arrives', () => {
    const faces = readFileSync('src/styles/base.css', 'utf8').match(/@font-face\s*{[^}]*}/g) ?? [];
    expect(faces.length).toBeGreaterThan(0);
    for (const face of faces) expect(face).toContain('font-display: swap;');
    expect(readFileSync('src/lib/fonts.ts', 'utf8')).toContain("display: 'swap'");
  });
});
