/**
 * The build's last step (package.json `build`, after `vite build`): writes each page's HTML into
 * dist/, the built shell with that page's head (src/meta.ts), so a link to /route unfurls as the
 * Route page. dist/index.html becomes the story's and stays the shell Pages serves for any other
 * path. Run under scripts/test-preload.ts, which loads data/story.md as the site build does.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PAGE_PATHS, pageFile, siteMeta, withHead } from '../src/meta';

const dist = process.argv[2] ?? 'dist';
const shell = readFileSync(join(dist, 'index.html'), 'utf8');
const meta = siteMeta();
for (const p of PAGE_PATHS) writeFileSync(join(dist, pageFile(p)), withHead(shell, meta[p]));
console.log(`page-heads: ${PAGE_PATHS.map((p) => `${dist}/${pageFile(p)}`).join(', ')}`);
