import { useEffect } from 'react';
import { capitalize, countWord } from '../lib/numbers';
import { GROUPS, TRICKS, headlineFacts, inGroup, rejected } from '../tricks/model';
import { Sources, TrickCard } from '../tricks/TrickCard';
import styles from './TricksPage.module.css';

export function TricksPage() {
  const h = headlineFacts(TRICKS);
  const left = rejected(TRICKS);
  // The first clip's caption is the first clock time on the open page (source lines wait behind their disclosures), so it names the zone.
  const firstClip = GROUPS.flatMap((g) => inGroup(TRICKS, g.id)).find((t) => t.clip)?.id;

  useEffect(() => {
    document.title = 'Tricks · rune.fast';
  }, []);

  return (
    <article className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>{capitalize(countWord(h.used))} techniques that made the run</h1>
        <p className={styles.dek}>{capitalize(countWord(h.halved))} of them cut a cost in half or more</p>
      </header>

      {GROUPS.map((g) => (
        <section key={g.id} className={styles.group}>
          <h2 className={styles.groupTitle}>{g.title}</h2>
          <div className={styles.cards}>
            {inGroup(TRICKS, g.id).map((t) => (
              <TrickCard key={t.id} trick={t} zone={t.id === firstClip} />
            ))}
          </div>
        </section>
      ))}

      <section className={styles.group}>
        <h2 className={styles.groupTitle}>What the run left out</h2>
        <ul className={styles.left}>
          {left.map((t) => (
            <li key={t.id} id={t.id}>
              <span className={styles.leftName}>{t.name}</span>
              <span>{t.what_instead}</span>
            </li>
          ))}
        </ul>
        <Sources sources={left.flatMap((t) => t.sources)} />
      </section>
    </article>
  );
}
