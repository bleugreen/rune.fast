import { fmtInt } from '../lib/numbers';
import type { Step } from './model';
import styles from './Route.module.css';

const pct = (x: number, of: number) => `${(100 * x) / of}%`;

/**
 * The step's price against what it took, as two hairline bars on one scale. The ticks taken are in
 * ink where a runner session holds them, mid-grey for short logins, and hatched where no log holds them.
 */
export function PlanBars({ step }: { step: Step }) {
  const max = Math.max(step.planned, step.took);
  const { session, login, unassigned } = step.composition;
  return (
    <div className={styles.plan} role="img" aria-label={`Planned ${fmtInt(step.planned)} ticks, took ${fmtInt(step.took)}`}>
      <span>Planned</span>
      <span className={styles.bar}>
        <i className={styles.planned} style={{ width: pct(step.planned, max) }} />
      </span>
      <span className={styles.figure}>{fmtInt(Math.round(step.planned))}</span>
      <span>Took</span>
      <span className={styles.bar}>
        <i className={styles.tookSession} style={{ width: pct(session, max) }} />
        {login !== 0 && <i className={styles.tookLogin} style={{ left: pct(session, max), width: pct(login, max) }} />}
        {unassigned !== 0 && <i className={styles.tookUnassigned} style={{ left: pct(session + login, max), width: pct(unassigned, max) }} />}
      </span>
      <span className={styles.figure}>{fmtInt(step.took)}</span>
    </div>
  );
}
