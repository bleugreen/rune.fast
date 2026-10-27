import { scaleLinear } from 'd3-scale';
import { fmtPacificWeekdayDay, pacificMidnights } from '../../lib/time';
import type { HarnessModel } from '../model';
import { useChartWidth } from './frame';
import styles from './Figures.module.css';

const TOP = 22;
const ROW = 7.4;
const LEFT = 30;

/**
 * One row per tenet: a tick when a thread proposed it, a hairline to the operator's answer and a
 * mark for the outcome; curves join a superseded tenet to the one that replaced it.
 */
export function TenetLedger({ m, label }: { m: HarnessModel; label: string }) {
  const [ref, width] = useChartWidth();
  const T = m.tenets;
  const right = width - 6;
  const x = scaleLinear().domain([T.from, m.window.end]).range([LEFT + 4, right]);
  const y = (n: number) => TOP + (n - 1) * ROW;
  const height = y(T.total) + 30;
  const byN = new Map(T.rows.map((r) => [r.n, r]));
  const endOf = (n: number) => {
    const r = byN.get(n)!;
    return x(r.answered ?? r.created);
  };
  const labelled = (n: number) => n === 1 || n === T.research.n || n % 5 === 0;

  return (
    <div ref={ref} className={styles.root}>
      <svg className={styles.svg} width={width} height={height} role="img" aria-label={label}>
        {pacificMidnights(T.from, m.window.end).map((t) => (
          <g key={t}>
            <line className={styles.hair} x1={x(t)} x2={x(t)} y1={TOP - 10} y2={y(T.total) + 6} />
            <text className={styles.tick} x={x(t) + 3} y={TOP - 12}>
              {fmtPacificWeekdayDay(t)}
            </text>
          </g>
        ))}
        {T.arcs.map((a) => {
          const x0 = endOf(a.from) + 2;
          const y0 = y(a.from);
          const x1 = x(byN.get(a.to)!.created);
          const y1 = y(a.to);
          return <path key={`${a.from}-${a.to}`} className={styles.dashed} d={`M${x0},${y0} C${x0 + 24},${y0} ${x1 - 24},${y1} ${x1},${y1}`} />;
        })}
        {T.rows.map((r) => {
          const yy = y(r.n);
          const xc = x(r.created);
          const lit = r.n === T.research.n;
          const tone = lit ? styles.accent : styles.ink;
          const stroke = lit ? styles.accentLine : styles.inkLine;
          return (
            <g key={r.n}>
              {labelled(r.n) && (
                <text className={lit ? styles.note : styles.tick} x={LEFT - 4} y={yy + 3} textAnchor="end">
                  #{r.n}
                </text>
              )}
              <line className={stroke} x1={xc} x2={xc} y1={yy - 2.5} y2={yy + 2.5} />
              {r.answered !== null && (
                <>
                  <line className={stroke} x1={xc} x2={x(r.answered)} y1={yy} y2={yy} />
                  {r.status === 'declined' ? (
                    <path className={stroke} d={`M${x(r.answered) - 2.5},${yy - 2.5}l5,5m0,-5l-5,5`} />
                  ) : (
                    <circle className={tone} cx={x(r.answered) + 2} cy={yy} r={2.4} />
                  )}
                </>
              )}
              {r.status === 'withdrawn' && <circle className={styles.hollow} cx={xc + 3} cy={yy} r={2.4} />}
              {r.status === 'proposed' && (
                <>
                  <line className={styles.dashed} x1={xc} x2={right} y1={yy} y2={yy} />
                  <text className={styles.tick} x={right} y={yy - 3} textAnchor="end">
                    #{r.n} awaiting
                  </text>
                </>
              )}
            </g>
          );
        })}
        <text className={styles.note} x={x(T.research.created) + 8} y={y(T.research.n) + 3}>
          #{T.research.n}: research goes to child issues
        </text>
        <text className={styles.tick} x={right} y={height - 4} textAnchor="end">
          approved ●  declined ×  withdrawn ○  superseded: a curve to its successor
        </text>
      </svg>
    </div>
  );
}
