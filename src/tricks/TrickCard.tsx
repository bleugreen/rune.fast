import { Clip } from '../clips/Clip';
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
 * One technique: what the game does and what the run did instead, its chart under the prose, and its clip beside them.
 * `zone` names the Pacific zone on the clip's time, for the card whose clip carries the page's first clock time.
 */
export function TrickCard({ trick: t, zone }: { trick: Trick; zone?: boolean }) {
  return (
    <article className={styles.card} id={t.id}>
      <div className={styles.text}>
        <h3 className={styles.name}>{t.name}</h3>
        <p className={styles.body}>{[t.what_normally, t.what_instead, t.why_allowed].filter(Boolean).join(' ')}</p>
        {t.steps_plain.length > 0 && <p className={styles.aside}>Used in {listJoin(t.steps_plain)}.</p>}
        {t.failed_live && <p className={styles.aside}>{t.failed_live}</p>}
      </div>
      {t.saving && (
        <div className={styles.chart}>
          <SavingChart saving={t.saving} />
        </div>
      )}
      <div className={styles.media}>
        {t.clip ? (
          <Clip clip={clipById(t.clip)} zone={zone} />
        ) : t.stills ? (
          <StillStrip strip={t.stills} zone={zone} />
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
