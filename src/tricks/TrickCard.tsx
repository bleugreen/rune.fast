import { Clip } from '../clips/Clip';
import { clipById } from '../clips/registry';
import { listJoin, type Trick } from './model';
import { SavingChart } from './SavingChart';
import styles from './TrickCard.module.css';

export function Sources({ sources }: { sources: readonly string[] }) {
  return (
    <details className={styles.sources}>
      <summary>sources</summary>
      <ul>
        {sources.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
    </details>
  );
}

/** One technique: what the game does and what the run did instead, beside its chart and its clip. */
export function TrickCard({ trick: t }: { trick: Trick }) {
  return (
    <article className={styles.card} id={t.id}>
      <div className={styles.text}>
        <h3 className={styles.name}>{t.name}</h3>
        <p className={styles.body}>{[t.what_normally, t.what_instead, t.why_allowed].filter(Boolean).join(' ')}</p>
        {t.steps_plain.length > 0 && <p className={styles.aside}>Used in {listJoin(t.steps_plain)}.</p>}
        {t.failed_live && <p className={styles.aside}>{t.failed_live}</p>}
      </div>
      <div className={styles.media}>
        {t.saving && (
          <div className={styles.chart}>
            <SavingChart saving={t.saving} />
          </div>
        )}
        {t.clip ? (
          <Clip clip={clipById(t.clip)} />
        ) : (
          <div className={styles.noClip}>
            <span>Clip to come</span>
          </div>
        )}
      </div>
      <div className={styles.sourcesCell}>
        <Sources sources={t.sources} />
      </div>
    </article>
  );
}
