import { Suspense, lazy } from 'react';
import type { RouteObject } from 'react-router-dom';
import { siteRoutes } from './components/Layout';
import { StoryPage } from './pages/StoryPage';

/* The tokens and share-image screens exist only in development; the production build drops them. */
const Tokens = import.meta.env.DEV ? lazy(() => import('./dev/Tokens')) : null;
const Share = import.meta.env.DEV ? lazy(() => import('./dev/Share')) : null;

/**
 * The site's routes, one table for the browser (src/main.tsx) and the build's prerender
 * (src/server.tsx). The story is where most readers land, so it is in the entry. Every other page
 * (and Nothing here, which names the site from src/meta.ts) is its own chunk with its data, which
 * each page's HTML preloads for itself (vite.config.ts); one that fails to load (a deploy since the
 * tab opened) reaches the routes' errorElement, which reloads once. A fresh tree on each call: the
 * browser resolves its landing page's lazy route in place.
 */
export function siteRouteTree(): RouteObject[] {
  return siteRoutes([
    { index: true, element: <StoryPage /> },
    { path: 'route', lazy: async () => ({ Component: (await import('./pages/RoutePage')).RoutePage }) },
    { path: 'tricks', lazy: async () => ({ Component: (await import('./pages/TricksPage')).TricksPage }) },
    { path: 'cost', lazy: async () => ({ Component: (await import('./pages/CostPage')).CostPage }) },
    { path: 'harness', lazy: async () => ({ Component: (await import('./pages/HarnessPage')).HarnessPage }) },
    ...(Tokens ? [{ path: 'tokens', element: <Suspense><Tokens /></Suspense> }] : []),
    ...(Share ? [{ path: 'share', element: <Suspense><Share /></Suspense> }] : []),
    { path: '*', lazy: async () => ({ Component: (await import('./pages/NotFound')).NotFound }) },
  ]);
}
