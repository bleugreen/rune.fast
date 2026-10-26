import { fmtInt } from '../lib/numbers';
import styles from './TicksLadder.module.css';

export interface Rung {
  label: string;
  ticks: number;
}

const AXIS_STEP = 10_000;

/**
 * Final tick counts as bars from zero, against the record. The finish carries the
 * accent and its margin under the record; at this scale the margin is a sliver,
 * which is the point.
 */
export function TicksLadder({ record, finish }: { record: Rung; finish: Rung }) {
  const max = Math.max(record.ticks, finish.ticks);
  const pct = (t: number) => `${(t / max) * 100}%`;
  const margin = record.ticks - finish.ticks;
  const ticks = Array.from({ length: Math.floor(max / AXIS_STEP) + 1 }, (_, i) => i * AXIS_STEP);
  return (
    <div
      className={styles.ladder}
      role="img"
      aria-label={`${record.label}, ${fmtInt(record.ticks)} ticks. ${finish.label}, ${fmtInt(finish.ticks)} ticks, ${fmtInt(margin)} under.`}
    >
      <div className={styles.recordLine} aria-hidden="true" />
      <div className={styles.label}>
        <span>
          {record.label}, <span className={styles.num}>{fmtInt(record.ticks)}</span>
        </span>
      </div>
      <div className={styles.track}>
        <div className={`${styles.bar} ${styles.recordBar}`} style={{ width: pct(record.ticks) }} />
      </div>
      <div className={styles.label}>
        <span>
          {finish.label}, <span className={styles.accent}>{fmtInt(finish.ticks)}</span>
        </span>
        {margin > 0 && (
          <span className={styles.under}>
            <span className={styles.accent}>{fmtInt(margin)} ticks</span> under
          </span>
        )}
      </div>
      <div className={styles.track}>
        <div className={styles.bar} style={{ width: pct(finish.ticks) }} />
      </div>
      <div className={styles.axis}>
        {ticks.map((t) => (
          <span key={t} className={styles.tick} style={{ left: pct(t) }} data-first={t === 0 || undefined}>
            {fmtInt(t)}
          </span>
        ))}
      </div>
    </div>
  );
}
