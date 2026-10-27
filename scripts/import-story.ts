/**
 * Copies the operator's draft into data/story.md, and its per-section dig files
 * (digs/section-N.md beside the draft) into data/receipts/, byte for byte, after
 * checking that they parse and that every section's figure anchor, pulled quote
 * and link is still in its prose. Nothing is edited here or anywhere else
 * (RUNE tenet #1).
 *
 *   bun scripts/import-story.ts [path-to-draft]
 *
 * The default path is the draft on the operator's Mac.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseStory } from '../src/story/draft';
import { storySections } from '../src/story/sections';

const from = process.argv[2] ?? '/Users/mitch/rs-document/work/story-v1.md';
const bytes = readFileSync(from);
const digDir = join(dirname(from), 'digs');
const digs = existsSync(digDir)
  ? readdirSync(digDir).flatMap((f) => {
      const m = /^section-(\d+)\.md$/.exec(f);
      return m ? [[Number(m[1]), readFileSync(join(digDir, f))] as const] : [];
    })
  : [];

const story = parseStory(bytes.toString('utf8'), Object.fromEntries(digs.map(([n, b]) => [n, b.toString('utf8')])));
storySections(story);

const data = new URL('../data/', import.meta.url);
writeFileSync(new URL('story.md', data), bytes);
mkdirSync(new URL('receipts/', data), { recursive: true });
for (const [n, b] of digs) writeFileSync(new URL(`receipts/section-${n}.md`, data), b);
console.log(
  `data/story.md: ${bytes.length} bytes, ${story.sections.length} sections; data/receipts: ${digs.map(([n]) => `section-${n}.md`).join(', ') || 'none'}; from ${from}`,
);
