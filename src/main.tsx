import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { createBrowserRouter, matchRoutes, RouterProvider, type RouteObject } from 'react-router-dom';
import './styles/tokens.css';
import './styles/base.css';
import { startAnalytics } from './lib/analytics';
import { recovery } from './lib/deploy';
import { prerenderedAt } from './lib/site';
import { siteRouteTree } from './routes';

// Vite's preload helper fires this when a lazily loaded chunk or its stylesheet does not load,
// which after a deploy is a chunk name the new deploy no longer has.
window.addEventListener('vite:preloadError', () => recovery.reload());

startAnalytics();

const routes = siteRouteTree();

/**
 * Loads the landing page's own chunk before the first render, so the router starts with the page
 * rather than an empty fallback, and hydration finds what the server drew. The page's HTML
 * modulepreloads that chunk (vite.config.ts), so it downloads beside the entry. True if it loaded;
 * a route whose chunk fails stays lazy, and the router's own load of it reaches the errorElement.
 */
async function resolveLanding(): Promise<boolean> {
  const lazy = (matchRoutes(routes, window.location) ?? []).filter((m) => typeof m.route.lazy === 'function');
  const loaded = await Promise.all(
    lazy.map(async ({ route }) => {
      try {
        const own = await (route.lazy as () => Promise<Partial<RouteObject>>)();
        Object.assign(route, { ...own, lazy: undefined });
        return true;
      } catch {
        return false;
      }
    }),
  );
  return loaded.every(Boolean);
}

void resolveLanding().then((landed) => {
  const root = document.getElementById('root')!;
  const app = (
    <StrictMode>
      <RouterProvider router={createBrowserRouter(routes)} />
    </StrictMode>
  );
  // The build renders each page into its own HTML (scripts/page-heads.ts) and marks the root with
  // the page it drew. Anywhere else (the dev server, a page served at a path not its own) the app
  // renders from scratch, replacing whatever the root holds.
  if (landed && root.firstChild && root.dataset.prerendered === prerenderedAt(window.location.pathname)) hydrateRoot(root, app);
  else createRoot(root).render(app);
});
