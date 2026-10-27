import { scaleLinear } from 'd3-scale';
import { fmtInt } from '../../lib/numbers';
import { fmtPacificWeekdayDay } from '../../lib/time';
import { BIN, type HarnessModel, type LifelineRow } from '../model';
import { NARROW, useChartWidth } from './frame';
import styles from './Figures.module.css';

const TOP = 26;

const sub = (r: LifelineRow) =>
  r.operator === null ? `filed ${fmtInt(r.filedTotal)}` : `${fmtInt(r.operatorTotal)} in, ${fmtInt(r.filedTotal)} filed`;
/** Tallest bar, in px, above or below a row's line. */
const BAR = 17;
/** Room a day's name needs. */
const DAY_LABEL = 44;

/**
 * One lifeline per thread up to the #1, with the operator's messages to it above the line and the
 * issues it filed below, per six hours; the last row is the issues coordinator agents filed.
 */
export function Lifelines({ m, label }: { m: HarnessModel; label: string }) {
  const [ref, width] = useChartWidth();
  const L = m.lifelines;
  const narrow = width < NARROW;
  const left = narrow ? 0 : 104;
  const row = narrow ? 62 : 48;
  const x = scaleLinear().domain([L.from, L.to]).range([left, width]);
  const bw = x(L.from + BIN) - x(L.from);
  const barX = (b: number) => x(L.from) + b * bw + 1;
  /** The last bin is cut short by the #1. */
  const barW = (b: number) => Math.max(0, Math.min(bw - 2, x(L.to) - barX(b) - 1));
  const k = BAR / L.peak;
  const yOf = (i: number) => TOP + i * row + (narrow ? 34 : 26);
  // Room below the last row for a mark's label.
  const height = yOf(L.rows.length - 1) + BAR + 16;

  return (
    <div ref={ref} className={styles.root}>
      <svg className={styles.svg} width={width} height={height} role="img" aria-label={label}>
        {L.midnights.map((t) => (
          <line key={t} className={styles.hair} x1={x(t)} x2={x(t)} y1={TOP - 8} y2={height} />
        ))}
        {/* The first day's name only where it has room before the first midnight. */}
        {[L.from, ...L.midnights]
          .filter((t, j) => j !== 0 || x(L.midnights[0]!) - x(t) > DAY_LABEL)
          .map((t) => (
            <text key={t} className={styles.tick} x={x(t) + 3} y={TOP - 12}>
              {fmtPacificWeekdayDay(t)}
            </text>
          ))}
        {L.rows.map((r, i) => {
          const y = yOf(i);
          const coordinators = r.operator === null;
          return (
            <g key={r.name}>
              <line className={coordinators ? styles.dashed : styles.inkLine} x1={left} x2={width} y1={y} y2={y} />
              {r.operator?.map((v, b) =>
                v ? <rect key={b} className={styles.ink} x={barX(b)} width={barW(b)} y={y - v * k - 0.5} height={v * k} /> : null,
              )}
              {r.filed.map((v, b) =>
                v ? <rect key={b} className={styles.faint} x={barX(b)} width={barW(b)} y={y + 0.5} height={v * k} /> : null,
              )}
              <text className={styles.row} x={0} y={narrow ? y - BAR - 9 : y - 2}>
                {coordinators ? r.name : <tspan className={styles.mono}>{r.name}</tspan>}
                {narrow && (
                  <tspan className={styles.rowSub} dx={8}>
                    {sub(r)}
                  </tspan>
                )}
              </text>
              {!narrow && (
                <text className={styles.rowSub} x={0} y={y + 11}>
                  {sub(r)}
                </text>
              )}
            </g>
          );
        })}
        {L.marks.map((mk) => (
          <g key={mk.key}>
            <circle className={styles.accent} cx={x(mk.t)} cy={yOf(mk.row)} r={3} />
            <line className={styles.accentLine} x1={x(mk.t)} x2={x(mk.t)} y1={yOf(mk.row) + 3} y2={yOf(mk.row) + BAR + 2} />
            <text className={styles.note} x={x(mk.t) + 3} y={yOf(mk.row) + BAR + 12}>
              {`rs/${mk.key.slice(2)}`}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
