import { useId, useMemo, type ReactElement } from 'react';
import { scaleUtc } from 'd3-scale';
import { useWidth } from '../lib/useWidth';
import { HOUR, fmtDuration, fmtPacificDayLong, fmtPacificDayShort, fmtPacificHm, pacificHour, pacificMidnights } from '../lib/time';
import { fmtInt } from '../lib/numbers';
import { drawnMarks, type AttemptModel, type ChartModel } from './model';
import styles from './TimelineChart.module.css';

/* Layout constants, in CSS pixels. */
const MIN_WIDTH = 960;
/** A cropped chart spans hours, not days, and fits a narrower column. */
const CROPPED_MIN_WIDTH = 560;
const MARGIN = { top: 26, right: 100, left: 92 };
const ROW_PITCH = 38;
const AXIS_GAP = 30;
const AXIS_HEIGHT = 46;
const ONE_OFF_W = 1.5;

const axisStepHours = (span: number) => (span > 36 * HOUR ? 6 : span > 12 * HOUR ? 3 : 2);

/** Axis ticks on the Pacific clock: every hour in [d0, d1] whose Pacific hour is a multiple of the step. */
function pacificTicks(d0: number, d1: number, step: number): number[] {
  const out: number[] = [];
  for (let t = Math.ceil(d0 / HOUR) * HOUR; t <= d1; t += HOUR) if (pacificHour(t) % step === 0) out.push(t);
  return out;
}

/** Short row labels where the attempt's own name will not fit the label column. */
const ROW_LABEL: Readonly<Record<string, string>> = { L2: 'Lab run 2' };

type Scale = (t: number) => number;

function AttemptLine({ am, x, y }: { am: AttemptModel; x: Scale; y: number }) {
  const [l0, l1] = am.line;
  // Deaths last, so a death sits over a stop at the same instant.
  const marks = drawnMarks(am).sort((a, b) => Number(a.kind === 'death') - Number(b.kind === 'death'));
  return (
    <g className={am.scored ? undefined : styles.faint}>
      {am.spans ? (
        <>
          <line className={styles.offline} x1={x(l0)} x2={x(l1)} y1={y} y2={y} />
          {am.spans.map((s, i) => (
            <line
              key={i}
              className={styles.bar}
              x1={x(s.from)}
              x2={Math.max(x(s.to ?? s.from), x(s.from) + ONE_OFF_W)}
              y1={y}
              y2={y}
            />
          ))}
        </>
      ) : (
        <line className={styles.extent} x1={x(am.start)} x2={x(am.end)} y1={y} y2={y} />
      )}
      {am.holds.map((g, i) => (
        <text key={i} className={styles.hold} x={(x(g.from) + x(g.to)) / 2} y={y + 16} textAnchor="middle">
          {fmtDuration(g.to - g.from)}
        </text>
      ))}
      {marks.map((m) =>
        m.kind === 'death' ? (
          <circle key={m.key} className={styles.death} cx={x(m.t)} cy={y} r={4.5} />
        ) : (
          <line key={m.key} className={styles.stop} x1={x(m.t)} x2={x(m.t)} y1={y - 5} y2={y + 5} />
        ),
      )}
    </g>
  );
}

interface Props {
  model: ChartModel;
  finishTicks: number;
  /** Crops the time axis to these instants; rows with nothing inside them are left out. */
  crop?: readonly [number, number];
}

