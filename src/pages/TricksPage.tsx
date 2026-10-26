import { useEffect } from 'react';
import { capitalize, countWord } from '../lib/numbers';
import { GROUPS, TRICKS, headlineFacts, inGroup, rejected } from '../tricks/model';
import { Sources, TrickCard } from '../tricks/TrickCard';
import styles from './TricksPage.module.css';

export function TricksPage() {
  const h = headlineFacts(TRICKS);
  const left = rejected(TRICKS);

  useEffect(() => {
    document.title = 'Tricks · rune.fast';
  }, []);

  return (
    <article className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>
          {capitalize(countWord(h.used))} techniques made the record, and {countWord(h.halved)} of them cut a cost in half
          or more.
        </h1>
        <p className={styles.dek}>
          Each chart sets a cost without the trick against the same cost with it. {capitalize(countWord(h.measured))}{' '}
          were measured before and after, {countWord(h.unmeasured)} {h.unmeasured === 1 ? 'is' : 'are'} inferred from the
          run plan, and the rest carry no number.
        </p>
      </header>

      {GROUPS.map((g) => (
        <section key={g.id} className={styles.group}>
          <h2 className={styles.groupTitle}>{g.title}</h2>
          <div className={styles.cards}>
            {inGroup(TRICKS, g.id).map((t) => (
              <TrickCard key={t.id} trick={t} />
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
