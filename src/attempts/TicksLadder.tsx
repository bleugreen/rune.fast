import { scaleLinear } from 'd3-scale';
import { useWidth } from '../lib/useWidth';
import { fmtInt } from '../lib/numbers';
import type { LadderEntry, RecordFacts } from './model';
import styles from './TicksLadder.module.css';

/* Layout constants, in CSS pixels. */
const TOP = 34;
const ROW = 26;
const BAR = 6;
const INSET_GAP = 46;
const INSET_H = 74;
const INSET_TICKS = 4;

interface Props {
  entries: LadderEntry[];
  record: RecordFacts;
}

/**
 * Each scored attempt's tick count against the previous record, with a detail
 * strip that magnifies the finish: the margin is too small to see at full scale.
 */
export function TicksLadder({ entries, record }: Props) {
  const [ref, measured] = useWidth<HTMLDivElement>();
  const width = Math.max(measured, 320);
  const narrow = width < 560;
  const gutter = narrow ? 70 : 92;
  const right = narrow ? 58 : 150;
  const x = scaleLinear().domain([0, record.previous]).range([gutter, width - right]);
  const rowY = (i: number) => TOP + i * ROW;
  const lastY = rowY(entries.length - 1);
  const insetTop = lastY + INSET_GAP;
  const insetBarY = insetTop + 30;
  const height = insetTop + INSET_H;

  const { final, previous, margin } = record;
  const zoom = [final - 2 * margin, previous + margin] as const;
  const xi = scaleLinear().domain(zoom).range([gutter, width - right]);
  const marginSeconds = (margin * record.tickMs) / 1000;
  const finalIndex = entries.findIndex((e) => e.value === final);

  return (
    <div ref={ref} className={styles.root}>
      <svg width={width} height={height} className={styles.svg} role="img" aria-label={`Ticks per scored attempt against the previous record of ${fmtInt(previous)}`}>
        <line className={styles.record} x1={x(previous)} x2={x(previous)} y1={TOP - 16} y2={lastY + 12} />
        <text className={styles.recordLabel} x={x(previous) - 5} y={TOP - 20} textAnchor="end">
          Previous record, {fmtInt(previous)}
        </text>
        {entries.map((e, i) => {
          const y = rowY(i);
          const isFinal = i === finalIndex;
          const endX = x(e.value);
          const tailX = e.tail ? x(e.value + e.tail.ticks) : endX;
          const labelX = Math.max(tailX, isFinal ? x(previous) : 0) + 6;
          return (
            <g key={e.id}>
              <text className={styles.name} x={gutter - 10} y={y + 4} textAnchor="end">
                {e.name}
              </text>
              <rect className={e.estimate ? styles.barEstimate : styles.bar} x={gutter} y={y - BAR / 2} width={endX - gutter} height={BAR} />
              {e.tail && <line className={styles.tail} x1={endX} x2={tailX} y1={y} y2={y} />}
              <text className={isFinal ? styles.valueFinal : styles.value} x={labelX} y={y + 4}>
                {e.label}
                {e.tail && <tspan className={styles.tailLabel}> {e.tail.label}</tspan>}
              </text>
            </g>
          );
        })}

        {/* Zoom callout from the finish of the last row to the detail strip. */}
        <line className={styles.callout} x1={x(zoom[0])} x2={gutter} y1={rowY(finalIndex) + BAR} y2={insetTop} />
        <line className={styles.callout} x1={x(zoom[1])} x2={width - right} y1={rowY(finalIndex) + BAR} y2={insetTop} />
        <line className={styles.insetFrame} x1={gutter} x2={width - right} y1={insetTop} y2={insetTop} />

        <rect className={styles.bar} x={gutter} y={insetBarY - BAR / 2} width={xi(final) - gutter} height={BAR} />
        <line className={styles.record} x1={xi(previous)} x2={xi(previous)} y1={insetTop + 6} y2={insetBarY + 12} />
        <line className={styles.bracket} x1={xi(final)} x2={xi(previous)} y1={insetBarY - 12} y2={insetBarY - 12} />
        <line className={styles.bracket} x1={xi(final)} x2={xi(final)} y1={insetBarY - 15} y2={insetBarY - 9} />
        <line className={styles.bracket} x1={xi(previous)} x2={xi(previous)} y1={insetBarY - 15} y2={insetBarY - 9} />
        <text className={styles.marginLabel} x={(xi(final) + xi(previous)) / 2} y={insetBarY - 18} textAnchor="middle">
          {fmtInt(margin)} ticks, {marginSeconds} s
        </text>
        <text className={styles.valueFinal} x={xi(final) - 6} y={insetBarY + 20} textAnchor="end">
          {fmtInt(final)}
        </text>
        <text className={styles.value} x={xi(previous) + 6} y={insetBarY + 20}>
          {fmtInt(previous)}
        </text>
        <line className={styles.axis} x1={gutter} x2={width - right} y1={insetBarY + 30} y2={insetBarY + 30} />
        {xi.ticks(INSET_TICKS).map((t) => (
          <g key={t}>
            <line className={styles.axis} x1={xi(t)} x2={xi(t)} y1={insetBarY + 30} y2={insetBarY + 34} />
            <text className={styles.tick} x={xi(t)} y={insetBarY + 44} textAnchor="middle">
              {fmtInt(t)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
