import { useId } from 'react';
import { fmtInt } from '../lib/numbers';
import type { Route, Step } from './model';
import { yIn, type Points } from './useReadingTick';
import styles from './Route.module.css';

/** The rule's x in the gutter's strip, and the strip's width, in px. */
const X = 10;
const W = 20;
/** How close two labels may sit before the lower one is pushed down, in px. */
const LABEL_GAP = 30;

interface Props {
  step: Step;
  route: Route;
  /** The section's reading map, once measured; nothing is drawn before. */
  points: Points | null;
  height: number;
}

/**
 * The step's stretch of the hiscore's clock, down the left of its prose: a rule where the account
 * was logged in, drawn hatched where the hiscore counted ticks no log holds, broken by two slashes
 * where it was logged out, and a mark at each 99 on the very y where the rail turns it to 99.
 */
export function Spine({ step, route, points, height }: Props) {
  const hatch = useId().replace(/:/g, '');
  if (!points || height <= 0) return <div className={styles.spine} aria-hidden="true" />;

  const runs: { y0: number; y1: number; hatched: boolean }[] = [];
  const holds: { y0: number; y1: number }[] = [];
  for (let i = 1; i < points.length; i++) {
    const [y0, t0] = points[i - 1]!;
    const [y1, t1] = points[i]!;
    if (y1 <= y0) continue;
    if (t1 === t0) {
      holds.push({ y0, y1 });
      continue;
    }
    for (const g of route.segments) {
      const a = Math.max(g.from, t0);
      const b = Math.min(g.to, t1);
      if (b <= a) continue;
      runs.push({ y0: y0 + ((a - t0) / (t1 - t0)) * (y1 - y0), y1: y0 + ((b - t0) / (t1 - t0)) * (y1 - y0), hatched: g.kind === 'unassigned' });
    }
  }

  const marks = step.nineties.flatMap((s) => {
    const y = yIn(points, s.tick);
    return y === undefined ? [] : [{ y, tick: s.tick, text: `${s.skill} 99` }];
  });
  const labels: { y: number; at: number; tick: number; text?: string }[] = [{ y: 0, at: 0, tick: step.start }, ...marks.map((m) => ({ ...m, at: m.y }))];
  for (let i = 1; i < labels.length; i++) labels[i]!.at = Math.max(labels[i]!.at, labels[i - 1]!.at + LABEL_GAP);

  return (
    <div className={styles.spine} aria-hidden="true">
      <svg className={styles.spineSvg} width={W} height={height} viewBox={`0 0 ${W} ${height}`}>
        <defs>
          <pattern id={hatch} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="4" className={styles.hatchLine} />
          </pattern>
        </defs>
        {runs.map((r, i) =>
          r.hatched ? (
            <rect key={i} x={X - 4} y={r.y0} width={8} height={r.y1 - r.y0} fill={`url(#${hatch})`} className={styles.hatched} />
          ) : (
            <line key={i} x1={X} x2={X} y1={r.y0} y2={r.y1} className={styles.rule} />
          ),
        )}
        {holds.map((h, i) => (
          <g key={i} className={styles.slashes}>
            <line x1={X - 6} x2={X + 6} y1={h.y0 + 5} y2={h.y0 + 1} />
            <line x1={X - 6} x2={X + 6} y1={h.y1 - 1} y2={h.y1 - 5} />
          </g>
        ))}
        <line x1={X - 7} x2={X + 1} y1={0.5} y2={0.5} className={styles.tickMark} />
        {marks.map((m) => (
          <line key={m.tick} x1={X - 9} x2={X + 1} y1={m.y} y2={m.y} className={styles.ninetyMark} />
        ))}
      </svg>
      {labels.map((l) => (
        <span key={`${l.tick}-${l.text ?? ''}`} className={l.text ? styles.ninety : styles.startLabel} style={{ top: l.at }}>
          <span className={styles.labelTick}>{fmtInt(l.tick)}</span>
          {l.text && <span className={styles.labelText}>{l.text}</span>}
        </span>
      ))}
    </div>
  );
}
