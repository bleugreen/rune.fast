import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, StaticRouterProvider, createStaticHandler, createStaticRouter, type RouteObject } from 'react-router-dom';
import { PAGE_PATHS } from '../meta';
import { NotFound } from '../pages/NotFound';
import { Nav, siteRoutes } from './Layout';

(globalThis as Record<string, unknown>).__BUILD_DATE__ = '2026-10-26';

/** NavLink's layout effect does nothing on the server, which is all this needs. */
function render(): string {
  const error = console.error;
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('useLayoutEffect does nothing on the server')) return;
    error(...args);
  };
  try {
    return renderToStaticMarkup(
      <MemoryRouter initialEntries={['/route']}>
        <Nav />
      </MemoryRouter>,
    );
  } finally {
    console.error = error;
  }
}

describe('the nav', () => {
  const html = render();
  const labels = [...html.matchAll(/<a [^>]*>([^<]*)<\/a>/g)].map((m) => m[1]);

  test('links every live page, the Route page among them', () => {
    expect(labels).toEqual(['Story', 'Route', 'Tricks', 'Cost', 'Harness']);
    expect(html).not.toContain('href="/attempts"');
    expect(html).toContain('href="/route"');
  });

  test('marks the page it is on', () => {
    expect(html).toMatch(/<a [^>]*class="current"[^>]*href="\/route"|<a [^>]*href="\/route"[^>]*class="current"/);
  });

  test('carries no “soon” entries', () => {
    expect(html.toLowerCase()).not.toContain('soon');
    expect(readFileSync('src/components/Layout.tsx', 'utf8').toLowerCase()).not.toContain('soon');
    expect(readFileSync('src/components/Layout.module.css', 'utf8').toLowerCase()).not.toContain('soon');
  });
});

/** The site's route tree, a stand-in for each page, rendered at `path`; `layoutFails` makes the Layout's own route fail. */
async function renderSite(path: string, layoutFails = false): Promise<string> {
  const pages: RouteObject[] = [
    ...PAGE_PATHS.map((p) => (p === '/' ? { index: true, element: <p>page</p> } : { path: p.slice(1), element: <p>page</p> })),
    { path: 'broken', loader: () => { throw new Error('broken'); }, element: <p>never</p> },
    { path: '*', element: <NotFound /> },
  ];
  const [layout, ...rest] = siteRoutes(pages);
  const routes = layoutFails ? [{ ...layout!, loader: () => { throw new Error('layout'); } }, ...rest] : [layout!, ...rest];
  const handler = createStaticHandler(routes);
  const context = await handler.query(new Request(`https://rune.fast${path}`));
  if (context instanceof Response) throw new Error(`unexpected response ${context.status}`);
  const consoleError = console.error;
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('useLayoutEffect does nothing on the server')) return;
    if (args[0] instanceof Error) return; // the error pages log what failed
    consoleError(...args);
  };
  try {
    return renderToStaticMarkup(<StaticRouterProvider router={createStaticRouter(handler.dataRoutes, context)} context={context} hydrate={false} />);
  } finally {
    console.error = consoleError;
  }
}

const footer = (html: string) => html.slice(html.indexOf('<footer'), html.indexOf('</footer>'));
const BYLINE = 'Operated by <a href="https://bleu.green">bleugreen</a>';

describe('the footer', () => {
  test.each([...PAGE_PATHS])('%s names the operator, linked to their site, first', async (p) => {
    const f = footer(await renderSite(p));
    expect(f).toContain(`<span><span>${BYLINE}</span> · Every number on this site traces to a source</span>`);
    expect(f).not.toContain('target=');
  });

  test('so do the Nothing here page and the error page', async () => {
    const notFound = await renderSite('/nope');
    expect(notFound).toContain('Nothing here');
    const error = await renderSite('/broken');
    expect(error).toContain('This page failed to load.');
    for (const html of [notFound, error]) expect(footer(html)).toContain(BYLINE);
  });

  test('and the error page that stands in for the whole Layout', async () => {
    const html = await renderSite('/route', true);
    expect(html).toContain('This page failed to load.');
    expect(html).not.toContain('>rune.fast</a>');
    expect(footer(html)).toContain(BYLINE);
  });
});
