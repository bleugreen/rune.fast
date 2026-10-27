import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Plugin } from 'vite';

/** Pages' `_routes.json`: which requests run the Function in functions/. */
export type PagesRoutes = { version: 1; include: string[]; exclude: string[] };

/** Pages' limits: include and exclude rules together, and characters per rule. */
const MAX_RULES = 100;
const MAX_RULE_LENGTH = 100;

/**
 * The routes for a build, given its files relative to the output directory. Every build-output
 * directory is included and each file in it excluded, so a file of this deploy is served
 * statically (free, and with public/_headers) and only a missing one reaches the Function. Past
 * Pages' rule limit, the files that do not fit go through the Function, which serves them
 * unchanged; assets/ is fetched on every page view, so its files are kept off it first.
 */
export function pagesRoutes(files: readonly string[]): PagesRoutes {
  const nested = files.filter((f) => f.includes('/'));
  const dirs = [...new Set(nested.map((f) => f.slice(0, f.indexOf('/'))))].sort();
  if (!dirs.length) throw new Error('pages-routes: the build has no output directories to route');
  const include = dirs.map((d) => `/${d}/*`);
  const rules = nested.map((f) => `/${f}`).filter((r) => r.length <= MAX_RULE_LENGTH).sort();
  const exclude = [...rules.filter((r) => r.startsWith('/assets/')), ...rules.filter((r) => !r.startsWith('/assets/'))];
  return { version: 1, include, exclude: exclude.slice(0, MAX_RULES - include.length) };
}

/** Every file under `dir`, relative to it with `/` separators, less a previous _routes.json. */
export function filesUnder(dir: string, prefix = ''): string[] {
  return readdirSync(dir).flatMap((name) => {
    const rel = prefix + name;
    if (statSync(join(dir, name)).isDirectory()) return filesUnder(join(dir, name), rel + '/');
    return rel === '_routes.json' ? [] : [rel];
  });
}

/** Writes `_routes.json` into the build output once Vite has written everything else. */
export function pagesRoutesFile(): Plugin {
  let outDir = '';
  return {
    name: 'rune:pages-routes',
    apply: 'build',
    applyToEnvironment: (environment) => environment.name === 'client',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const files = filesUnder(outDir);
      const routes = pagesRoutes(files);
      const unexcluded = files.filter((f) => f.includes('/')).length - routes.exclude.length;
      if (unexcluded > 0) {
        this.warn(`_routes.json: ${unexcluded} files exceed Pages' ${MAX_RULES} rules and will be served through the Function`);
      }
      writeFileSync(join(outDir, '_routes.json'), JSON.stringify(routes, null, 2) + '\n');
    },
  };
}
