import { scaleLinear } from 'd3-scale';
import { fmtInt } from '../lib/numbers';
import { useWidth } from '../lib/useWidth';
import type { Route } from './model';
import styles from './Route.module.css';

const H = 200;
const M = { top: 16, right: 16, bottom: 28, left: 40 };

/**
 * How far the hiscore's clock ran ahead of the runner's own session clock, against the hiscore's
 * clock: flat while the account was in a runner session, rising through the short logins and the
 * ticks no log holds. A dot at each 99 the runner logged; the labelled dots are where it moves.
 */
export function DriftChart({ route }: { route: Route }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const w = Math.max(width, 280);
  const max = route.ledger.unassigned + route.ledger.logins;
  const x = scaleLinear().domain([0, route.finish]).range([M.left, w - M.right]);
  const y = scaleLinear().domain([0, max]).range([H - M.bottom, M.top]);
  const path = route.drift.map((p, i) => `${i ? 'L' : 'M'}${x(p.tick).toFixed(1)},${y(p.drift).toFixed(1)}`).join('');
  const levels = [...new Set(route.stampDrift.map((s) => s.drift))];
  /** The first 99 at each new distance: where the two clocks move apart. */
  const labelled = levels.slice(1).map((d) => route.stampDrift.find((s) => s.drift === d)!);
  /** The y axis names the floor and the top; the steps between are labelled at their dots. */
  const axis = [0, levels.at(-1)!];
  const xTicks = [0, 10_000, 20_000, 30_000];
  return (
    <figure className={styles.drift}>
      <figcaption className={styles.driftTitle}>Ticks the hiscore had counted beyond the runner’s sessions, at each point of the hiscore’s clock</figcaption>
      <div ref={ref}>
        <svg
          width={w}
          height={H}
          role="img"
          aria-label={`A step chart: level at first, then ${labelled.map((s) => `${fmtInt(s.drift)} ahead by ${s.skill} 99`).join(', then ')}, to the finish.`}
        >
          {axis.map((d) => (
            <g key={d}>
              <line x1={M.left} x2={w - M.right} y1={y(d)} y2={y(d)} className={styles.driftGrid} />
              <text x={M.left - 6} y={y(d)} dy="0.32em" textAnchor="end" className={styles.driftAxis}>
                {fmtInt(d)}
              </text>
            </g>
          ))}
          {xTicks.map((t) => (
            <text key={t} x={x(t)} y={H - 8} textAnchor="middle" className={styles.driftAxis}>
              {fmtInt(t)}
            </text>
          ))}
          <path d={path} className={styles.driftLine} />
          {route.stampDrift.map((s) => (
            <circle key={s.skill} cx={x(s.tick)} cy={y(s.drift)} r={2.5} className={styles.driftDot} />
          ))}
          {labelled.map((s, i) => (
            <text
              key={s.skill}
              x={x(s.tick) - 6}
              y={y(s.drift) - 8 - 16 * (labelled.length - 1 - i)}
              textAnchor="end"
              className={styles.driftLabel}
            >
              {s.skill} 99: {fmtInt(s.drift)} ahead
            </text>
          ))}
        </svg>
      </div>
    </figure>
  );
}
