import { useEffect } from 'react';
import { SHARE_IMAGE, SITE_NAME, siteMeta } from '../meta';
import { RunTree } from '../tree/RunTree';
import styles from './Share.module.css';

/**
 * Development-only: the link-preview image, the story's opening at 1200 by 630 (the site name, the
 * title, the run as a tree). scripts/render-share.ts shoots it into public/share.png.
 */
export default function Share() {
  useEffect(() => {
    document.title = `Share image · ${SITE_NAME}`;
  }, []);

  return (
    <div className={styles.card} data-share style={{ width: SHARE_IMAGE.width, height: SHARE_IMAGE.height }}>
      <div className={styles.words}>
        <p className={styles.site}>{SITE_NAME}</p>
        <h1 className={styles.title}>{siteMeta()['/'].title}</h1>
      </div>
      <RunTree className={styles.tree} />
    </div>
  );
}
