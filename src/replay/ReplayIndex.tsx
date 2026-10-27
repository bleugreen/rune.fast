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

  // Fill Cache Storage with the game cache while the reader picks a moment: after first paint,
  // when the browser is idle, and through a dynamic import so this page's own chunk stays small.
  useEffect(() => {
    let idle: number | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const prefetch = () => void import('./cache').then((m) => m.prefetchCache());
    const frame = requestAnimationFrame(() => {
      if ('requestIdleCallback' in window) idle = requestIdleCallback(prefetch);
      else timer = setTimeout(prefetch, 0);
    });
    return () => {
      cancelAnimationFrame(frame);
      if (idle !== undefined) cancelIdleCallback(idle);
      clearTimeout(timer);
    };
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
