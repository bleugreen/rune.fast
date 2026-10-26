import { Link } from 'react-router-dom';
import styles from './StoryPage.module.css';

export function NotFound() {
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
