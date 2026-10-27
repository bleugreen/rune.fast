import { Link, NavLink, Outlet, ScrollRestoration } from 'react-router-dom';
import { fmtCalendarDate } from '../lib/time';
import styles from './Layout.module.css';

const LIVE = [
  { to: '/', label: 'Story' },
  { to: '/attempts', label: 'Attempts' },
  { to: '/tricks', label: 'Tricks' },
  { to: '/cost', label: 'Cost' },
] as const;

const SOON = ['Swarm', 'Routes'] as const;

export function Layout() {
  return (
    <div className={styles.shell}>
      <header className={styles.masthead}>
        <div className={styles.mastInner}>
          <Link to="/" className={styles.wordmark}>
            rune.fast
          </Link>
          <nav className={styles.nav} aria-label="Pages">
            {LIVE.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => (isActive ? styles.current : styles.link)}>
                {n.label}
              </NavLink>
            ))}
            {SOON.map((label) => (
              <span key={label} className={styles.soon}>
                {label}
                <span className={styles.soonTag}>soon</span>
              </span>
            ))}
          </nav>
        </div>
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
      <footer className={styles.footer}>
        <div className={styles.footInner}>
          <span>Every number on this site traces to a source</span>
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
