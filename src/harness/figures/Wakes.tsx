import { fmtInt } from '../../lib/numbers';
import type { HarnessModel } from '../model';
import styles from './Figures.module.css';

/** What the harness's briefing said when it opened an agent's turn, ranked, on one linear scale. */
export function Wakes({ m }: { m: HarnessModel }) {
  const top = m.wakes.rows[0]!.n;
  return (
    <ol className={styles.bars}>
      {m.wakes.rows.map((r, k) => (
        <li key={r.kind} className={styles.bar}>
          <span>{r.label}</span>
          <span className={styles.barTrack}>
            <span className={styles.barFill} data-tone={k === 0 ? 'accent' : undefined} style={{ display: 'block', width: `${(r.n / top) * 100}%` }} />
          </span>
          <span className={styles.barValue}>{fmtInt(r.n)}</span>
        </li>
      ))}
    </ol>
  );
}
