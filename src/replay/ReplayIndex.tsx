import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fmtInt } from '../lib/numbers';
import { MOMENTS, stepsIn } from './moments';
import styles from './MomentPage.module.css';

/** /replay: the moments of the finish that can be replayed, each beside the code that ran it. */
export default function ReplayIndex() {
  useEffect(() => {
    document.title = 'Replays · rune.fast';
  }, []);

  return (
    <article className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>The finish, replayed beside its code</h1>
        <p className={styles.dek}>
          Moments from the last 41 minutes of the record, from the recovery login at Lumbridge to Agility 99, in the
          game world as the swarm's recorder saw it. Beside each, the step the runner was in and the code it ran.
        </p>
      </header>
      <ol className={styles.list}>
        {MOMENTS.map((m) => (
          <li key={m.id}>
            <Link to={`/replay/${m.id}`}>{m.title}</Link>
            <p>{m.caption}</p>
            <span className={styles.span}>
              Ticks {fmtInt(m.from)}–{fmtInt(m.to)} · {stepsIn(m.from, m.to).map((s) => s.id).join(', ')}
            </span>
          </li>
        ))}
      </ol>
    </article>
  );
}
