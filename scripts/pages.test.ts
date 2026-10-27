import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { ISOLATION_HEADERS, onRequest } from '../functions/[[path]]';
import { pagesRoutes } from './pages-routes';

const SHELL = '<!doctype html><html><body><div id="root"></div></body></html>';

/** The headers public/_headers sets on every path. */
function siteHeaders(): Record<string, string> {
  const lines = readFileSync(new URL('../public/_headers', import.meta.url), 'utf8').split('\n');
  const start = lines.indexOf('/*');
  const out: Record<string, string> = {};
  for (const line of lines.slice(start + 1)) {
    const m = /^\s+([\w-]+):\s*(.+)$/.exec(line);
    if (!m) break;
    out[m[1]!] = m[2]!.trim();
  }
  return out;
}

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
          return new Response(body, { headers: { 'Content-Type': type, ETag: '"x"' } });
        },
      },
    },
  };
}

const deploy = () => assets({ '/assets/index-NEW.js': ['application/javascript', 'export {};'] });
const get = (path: string, init?: RequestInit) => new Request(`https://rune.fast${path}`, init);

describe('the Pages Function', () => {
  test('public/_headers still carries the isolation headers the Function copies', () => {
    expect(siteHeaders()).toEqual({ ...ISOLATION_HEADERS });
  });

  test('a chunk the deploy does not have is a 404 in plain text, with the site headers', async () => {
    const res = await onRequest({ request: get('/assets/MomentPage-OLDHASH0.js'), ...deploy() });
    expect(res.status).toBe(404);
    expect(res.headers.get('Content-Type')).toStartWith('text/plain');
    expect(await res.text()).not.toContain('<');
    for (const [name, value] of Object.entries(siteHeaders())) expect(res.headers.get(name)).toBe(value);
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
  });

  test('a page route keeps the app shell, should one ever reach the Function', async () => {
    const res = await onRequest({ request: get('/does-not-exist'), ...deploy() });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(SHELL);
    expect(res.headers.get('Cross-Origin-Opener-Policy')).toBe('same-origin');
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
