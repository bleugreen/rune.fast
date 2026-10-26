/**
 * Copies the narrator's draft into data/story.md byte for byte, after checking that
 * it parses and that every section's figure anchor, pulled quote and link is still
 * in its prose. The draft is never edited here or anywhere else (RUNE tenet #1).
 *
 *   bun scripts/import-story.ts [path-to-draft]
 *
 * The default path is the draft on the operator's Mac.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { parseStory } from '../src/story/draft';
import { storySections } from '../src/story/sections';

const from = process.argv[2] ?? '/Users/mitch/rs-document/work/story-v1.md';
const bytes = readFileSync(from);
const story = parseStory(bytes.toString('utf8'));
storySections(story);
writeFileSync(new URL('../data/story.md', import.meta.url), bytes);
console.log(`data/story.md: ${bytes.length} bytes, ${story.sections.length} sections, from ${from}`);
