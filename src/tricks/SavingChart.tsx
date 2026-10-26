import { scaleLinear } from 'd3-scale';
import { useWidth } from '../lib/useWidth';
import { fmtInt } from '../lib/numbers';
import { hi, lo, type Saving, type Value } from './model';
import styles from './SavingChart.module.css';

const ROW = 40;
const BAR_Y = 17;
const BAR_H = 10;
/** Room right of the longest bar for its number. */
const VALUE_ROOM = 96;
const MIN_WIDTH = 240;

const decimals = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const fmtFigure = (n: number) => (Math.abs(n) >= 100 ? fmtInt(Math.round(n)) : decimals.format(n));
export const fmtValue = (v: Value) => (typeof v === 'number' ? fmtFigure(v) : `${fmtFigure(v[0])}–${fmtFigure(v[1])}`);

/**
 * One before-and-after comparison: two hairline bars from a shared zero, each
 * number at its bar's end. A measured range draws its bar to the low run and a
 * hairline to the high one. Only the after number takes the accent.
 */
export function SavingChart({ saving: s }: { saving: Saving }) {
  const [ref, measured] = useWidth<HTMLDivElement>();
  const width = Math.max(measured, MIN_WIDTH);
  const x = scaleLinear()
    .domain([0, Math.max(hi(s.before), hi(s.after))])
    .range([0, width - VALUE_ROOM]);
  const rows = [
    { label: s.before_label, v: s.before, after: false },
    { label: s.after_label, v: s.after, after: true },
  ];
  const height = rows.length * ROW;
  const said = `${s.label}. ${s.before_label}: ${fmtValue(s.before)}. ${s.after_label}: ${fmtValue(s.after)}.`;

  return (
    <figure className={styles.chart}>
      <figcaption className={styles.title}>{s.label}</figcaption>
      <div ref={ref}>
        <svg className={styles.svg} width={width} height={height} role="img" aria-label={said}>
          <line className={styles.zero} x1={0.5} x2={0.5} y1={BAR_Y - 3} y2={height - 3} />
          {rows.map((r, i) => {
            const top = i * ROW;
            const y = top + BAR_Y;
            const end = x(hi(r.v));
            return (
              <g key={r.label}>
                <text className={styles.rowLabel} x={0} y={top + 11}>
                  {r.label}
                </text>
                <rect className={r.after ? styles.after : styles.before} x={0} y={y} width={x(lo(r.v))} height={BAR_H} />
                {typeof r.v !== 'number' && (
                  <>
                    <line className={styles.range} x1={x(lo(r.v))} x2={end} y1={y + BAR_H / 2} y2={y + BAR_H / 2} />
                    <line className={styles.range} x1={end} x2={end} y1={y + 1} y2={y + BAR_H - 1} />
                  </>
                )}
                <text className={r.after ? styles.afterValue : styles.value} x={end + 6} y={y + BAR_H - 0.5}>
                  {fmtValue(r.v)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <p className={styles.note}>{s.note}</p>
    </figure>
  );
}
