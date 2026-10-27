import { fmtInt } from '../../lib/numbers';
import type { HarnessModel } from '../model';
import styles from './Figures.module.css';

const VERBS = ['write', 'read', 'run'] as const;

/** Each role's verb calls as a proportion bar: write, read, run. */
export function VerbMix({ m }: { m: HarnessModel }) {
  return (
    <div>
      <ul className={styles.bars}>
        {m.verbs.rows.map((r) => (
          <li key={r.role} className={styles.bar}>
            <span>{r.role}</span>
            <span className={styles.stack} aria-label={VERBS.map((v) => `${v} ${fmtInt(r[v])}`).join(', ')}>
              {VERBS.map((v) => (
                <span key={v} className={styles[v]} style={{ width: `${(r[v] / r.total) * 100}%` }} />
              ))}
            </span>
            <span className={styles.barValue}>{fmtInt(r.total)}</span>
          </li>
        ))}
      </ul>
      <p className={styles.key}>
        {VERBS.map((v) => (
          <span key={v}>
            <i className={`${styles.swatch} ${styles[v]}`} />
            {v}
          </span>
        ))}
      </p>
    </div>
  );
}
