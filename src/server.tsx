import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouterProvider, createStaticHandler, createStaticRouter } from 'react-router-dom';
import { ORIGIN } from './meta';
import { siteRouteTree } from './routes';

/*
 * The build's server entry (vite.config.ts builds it beside the client, through the same plugins,
 * so it renders the public projections of the data and the same CSS module class names).
 * scripts/page-heads.ts renders each page with it into that page's HTML.
 */

export { NOT_FOUND, PAGE_PATHS } from './lib/site';
export { NOT_FOUND_FILE, pageFile, siteMeta, withBody, withHead, withNotFoundHead } from './meta';

/** React's one server warning that is not a fault: layout effects (measuring, the router's links) run in the browser. */
const LAYOUT_EFFECT = 'useLayoutEffect does nothing on the server';

/**
 * The page at `path` as the browser's first render draws it: the site's routes inside the router,
 * the page's own lazy route resolved. Throws on a route error or anything React reports while
 * rendering, so a broken page fails the build rather than shipping its error page as the page.
 */
export async function renderPage(path: string): Promise<string> {
  const handler = createStaticHandler(siteRouteTree());
  const context = await handler.query(new Request(ORIGIN + path));
  if (context instanceof Response) throw new Error(`prerender ${path}: answered ${context.status}`);
  if (context.errors) throw new Error(`prerender ${path}: ${Object.values(context.errors).map(String).join('; ')}`);
  const reported: unknown[][] = [];
  const consoleError = console.error;
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes(LAYOUT_EFFECT)) return;
    reported.push(args);
  };
  try {
    const html = renderToString(
      <StrictMode>
        <StaticRouterProvider router={createStaticRouter(handler.dataRoutes, context)} context={context} hydrate={false} />
      </StrictMode>,
    );
    if (reported.length) throw new Error(`prerender ${path}: React reported ${reported.map((a) => a.map(String).join(' ')).join('\n')}`);
    return html;
  } finally {
    console.error = consoleError;
  }
}
