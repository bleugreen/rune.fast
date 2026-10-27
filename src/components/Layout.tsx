import { useEffect, useRef } from 'react';
import { Link, NavLink, Outlet, ScrollRestoration, useLocation, type RouteObject } from 'react-router-dom';
import { registerItalic } from '../lib/fonts';
import { AUTHOR } from '../lib/site';
import { fmtCalendarDate } from '../lib/time';
import { RouteError } from '../pages/LoadFailed';
import styles from './Layout.module.css';

/**
 * The site's route tree: every page inside the Layout. A page that fails shows the error page in
 * its place, under the masthead; only a failure of the Layout itself loses the masthead. On a tab's
 * first load of a page in its own chunk, nothing shows until the chunk is in, so the masthead and
 * the page appear together.
 */
export function siteRoutes(pages: RouteObject[]): RouteObject[] {
  return [
    {
      element: <Layout />,
      errorElement: <LayoutError />,
      HydrateFallback: Blank,
      children: [{ errorElement: <RouteError />, children: pages }],
    },
  ];
}

function Blank() {
  return null;
}

function Byline() {
  return (
    <span>
      Operated by <a href={AUTHOR.url}>{AUTHOR.name}</a>
    </span>
  );
}

/** The Layout's own failure: the error page alone, with a footer of only the byline, which needs nothing that could have failed. */
function LayoutError() {
  return (
    <div className={styles.shell}>
      <main className={styles.main}>
        <RouteError />
      </main>
      <footer className={styles.footer}>
        <div className={styles.footInner}>
          <Byline />
        </div>
      </footer>
    </div>
  );
}

export const NAV = [
  { to: '/', label: 'Story' },
  { to: '/route', label: 'Route' },
  { to: '/tricks', label: 'Tricks' },
  { to: '/cost', label: 'Cost' },
  { to: '/harness', label: 'Harness' },
] as const;

export function Nav() {
  return (
    <nav className={styles.nav} aria-label="Pages">
      {NAV.map((n) => (
        <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => (isActive ? styles.current : styles.link)}>
          {n.label}
        </NavLink>
      ))}
    </nav>
  );
}

export function Layout() {
  // The page's title and description, as its built HTML carries them, on every navigation. A path
  // that is no page (Nothing here, the dev screens) sets its own title. Loaded apart from the
  // entry: the first page's are already in its HTML, and the cost page's description is worked
  // out from the cost model, which no other page needs.
  const { pathname } = useLocation();
  const landing = useRef(true);
  useEffect(() => {
    // The story page registers the italic itself, once its first screen is drawn.
    if (pathname !== '/') registerItalic();
    const first = landing.current;
    landing.current = false;
    // The built HTML carries the landing page's head (scripts/page-heads.ts); the dev server's does not.
    if (first && document.querySelector('meta[name="description"]')) return;
    let live = true;
    import('../meta').then(
      ({ applyPageMeta, metaFor }) => {
        const meta = metaFor(pathname);
        if (live && meta) applyPageMeta(document, meta);
      },
      (e: unknown) => console.warn('Page title not updated', e),
    );
    return () => {
      live = false;
    };
  }, [pathname]);

  return (
    <div className={styles.shell}>
      <header className={styles.masthead}>
        <div className={styles.mastInner}>
          <Link to="/" className={styles.wordmark}>
            rune.fast
          </Link>
          <Nav />
        </div>
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
      <footer className={styles.footer}>
        <div className={styles.footInner}>
          <span>
            <Byline /> · <span className={styles.phrase}>Every number on this site traces to a source</span>
          </span>
          <span>Generated {fmtCalendarDate(__BUILD_DATE__)}</span>
          <p className={styles.credits}>
            3D replays use rs-map-viewer (BSD-2-Clause) via RS World and rs-dash · Credits: rs-sdk and LostCity (MIT),
            Jagex, RuneLite, OpenRS2 Archive, RuneScape Archive, OSRS Wiki, 2004scape, 2009scape, RuneStar, Blurite,
            RuneApps Model Viewer · <a href="/licenses/LICENSE.txt">Licence</a> ·{' '}
            <a href="/licenses/UPSTREAM.md">Provenance</a>
          </p>
        </div>
      </footer>
      <ScrollRestoration />
    </div>
  );
}
