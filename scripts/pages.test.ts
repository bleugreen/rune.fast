import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { ISOLATION_HEADERS, onRequest, withNoTransform } from '../functions/[[path]]';
import { PAGE_PATHS } from '../src/meta';
import { pagesRoutes } from './pages-routes';

const SHELL = '<!doctype html><html><body><div id="root"></div></body></html>';

/** What Pages sends on a static file when _headers says nothing. */
const PAGES_DEFAULT = 'public, max-age=0, must-revalidate';
const HTML = `${PAGES_DEFAULT}, no-transform`;
const IMMUTABLE = 'public, max-age=31536000, immutable';

type HeaderRule = { path: string; set: [string, string][]; unset: string[] };

/** public/_headers' rules, in order, header names lower-cased. */
function headerRules(): HeaderRule[] {
  const rules: HeaderRule[] = [];
  for (const raw of readFileSync(new URL('../public/_headers', import.meta.url), 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('/')) rules.push({ path: line, set: [], unset: [] });
    else if (line.startsWith('! ')) rules.at(-1)!.unset.push(line.slice(2).trim().toLowerCase());
    else {
      const i = line.indexOf(':');
      rules.at(-1)!.set.push([line.slice(0, i).trim().toLowerCase(), line.slice(i + 1).trim()]);
    }
  }
  return rules;
}

/**
 * The headers public/_headers gives a static response for `path`, as Pages' asset server applies
 * them: every matching rule in file order, each one's detaches before its sets, and a header set
 * again appended with a comma. Starts from Pages' default Cache-Control.
 */
function servedHeaders(path: string): Record<string, string> {
  const out = new Map<string, string>([['cache-control', PAGES_DEFAULT]]);
  const set = new Set<string>();
  for (const rule of headerRules()) {
    const re = new RegExp(`^${rule.path.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`);
    if (!re.test(path)) continue;
    for (const name of rule.unset) out.delete(name);
    for (const [name, value] of rule.set) {
      out.set(name, set.has(name) && out.has(name) ? `${out.get(name)}, ${value}` : value);
      set.add(name);
    }
  }
  return Object.fromEntries(out);
}

const lower = (h: Record<string, string>) => Object.fromEntries(Object.entries(h).map(([k, v]) => [k.toLowerCase(), v]));

/** A path for each top-level entry of public/, and for the directories the build adds. */
const publicPaths = (): string[] => [
  ...readdirSync(new URL('../public', import.meta.url))
    .filter((name) => name !== '_headers')
    .map((name) => (statSync(new URL(`../public/${name}`, import.meta.url)).isDirectory() ? `/${name}/x` : `/${name}`)),
  '/licenses/LICENSE.txt',
];

describe('public/_headers', () => {
  test('names no path twice: Pages keeps only the later block', () => {
    const paths = headerRules().map((r) => r.path);
    expect(paths).toEqual([...new Set(paths)]);
  });

  test('every page, and the shell for any other path, is isolated and served no-transform', () => {
    for (const path of [...PAGE_PATHS, '/nope', '/nope/deeper', '/replay/x']) {
      expect(servedHeaders(path)).toEqual({ ...lower(ISOLATION_HEADERS), 'cache-control': HTML });
    }
  });

  test('hashed assets are immutable, with nothing joined on', () => {
    expect(servedHeaders('/assets/index-A1b2.js')).toEqual({ ...lower(ISOLATION_HEADERS), 'cache-control': IMMUTABLE });
  });

  test("every other file keeps Pages' default, without no-transform", () => {
    for (const path of publicPaths()) expect([path, servedHeaders(path)['cache-control']]).toEqual([path, PAGES_DEFAULT]);
  });
});

/** Pages' asset server for a deploy holding `files`: the app shell for any other path. */
function assets(files: Record<string, [string, string]>) {
  const seen: Request[] = [];
  return {
    seen,
    env: {
      ASSETS: {
        async fetch(request: Request) {
          seen.push(request);
          const file = files[new URL(request.url).pathname];
          const [type, body] = file ?? ['text/html; charset=utf-8', SHELL];
          return new Response(body, { headers: { 'Content-Type': type, 'Cache-Control': PAGES_DEFAULT, ETag: '"x"' } });
        },
      },
    },
  };
}

