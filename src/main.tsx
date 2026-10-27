import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider, type RouteObject } from 'react-router-dom';
import './styles/tokens.css';
import './styles/base.css';
import { siteRoutes } from './components/Layout';
import { recovery } from './lib/deploy';
import { StoryPage } from './pages/StoryPage';
import { TricksPage } from './pages/TricksPage';
import { CostPage } from './pages/CostPage';
import { HarnessPage } from './pages/HarnessPage';
import { RoutePage } from './pages/RoutePage';
import { NotFound } from './pages/NotFound';

/* The tokens and share-image screens exist only in development; the production build drops them. */
const Tokens = import.meta.env.DEV ? lazy(() => import('./dev/Tokens')) : null;
const Share = import.meta.env.DEV ? lazy(() => import('./dev/Share')) : null;

const pages: RouteObject[] = [
  { index: true, element: <StoryPage /> },
  { path: 'route', element: <RoutePage /> },
  { path: 'tricks', element: <TricksPage /> },
  { path: 'cost', element: <CostPage /> },
  { path: 'harness', element: <HarnessPage /> },
  ...(Tokens ? [{ path: 'tokens', element: <Suspense><Tokens /></Suspense> }] : []),
  ...(Share ? [{ path: 'share', element: <Suspense><Share /></Suspense> }] : []),
  { path: '*', element: <NotFound /> },
];

// Vite's preload helper fires this when a lazily loaded chunk or its stylesheet does not load,
// which after a deploy is a chunk name the new deploy no longer has.
window.addEventListener('vite:preloadError', () => recovery.reload());

const router = createBrowserRouter(siteRoutes(pages));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
