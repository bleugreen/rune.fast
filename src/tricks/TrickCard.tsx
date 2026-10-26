import { listJoin, type Clip, type Trick } from './model';
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

function ClipSlot({ clip }: { clip: Clip | null }) {
  if (!clip) {
    return (
      <div className={styles.noClip}>
        <span>Lab clip to come</span>
      </div>
    );
  }
  return (
    <figure className={styles.clip}>
      <video src={clip.src} poster={clip.poster} controls muted playsInline loop preload="none" />
      <figcaption>{clip.caption}</figcaption>
    </figure>
  );
}

/** One technique: what the game does, what the run did instead, one chart of the saving, and its clip slot. */
export function TrickCard({ trick: t }: { trick: Trick }) {
  return (
    <article className={styles.card} id={t.id}>
      <div className={styles.text} data-wide={t.saving ? undefined : true}>
        <h3 className={styles.name}>{t.name}</h3>
        <p className={styles.body}>{[t.what_normally, t.what_instead, t.why_allowed].filter(Boolean).join(' ')}</p>
        {t.steps_plain.length > 0 && <p className={styles.aside}>Used in {listJoin(t.steps_plain)}.</p>}
        {t.failed_live && <p className={styles.aside}>{t.failed_live}</p>}
      </div>
      {t.saving && (
        <div className={styles.chartCell}>
          <SavingChart saving={t.saving} />
        </div>
      )}
      <div className={styles.clipCell}>
        <ClipSlot clip={t.clip} />
      </div>
      <div className={styles.sourcesCell}>
        <Sources sources={t.sources} />
      </div>
    </article>
  );
}
