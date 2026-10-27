import { useEffect, useState } from 'react';
import { useLocation, useRouteError } from 'react-router-dom';
import { isStaleAssetError, recovery } from '../lib/deploy';
import styles from './StoryPage.module.css';

/**
 * The routes' errorElement, in place of React Router's developer screen. A page whose code is from
 * an earlier deploy reloads once to get the new one and shows nothing meanwhile; any other failure,
 * or one that outlives the reload, gets the plain page below.
 */
export function RouteError() {
  const error = useRouteError();
  const stale = isStaleAssetError(error);
  const [reloading, setReloading] = useState(() => recovery.reloading || (stale && recovery.canReload()));

  useEffect(() => {
    console.error(error);
    if (stale) setReloading(recovery.reload());
  }, [error, stale]);

  return reloading ? null : <LoadFailed stale={stale} />;
}

export function LoadFailed({ stale }: { stale: boolean }) {
  const { pathname, search } = useLocation();
  return (
    <article className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>
          {stale ? 'This page failed to load, probably because the site was just updated.' : 'This page failed to load.'}
        </h1>
        {/* Plain links, not router links: each is a full load, which gets the current deploy. */}
        <p className={styles.dek}>
          <a href={pathname + search}>Reload</a> · <a href="/">Back to the story</a>
        </p>
      </header>
    </article>
  );
}
