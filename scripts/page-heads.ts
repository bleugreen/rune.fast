/**
 * The build's last step (package.json `build`, after `vite build`): writes each page's HTML into
 * dist/, the built shell with that page's head (src/meta.ts), so a link to /route unfurls as the
 * Route page, and the page itself rendered into the app's root by the build's server entry
 * (src/server.tsx, in dist-server/), so a reader sees its text before any script has run.
 * dist/index.html becomes the story's; dist/404.html, the shell with Nothing here in it, is what
 * Pages serves, with status 404, for any path that is neither a file nor a page.
 *
 *   bun scripts/page-heads.ts [dist] [dist-server]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type * as Server from '../src/server';

/** A path that is no page, to render the catch-all at. */
const UNKNOWN = '/nothing-here';

/** Writes every page's HTML into `dist`; returns the files written. */
export async function writePages(dist = 'dist', server = 'dist-server'): Promise<string[]> {
  const s = (await import(pathToFileURL(resolve(server, 'server.js')).href)) as typeof Server;
  const shell = readFileSync(join(dist, 'index.html'), 'utf8');
  const meta = s.siteMeta();
  const written: string[] = [];
  for (const p of s.PAGE_PATHS) {
    const file = join(dist, s.pageFile(p));
    writeFileSync(file, s.withBody(s.withHead(shell, meta[p]), p, await s.renderPage(p)));
    written.push(file);
  }
  const notFound = join(dist, s.NOT_FOUND_FILE);
  writeFileSync(notFound, s.withBody(s.withNotFoundHead(shell), s.NOT_FOUND, await s.renderPage(UNKNOWN)));
  return [...written, notFound];
}

if (import.meta.main) {
  const written = await writePages(process.argv[2], process.argv[3]);
  console.log(`page-heads: ${written.join(', ')}`);
}
