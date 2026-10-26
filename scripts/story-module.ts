import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseStory } from '../src/story/draft';

/**
 * data/story.md as a JS module holding only the parsed page copy and each
 * section's sources (its receipts, and the source table of data/receipts/section-N.md
 * where one exists). Shared by the Vite plugin (vite.config.ts) and the test
 * preload (scripts/test-preload.ts).
 */
export const isStoryMd = (id: string) => id.split('?')[0]!.endsWith('/data/story.md');

export const receiptPath = (storyPath: string, n: number) => join(dirname(storyPath), 'receipts', `section-${n}.md`);

export function storyModule(md: string, storyPath: string): { code: string; files: string[] } {
  const digs: Record<number, string> = {};
  const files: string[] = [];
  for (let n = 1; n <= 9; n++) {
    const p = receiptPath(storyPath, n);
    if (!existsSync(p)) continue;
    digs[n] = readFileSync(p, 'utf8');
    files.push(p);
  }
  return { code: `export default ${JSON.stringify(parseStory(md, digs))};\n`, files };
}