/** Every attempt's logged-in time on one wall-clock axis, with its in-world stops and deaths. */
export function TimelineChart({ model, finishTicks, crop }: Props) {
  const [measureRef, measured] = useWidth<HTMLDivElement>();
  const clipId = `plot${useId().replace(/:/g, '')}`;

  const [d0, d1] = crop ?? model.domain;
  const rows = useMemo(
    () => model.rows.filter((row) => row.some((am) => am.line[0] < d1 && am.line[1] > d0)),
    [model.rows, d0, d1],
  );

  const width = Math.max(measured, crop ? CROPPED_MIN_WIDTH : MIN_WIDTH);
  const rowY = (i: number) => MARGIN.top + i * ROW_PITCH;
  const axisY = rowY(rows.length - 1) + AXIS_GAP;
  const height = axisY + AXIS_HEIGHT;

  const scale = useMemo(() => scaleUtc().domain([d0, d1]).range([MARGIN.left, width - MARGIN.right]), [d0, d1, width]);
  const x: Scale = (t) => scale(t);

  const ticks = pacificTicks(d0, d1, axisStepHours(d1 - d0));
  const midnights = pacificMidnights(d0, d1).filter((t) => t > d0 && t < d1);
  const dayBands = [d0, ...midnights].map((from, i, all) => ({ from, to: all[i + 1] ?? d1 }));
  const lastRow = rows.findIndex((r) => r.includes(model.last));
  const showFinish = lastRow >= 0 && model.last.line[1] <= d1;
  const finishX = width - MARGIN.right + 10;

  return (
    <div ref={measureRef} className={styles.root}>
      <div className={styles.scroller}>
        <svg className={styles.svg} width={width} height={height} aria-hidden="true">
          {crop && (
            <defs>
              <clipPath id={clipId}>
                <rect x={MARGIN.left} y={0} width={width - MARGIN.left - MARGIN.right} height={height} />
              </clipPath>
            </defs>
          )}

          {midnights.map((t) => (
            <line key={t} className={styles.midnight} x1={x(t)} x2={x(t)} y1={MARGIN.top - 18} y2={axisY} />
          ))}

          {rows.map((row, ri) => (
            <g key={ri}>
              <text className={styles.rowLabel} x={MARGIN.left - 14} y={rowY(ri) + 4} textAnchor="end">
                {ROW_LABEL[row[0]!.attempt.id] ?? row[0]!.shortName}
              </text>
              <g clipPath={crop ? `url(#${clipId})` : undefined}>
                {row.slice(1).map((am) => (
                  <text key={am.attempt.id} className={styles.inlineLabel} x={x(am.end) + 6} y={rowY(ri) + 4}>
                    {(ROW_LABEL[am.attempt.id] ?? am.shortName).toLowerCase()}
                  </text>
                ))}
                {row.map((am) => (
                  <AttemptLine key={am.attempt.id} am={am} x={x} y={rowY(ri)} />
                ))}
              </g>
            </g>
          ))}

          {showFinish && (
            <>
              <text className={styles.finish} x={finishX} y={rowY(lastRow) + 8}>
                {fmtInt(finishTicks)}
              </text>
              <text className={styles.finishUnit} x={finishX + 1} y={rowY(lastRow) + 21}>
                ticks
              </text>
            </>
          )}

          <line className={styles.axis} x1={MARGIN.left} x2={width - MARGIN.right} y1={axisY} y2={axisY} />
          {ticks.map((t) => (
            <g key={t}>
              <line className={styles.axis} x1={x(t)} x2={x(t)} y1={axisY} y2={axisY + 4} />
              <text className={styles.tick} x={x(t)} y={axisY + 16} textAnchor="middle">
                {fmtPacificHm(t)}
              </text>
            </g>
          ))}
          {dayBands.map((b) => (
            <text key={b.from} className={styles.day} x={(x(b.from) + x(b.to)) / 2} y={axisY + 38} textAnchor="middle">
              {x(b.to) - x(b.from) > 220 ? fmtPacificDayLong(b.from) : fmtPacificDayShort(b.from)}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}

/** The chart's key, drawn with the chart's own glyphs. */
export function Legend() {
  const item = (label: string, glyph: ReactElement, w = 22) => (
    <span className={styles.legendItem}>
      <svg width={w} height={18} aria-hidden="true">
        {glyph}
      </svg>
      {label}
    </span>
  );
  return (
    <div className={styles.legend}>
      {item('logged in', <line className={styles.bar} x1={1} x2={21} y1={9} y2={9} />)}
      {item('logged out', <line className={styles.offline} x1={1} x2={21} y1={9} y2={9} />)}
      {item('stop', <line className={styles.stop} x1={8} x2={8} y1={4} y2={14} />, 16)}
      {item('death', <circle className={styles.death} cx={8} cy={9} r={4.5} />, 16)}
      {item('rehearsal and lab run', <line className={styles.extent} x1={1} x2={21} y1={9} y2={9} />)}
    </div>
  );
}
