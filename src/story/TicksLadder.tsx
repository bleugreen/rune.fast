import { fmtInt } from '../lib/numbers';
import styles from './TicksLadder.module.css';

export interface Rung {
  label: string;
  ticks: number;
}

/**
 * One claim: the run against the record, as two hairlines from a shared zero.
 * The difference is the only coloured mark; at this scale it is a sliver, which
 * is the point.
 */
export function TicksLadder({ record, run }: { record: Rung; run: Rung }) {
  const max = Math.max(record.ticks, run.ticks);
  const pct = (t: number) => `${(t / max) * 100}%`;
  const margin = record.ticks - run.ticks;
  return (
    <div
      className={styles.ladder}
      role="img"
      aria-label={`${record.label}, ${fmtInt(record.ticks)} ticks. ${run.label}, ${fmtInt(run.ticks)} ticks: ${fmtInt(margin)} fewer.`}
    >
      <div className={styles.label}>
        <span>{record.label}</span>
        <span className={styles.num}>{fmtInt(record.ticks)}</span>
      </div>
      <div className={styles.track}>
        <div className={styles.bar} style={{ width: pct(record.ticks) }} />
      </div>
      <div className={styles.label}>
        <span>{run.label}</span>
        <span className={styles.num}>{fmtInt(run.ticks)}</span>
      </div>
      <div className={styles.track}>
        <div className={styles.bar} style={{ width: pct(run.ticks) }} />
        {margin > 0 && <div className={styles.difference} style={{ left: pct(run.ticks), width: pct(margin) }} />}
      </div>
      {margin > 0 && <div className={styles.differenceLabel}>{fmtInt(margin)} ticks</div>}
    </div>
  );
}
