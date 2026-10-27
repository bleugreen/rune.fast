import { fmtInt } from '../../lib/numbers';
import type { HarnessModel } from '../model';
import styles from './Figures.module.css';

/** The operator's inputs against the agents' messages to each other and the harness's own, on one scale. */
export function OperatorShare({ m }: { m: HarnessModel }) {
  const o = m.operator;
  const rows = [
    { key: 'operator', label: 'the operator: typed messages, answers and tenet verdicts', n: o.inputs, tone: 'accent' },
    { key: 'agents', label: 'agents’ messages to each other', n: o.agents },
    { key: 'harness', label: 'the harness’s own messages', n: o.harness, tone: 'faint' },
  ];
  const top = Math.max(...rows.map((r) => r.n));
  return (
    <ul className={styles.bars}>
      {rows.map((r) => (
        <li key={r.key} className={styles.bar}>
          <span>{r.label}</span>
          <span className={styles.barTrack}>
            <span className={styles.barFill} data-tone={r.tone} style={{ display: 'block', width: `${(r.n / top) * 100}%` }} />
          </span>
          <span className={styles.barValue}>{fmtInt(r.n)}</span>
        </li>
      ))}
    </ul>
  );
}
