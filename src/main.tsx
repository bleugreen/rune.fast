import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider, type RouteObject } from 'react-router-dom';
import './styles/tokens.css';
import './styles/base.css';
import { Layout } from './components/Layout';
import { StoryPage } from './pages/StoryPage';
import { AttemptsPage } from './pages/AttemptsPage';
import { NotFound } from './pages/NotFound';

/* The tokens screen exists only in development; the production build drops it. */
const Tokens = import.meta.env.DEV ? lazy(() => import('./dev/Tokens')) : null;

const pages: RouteObject[] = [
  { index: true, element: <StoryPage /> },
  { path: 'attempts', element: <AttemptsPage /> },
  ...(Tokens ? [{ path: 'tokens', element: <Suspense><Tokens /></Suspense> }] : []),
  { path: '*', element: <NotFound /> },
];

const router = createBrowserRouter([{ element: <Layout />, children: pages }]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
