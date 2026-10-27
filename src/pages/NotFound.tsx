import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { NOT_FOUND_TITLE } from '../lib/site';
import styles from './StoryPage.module.css';

export function NotFound() {
  useEffect(() => {
    document.title = NOT_FOUND_TITLE;
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
