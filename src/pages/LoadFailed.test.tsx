import { beforeEach, describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouterProvider, createStaticHandler, createStaticRouter } from 'react-router-dom';
import { siteRoutes } from '../components/Layout';
import { RELOAD_GRACE_MS } from '../lib/deploy';

/* What the browser gives the page: the footer's build date, the tab's session storage, a network. */
(globalThis as Record<string, unknown>).__BUILD_DATE__ = '2026-10-26';
const session = new Map<string, string>();
(globalThis as Record<string, unknown>).sessionStorage = {
  getItem: (k: string) => session.get(k) ?? null,
  setItem: (k: string, v: string) => void session.set(k, v),
};
Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
beforeEach(() => session.clear());

const STALE = new TypeError('Failed to fetch dynamically imported module: https://rune.fast/assets/MomentPage-OLDHASH0.js');

/** The site's route tree with one page whose loading throws `error`, rendered at that page. */
async function renderFailing(error: Error): Promise<string> {
  const routes = siteRoutes([
    { index: true, element: <p>story</p> },
    { path: 'replay/:moment', loader: () => { throw error; }, element: <p>replay</p> },
  ]);
  const handler = createStaticHandler(routes);
  const context = await handler.query(new Request('https://rune.fast/replay/agility-99'));
  if (context instanceof Response) throw new Error(`unexpected response ${context.status}`);
  const consoleError = console.error;
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('useLayoutEffect does nothing on the server')) return;
    consoleError(...args);
  };
  try {
    return renderToStaticMarkup(<StaticRouterProvider router={createStaticRouter(handler.dataRoutes, context)} context={context} hydrate={false} />);
  } finally {
    console.error = consoleError;
  }
}

const DEVELOPER_SCREEN = /Unexpected Application Error|Hey developer/;

describe('the error page', () => {
  test("a failing page shows the site's error page under the masthead, not React Router's", async () => {
    const html = await renderFailing(new TypeError("Cannot read properties of undefined (reading 'k')"));
    expect(html).not.toMatch(DEVELOPER_SCREEN);
    expect(html).toContain('This page failed to load.');
    expect(html).toContain('>rune.fast</a>');
    expect(html).toContain('<a href="/replay/agility-99">Reload</a>');
    expect(html).toContain('<a href="/">Back to the story</a>');
  });

  test('a chunk from an earlier deploy: the first failure reloads, showing nothing meanwhile', async () => {
    const html = await renderFailing(STALE);
    expect(html).not.toMatch(DEVELOPER_SCREEN);
    expect(html).not.toContain('failed to load');
    expect(html).toContain('>rune.fast</a>');
  });

  test('the same failure just after that reload shows the error page', async () => {
    session.set('rune.fast:deploy-reload', String(Date.now() - RELOAD_GRACE_MS / 10));
    const html = await renderFailing(STALE);
    expect(html).not.toMatch(DEVELOPER_SCREEN);
    expect(html).toContain('This page failed to load, probably because the site was just updated.');
  });
});
