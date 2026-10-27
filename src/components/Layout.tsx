import { useEffect } from 'react';
import { Link, NavLink, Outlet, ScrollRestoration, useLocation, type RouteObject } from 'react-router-dom';
import { fmtCalendarDate } from '../lib/time';
import { AUTHOR, applyPageMeta, metaFor } from '../meta';
import { RouteError } from '../pages/LoadFailed';
import styles from './Layout.module.css';

/**
 * The site's route tree: every page inside the Layout. A page that fails shows the error page in
 * its place, under the masthead; only a failure of the Layout itself loses the masthead.
 */
export function siteRoutes(pages: RouteObject[]): RouteObject[] {
  return [{ element: <Layout />, errorElement: <LayoutError />, children: [{ errorElement: <RouteError />, children: pages }] }];
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
  // that is no page (Nothing here, the dev screens) sets its own title.
  const { pathname } = useLocation();
  useEffect(() => {
    const meta = metaFor(pathname);
    if (meta) applyPageMeta(document, meta);
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
