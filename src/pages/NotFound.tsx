import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { SITE_NAME } from '../meta';
import styles from './StoryPage.module.css';

export function NotFound() {
  useEffect(() => {
    document.title = `Nothing here · ${SITE_NAME}`;
  }, []);

  return (
    <article className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>Nothing here</h1>
        <p className={styles.dek}>
          <Link to="/">Back to the story</Link>
        </p>
      </header>
    </article>
  );
}
