import { fmtInt } from '../lib/numbers';
import { STEP_SOURCE, stepAt, stepsIn, type Moment } from './moments';
import styles from './CodePane.module.css';

/**
 * What the runner was doing at the replay's tick: the moment's steps in plain words, the current
 * one marked, and the code it ran. It moves on as the replay crosses a step boundary.
 */
export function CodePane({ moment, sessionTick }: { moment: Moment; sessionTick: number }) {
  const steps = stepsIn(moment.from, moment.to);
  const current = stepAt(sessionTick);
  const code = current?.code;

  return (
    <aside className={styles.pane} aria-label="The code that ran">
      <h2 className={styles.title}>The code that ran</h2>
      <ol className={styles.steps}>
        {steps.map((s) => (
          <li key={s.id} className={s === current ? styles.current : styles.step} aria-current={s === current ? 'step' : undefined}>
            <span className={styles.stepId}>
              {s.id}
              <span className={styles.ticks}>
                {s.from === s.to ? `tick ${fmtInt(s.from)}` : `ticks ${fmtInt(s.from)}–${fmtInt(s.to)}`}
              </span>
            </span>
            <span>{s.plain}</span>
          </li>
        ))}
      </ol>
      {!current && <p className={styles.note}>Logging in: the runner's first step starts at tick 4.</p>}
      {current && !code && current.codeNote && <p className={styles.note}>{current.codeNote}</p>}
      {code && (
        <>
          <p className={styles.where}>
            {code.module}:{code.startLine} · {code.symbol}
          </p>
          <pre className={styles.code} tabIndex={0}>
            <code>
              {code.code.split('\n').map((line, i) => (
                <span key={i} className={styles.line}>
                  <span className={styles.lineNo}>{code.startLine + i}</span>
                  {line}
                </span>
              ))}
            </code>
          </pre>
          <p className={styles.note}>
            {STEP_SOURCE.repository}, commit {STEP_SOURCE.commit}. {STEP_SOURCE.note}
          </p>
        </>
      )}
    </aside>
  );
}
