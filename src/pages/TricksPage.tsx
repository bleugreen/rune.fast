import { useEffect } from 'react';
import { capitalize, countWord } from '../lib/numbers';
import { GROUPS, TRICKS, headlineFacts, inGroup } from '../tricks/model';
import { TrickCard } from '../tricks/TrickCard';
import styles from './TricksPage.module.css';

export function TricksPage() {
  const { halved } = headlineFacts(TRICKS);
  // The first clip's caption is the first clock time on the open page (source lines wait behind their disclosures), so it names the zone.
  const firstClip = GROUPS.flatMap((g) => inGroup(TRICKS, g.id)).find((t) => t.clip)?.id;

  // A link to /tricks#<id> lands on that card, arriving from another page or by a changed hash.
  useEffect(() => {
    const land = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (id) document.getElementById(id)?.scrollIntoView({ block: 'start' });
    };
    land();
    window.addEventListener('hashchange', land);
    return () => window.removeEventListener('hashchange', land);
  }, []);

  return (
    <article className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>Techniques that made the run</h1>
        <p className={styles.dek}>{capitalize(countWord(halved))} of them cut a cost in half or more</p>
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
    </article>
  );
}
