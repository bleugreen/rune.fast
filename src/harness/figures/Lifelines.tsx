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

/**
 * One lifeline per thread, with the operator's messages to it above the line and the issues filed
 * under it below, per six hours; the last row is the issues coordinator agents filed.
 */
export function Lifelines({ m, label }: { m: HarnessModel; label: string }) {
  const [ref, width] = useChartWidth();
  const L = m.lifelines;
  const narrow = width < NARROW;
  const left = narrow ? 0 : 104;
  const row = narrow ? 62 : 48;
  const x = scaleLinear().domain([L.from, L.to]).range([left, width]);
  const bw = x(L.from + BIN) - x(L.from);
  const k = BAR / L.peak;
  const height = TOP + L.rows.length * row + 4;
  const yOf = (i: number) => TOP + i * row + (narrow ? 34 : 26);
  const main = L.rows.findIndex((r) => r.name === 'main');
  const marks = [
    { key: 'rs3', t: L.marks.rs3, text: 'rs/3' },
    { key: 'rs843', t: L.marks.rs843, text: 'rs/843' },
  ];

  return (
    <div ref={ref} className={styles.root}>
      <svg className={styles.svg} width={width} height={height} role="img" aria-label={label}>
        {[L.from, ...L.midnights].map((t, j) => (
          <g key={t}>
            {j > 0 && <line className={styles.hair} x1={x(t)} x2={x(t)} y1={TOP - 8} y2={height} />}
            <text className={styles.tick} x={x(t) + 3} y={TOP - 12}>
              {fmtPacificWeekdayDay(t)}
            </text>
          </g>
        ))}
        {L.rows.map((r, i) => {
          const y = yOf(i);
          const coordinators = r.operator === null;
          return (
            <g key={r.name}>
              <line className={coordinators ? styles.dashed : styles.inkLine} x1={left} x2={width} y1={y} y2={y} />
              {r.operator?.map((v, b) =>
                v ? <rect key={b} className={styles.ink} x={x(L.from) + b * bw + 1} width={bw - 2} y={y - v * k - 0.5} height={v * k} /> : null,
              )}
              {r.filed.map((v, b) =>
                v ? <rect key={b} className={styles.faint} x={x(L.from) + b * bw + 1} width={bw - 2} y={y + 0.5} height={v * k} /> : null,
              )}
              <text className={styles.row} x={0} y={narrow ? y - BAR - 9 : y - 2}>
                {r.name}
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
        {marks.map((mk) => (
          <g key={mk.key}>
            <circle className={styles.accent} cx={x(mk.t)} cy={yOf(main)} r={3} />
            <text className={styles.note} x={x(mk.t) + 5} y={yOf(main) - 6}>
              {mk.text}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
