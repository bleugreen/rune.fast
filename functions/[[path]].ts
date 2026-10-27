/**
 * The Pages Function behind the build-output directories (assets/, fonts/, licenses/, clips/).
 * dist/_routes.json, written by scripts/pages-routes.ts, sends a request here only when its path
 * is under one of them and is not a file of this deploy. Pages' own answer for such a path is an
 * HTML page (404.html, the Nothing here page; index.html with status 200 for a deploy without
 * one), which a tab loaded before the deploy would then try to run as the chunk it asked for. Here
 * a missing file is a plain-text 404 that no cache keeps.
 *
 * Pages applies public/_headers to static responses only, never to a Function's, so the
 * cross-origin isolation headers are set here too.
 */

/** public/_headers' site-wide rule; scripts/pages.test.ts holds the two together. */
export const ISOLATION_HEADERS = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
} as const;

type Context = { request: Request; env: { ASSETS: { fetch(request: Request): Promise<Response> } } };

export async function onRequest({ request, env }: Context): Promise<Response> {
  // Asked without the browser's validators, so a browser that once cached the shell under a
  // chunk's name gets the 404 rather than a 304 for its cached copy.
  const response = await env.ASSETS.fetch(new Request(request.url, { method: request.method }));
  const isShell = response.headers.get('Content-Type')?.startsWith('text/html') ?? false;
  if (isShell && namesFile(new URL(request.url).pathname)) return notFound(request.method);
  const served = new Response(response.body, response);
  for (const [name, value] of Object.entries(ISOLATION_HEADERS)) served.headers.set(name, value);
  return served;
}

/**
 * A path ending in a file name. Page routes never do, so they keep Pages' own answer even if Pages
 * ever routes every request here, which it does when a deploy has no _routes.json.
 */
function namesFile(path: string): boolean {
  return /\.[A-Za-z0-9]+$/.test(path) && !path.endsWith('.html');
}

function notFound(method: string): Response {
  return new Response(method === 'HEAD' ? null : 'Not found\n', {
    status: 404,
    headers: {
      ...ISOLATION_HEADERS,
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
