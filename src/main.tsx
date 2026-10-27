import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider, type RouteObject } from 'react-router-dom';
import './styles/tokens.css';
import './styles/base.css';
import { siteRoutes } from './components/Layout';
import { startAnalytics } from './lib/analytics';
import { recovery } from './lib/deploy';
import { StoryPage } from './pages/StoryPage';

/* The tokens and share-image screens exist only in development; the production build drops them. */
const Tokens = import.meta.env.DEV ? lazy(() => import('./dev/Tokens')) : null;
const Share = import.meta.env.DEV ? lazy(() => import('./dev/Share')) : null;

/*
 * The story is where most readers land, so it is in the entry. Every other page (and Nothing here,
 * which names the site from src/meta.ts) is its own chunk with its data, loaded when it is visited; one that fails to load (a deploy since the tab opened)
 * reaches the routes' errorElement, which reloads once.
 */
const pages: RouteObject[] = [
  { index: true, element: <StoryPage /> },
  { path: 'route', lazy: async () => ({ Component: (await import('./pages/RoutePage')).RoutePage }) },
  { path: 'tricks', lazy: async () => ({ Component: (await import('./pages/TricksPage')).TricksPage }) },
  { path: 'cost', lazy: async () => ({ Component: (await import('./pages/CostPage')).CostPage }) },
  { path: 'harness', lazy: async () => ({ Component: (await import('./pages/HarnessPage')).HarnessPage }) },
  ...(Tokens ? [{ path: 'tokens', element: <Suspense><Tokens /></Suspense> }] : []),
  ...(Share ? [{ path: 'share', element: <Suspense><Share /></Suspense> }] : []),
  { path: '*', lazy: async () => ({ Component: (await import('./pages/NotFound')).NotFound }) },
];

// Vite's preload helper fires this when a lazily loaded chunk or its stylesheet does not load,
// which after a deploy is a chunk name the new deploy no longer has.
window.addEventListener('vite:preloadError', () => recovery.reload());

const router = createBrowserRouter(siteRoutes(pages));

startAnalytics();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
