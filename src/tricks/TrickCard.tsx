import { Link } from 'react-router-dom';
import { Clip } from '../clips/Clip';
import { Threaded } from '../components/Coded';
import { clipById } from '../clips/registry';
import { listJoin, type Trick } from './model';
import { SavingChart } from './SavingChart';
import { StillStrip } from './StillStrip';
import styles from './TrickCard.module.css';

function Sources({ sources }: { sources: readonly string[] }) {
  return (
    <details className={styles.sources}>
      <summary>sources</summary>
      <ul>
        {sources.map((s) => (
          <li key={s}>
            <Threaded text={s} />
          </li>
        ))}
      </ul>
    </details>
  );
}

/**
 * One technique: what the game does and what the run did instead, its chart under the prose, and its clip or
 * frames beside them. A technique with nothing on screen to film has no media cell, and its chart takes that column.
 */
export function TrickCard({ trick: t }: { trick: Trick }) {
  const media = t.clip ? <Clip clip={clipById(t.clip)} /> : t.stills ? <StillStrip strip={t.stills} /> : null;
  return (
    <article className={[styles.card, !media && styles.unfilmed].filter(Boolean).join(' ')} id={t.id}>
      <div className={styles.text}>
        <h3 className={styles.name}>{t.name}</h3>
        <p className={styles.body}>{[t.what_normally, t.what_instead, t.why_allowed].filter(Boolean).join(' ')}</p>
        {t.steps_plain.length > 0 && <p className={styles.aside}>Used in {listJoin(t.steps_plain)}.</p>}
        {t.failed_live && <p className={styles.aside}>{t.failed_live}</p>}
        {t.route && (
          <p className={`${styles.aside} ${styles.routeLink}`}>
            <Link to={`/route#${t.route.anchor}`}>{t.route.text} →</Link>
          </p>
        )}
      </div>
      {t.saving && (
        <div className={styles.chart}>
          <SavingChart saving={t.saving} />
        </div>
      )}
      {media && <div className={styles.media}>{media}</div>}
      <div className={styles.sourcesCell}>
        <Sources sources={t.sources} />
      </div>
    </article>
  );
}