const deploy = () => assets({ '/assets/index-NEW.js': ['application/javascript', 'export {};'] });
const get = (path: string, init?: RequestInit) => new Request(`https://rune.fast${path}`, init);

describe('the Pages Function', () => {
  test('public/_headers still carries the isolation headers the Function copies', () => {
    expect(headerRules()[0]!.path).toBe('/*');
    expect(Object.fromEntries(headerRules()[0]!.set)).toMatchObject(lower(ISOLATION_HEADERS));
  });

  test('a chunk the deploy does not have is a 404 in plain text, with the site headers', async () => {
    const res = await onRequest({ request: get('/assets/MomentPage-OLDHASH0.js'), ...deploy() });
    expect(res.status).toBe(404);
    expect(res.headers.get('Content-Type')).toStartWith('text/plain');
    expect(await res.text()).not.toContain('<');
    for (const [name, value] of Object.entries(ISOLATION_HEADERS)) expect(res.headers.get(name)).toBe(value);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  test('fonts, licences and wasm are files too', async () => {
    for (const path of ['/fonts/Gone.woff2', '/licenses/GONE.txt', '/assets/wasm_gzip_bg-OLD.wasm']) {
      expect((await onRequest({ request: get(path), ...deploy() })).status).toBe(404);
    }
  });

  test('a HEAD for a missing file is a 404 without a body', async () => {
    const res = await onRequest({ request: get('/assets/gone.js', { method: 'HEAD' }), ...deploy() });
    expect(res.status).toBe(404);
    expect(res.body).toBeNull();
  });

  test('a file the deploy has is served unchanged, with the site headers', async () => {
    const res = await onRequest({ request: get('/assets/index-NEW.js'), ...deploy() });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/javascript');
    expect(await res.text()).toBe('export {};');
    expect(res.headers.get('Cross-Origin-Embedder-Policy')).toBe('require-corp');
    expect(res.headers.get('Cache-Control')).toBe(PAGES_DEFAULT);
  });

  test('a page route keeps the app shell, should one ever reach the Function', async () => {
    const res = await onRequest({ request: get('/does-not-exist'), ...deploy() });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(SHELL);
    expect(res.headers.get('Cross-Origin-Opener-Policy')).toBe('same-origin');
    expect(res.headers.get('Cache-Control')).toBe(HTML);
  });

  test('no-transform is added to the caching Pages gives, once', () => {
    expect(withNoTransform(PAGES_DEFAULT)).toBe(HTML);
    expect(withNoTransform('no-store')).toBe('no-store, no-transform');
    expect(withNoTransform(HTML)).toBe(HTML);
    expect(withNoTransform(null)).toBe('no-transform');
  });

  test("the browser's cached copy is not revalidated: a once-cached shell gets the 404", async () => {
    const pages = deploy();
    const res = await onRequest({ request: get('/assets/gone.js', { headers: { 'If-None-Match': '"x"' } }), env: pages.env });
    expect(res.status).toBe(404);
    expect(pages.seen[0]!.headers.get('If-None-Match')).toBeNull();
  });
});

describe('_routes.json', () => {
  const files = ['index.html', '_headers', 'assets/index-A.js', 'assets/Page-B.css', 'fonts/F.woff2', 'licenses/LICENSE.txt'];

  test('routes the output directories to the Function, less every file in them', () => {
    expect(pagesRoutes(files)).toEqual({
      version: 1,
      include: ['/assets/*', '/fonts/*', '/licenses/*'],
      exclude: ['/assets/Page-B.css', '/assets/index-A.js', '/fonts/F.woff2', '/licenses/LICENSE.txt'],
    });
  });

  test("stays within Pages' 100 rules, keeping assets/ off the Function first", () => {
    const many = [...Array.from({ length: 120 }, (_, i) => `clips/c${i}.mp4`), 'assets/index-A.js'];
    const routes = pagesRoutes(many);
    expect(routes.include.length + routes.exclude.length).toBe(100);
    expect(routes.exclude[0]).toBe('/assets/index-A.js');
  });
});
