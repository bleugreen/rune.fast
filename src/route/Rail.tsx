import { useId, useState } from 'react';
import { fmtInt } from '../lib/numbers';
import { fmtDuration } from '../lib/time';
import type { Skill } from './log';
import type { Route } from './model';
import { useReadingTick } from './useReadingTick';
import styles from './Route.module.css';

interface RailState {
  tick: number;
  levels: Readonly<Record<Skill, number>>;
  step: Route['steps'][number];
  /** The 99 just reached (Route.justReached). */
  now: Skill | undefined;
}

function useRail(route: Route): RailState {
  const tick = useReadingTick();
  return { tick, levels: route.levelsAt(tick), step: route.stepAt(tick), now: route.justReached(tick) };
}

const skillClass = (s: RailState, skill: Skill) =>
  skill === s.now ? styles.skillNow : s.levels[skill] === 99 ? styles.skillDone : s.step.spec.trains.includes(skill) ? styles.skillLive : styles.skill;

/** The rail's content: the tick, the clock bar, the step, and the 19 skills in the order they reached 99. */
function RailBody({ route, state }: { route: Route; state: RailState }) {
  const { tick, levels, step } = state;
  const at = (t: number) => `${(100 * t) / route.record}%`;
  return (
    <>
      <p className={styles.railTick}>{fmtInt(tick)}</p>
      <p className={styles.railOf}>
        of {fmtInt(route.finish)} ticks · {fmtDuration(tick * route.tickMs)} logged in
      </p>
      <div className={styles.clockBar}>
        <i className={styles.clockFill} style={{ transform: `scaleX(${tick / route.record})` }} />
        {route.breaks.map((b) => (
          <span key={b.index} className={styles.clockBreak} style={{ left: at(b.tick) }} />
        ))}
        <span className={styles.clockFinish} style={{ left: at(route.finish) }} />
        <span className={styles.clockRecord} />
      </div>
      <p className={styles.clockCaption}>
        <span>{fmtInt(route.steps[0]!.start)}</span>
        <span>record {fmtInt(route.record)}</span>
      </p>
      <p className={styles.railStep}>
        <span>
          {step.stretch.numeral} · {step.stretch.title}
        </span>
        {step.spec.title}
      </p>
      <ol className={styles.skills}>
        {route.stamps.map(({ skill }) => (
          <li key={skill} className={skillClass(state, skill)}>
            <span>{skill}</span>
            <span className={styles.skillBar}>
              <i style={{ transform: `scaleX(${levels[skill] / 99})` }} />
            </span>
            <span className={styles.skillLevel}>{levels[skill]}</span>
          </li>
        ))}
      </ol>
    </>
  );
}

/** The rail, as the desktop's sticky column. No live region: it would read out every scroll. */
export function Rail({ route }: { route: Route }) {
  const state = useRail(route);
  return (
    <div className={styles.rail}>
      <RailBody route={route} state={state} />
    </div>
  );
}

/** The rail below 64rem: a sticky strip with the tick, the step and the 19 skills as columns; ▾ opens the whole rail. */
export function Strip({ route }: { route: Route }) {
  const state = useRail(route);
  const [open, setOpen] = useState(false);
  const panel = useId();
  return (
    <div className={styles.strip} aria-label="Where the run is">
      <div className={styles.stripTop}>
        <span className={styles.stripTick}>{fmtInt(state.tick)}</span>
        <button type="button" className={styles.stripStep} aria-expanded={open} aria-controls={panel} onClick={() => setOpen((o) => !o)}>
          <span className={styles.stripStepName}>{state.step.spec.title}</span> <span aria-hidden="true">{open ? '▴' : '▾'}</span>
        </button>
      </div>
      <ol className={styles.mini} aria-hidden="true">
        {route.stamps.map(({ skill }) => (
          <li key={skill} className={skillClass(state, skill)}>
            <i style={{ transform: `scaleY(${state.levels[skill] / 99})` }} />
          </li>
        ))}
      </ol>
      <div id={panel} className={styles.panel} hidden={!open}>
        <RailBody route={route} state={state} />
      </div>
    </div>
  );
}
