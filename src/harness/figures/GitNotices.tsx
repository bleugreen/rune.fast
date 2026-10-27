import { scaleBand, scaleLinear } from 'd3-scale';
import { fmtInt } from '../../lib/numbers';
import { fmtPacificWeekdayDay } from '../../lib/time';
import type { HarnessModel } from '../model';
import { useChartWidth } from './frame';
import styles from './Figures.module.css';

const H = 220;
const TOP = 26;
const BOTTOM = 24;
const BAR_MAX = 22;

/** Per Pacific day, the harness's branch notices it resolved itself (light) and the ones an agent had to act on (ink). */
export function GitNotices({ m, label }: { m: HarnessModel; label: string }) {
  const [ref, width] = useChartWidth();
  const g = m.git;
  const base = H - BOTTOM;
  const x = scaleBand<string>().domain(g.days.map((d) => d.key)).range([0, width]).paddingInner(0.3).paddingOuter(0.05);
  const y = scaleLinear().domain([0, Math.max(...g.days.flatMap((d) => [d.auto, d.blocking]))]).range([base, TOP]);
  const bw = Math.min(BAR_MAX, (x.bandwidth() - 3) / 2);
  return (
    <div ref={ref} className={styles.root}>
      <svg className={styles.svg} width={width} height={H} role="img" aria-label={label}>
        {g.days.map((d) => {
          const cx = x(d.key)! + x.bandwidth() / 2;
          const bars = [
            { k: 'auto', v: d.auto, cls: styles.faint, x: cx - bw - 1.5 },
            { k: 'blocking', v: d.blocking, cls: styles.ink, x: cx + 1.5 },
          ];
          return (
            <g key={d.key}>
              {bars.map((b) => (
                <g key={b.k}>
                  <rect className={b.cls} x={b.x} width={bw} y={y(b.v)} height={base - y(b.v)} />
                  <text className={styles.tick} x={b.x + bw / 2} y={y(b.v) - 4} textAnchor="middle">
                    {fmtInt(b.v)}
                  </text>
                </g>
              ))}
              <text className={styles.day} x={cx} y={base + 16} textAnchor="middle">
                {fmtPacificWeekdayDay(d.t)}
              </text>
            </g>
          );
        })}
        <line className={styles.baseline} x1={0} x2={width} y1={base} y2={base} />
      </svg>
    </div>
  );
}
