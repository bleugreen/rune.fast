import { useMemo, useRef, useState, type KeyboardEvent, type ReactElement } from 'react';
import { scaleUtc } from 'd3-scale';
import { utcDay, utcHour } from 'd3-time';
import { useWidth } from '../lib/useWidth';
import { fmtDuration, fmtPacificHm, fmtUtcDayLong, fmtUtcDayShort, fmtUtcHm, fmtUtcHms, pacificZone } from '../lib/time';
import { fmtInt } from '../lib/numbers';
import { findMark, type AttemptModel, type ChartModel, type Mark } from './model';
import { PULLED } from './pulled';
import { EventCard } from './EventCard';
import styles from './TimelineChart.module.css';

/* Layout constants, in CSS pixels. */
const MIN_WIDTH = 1120;
const MARGIN = { top: 44, right: 104, left: 20 };
const ROW_PITCH = 52;
const AXIS_GAP = 40;
const AXIS_HEIGHT = 60;
const HIT = 16;
const TOOLTIP_W = 340;
const ONE_OFF_W = 1.5;
const AXIS_STEP_HOURS = 6;

type Scale = (t: number) => number;

/** Vertical position of a mark's glyph relative to its row line. */
function glyphDy(m: Mark): number {
  if (m.kind === 'operator') return -12;
  if (m.kind === 'stop' || m.kind === 'death' || m.kind === 'recovery') return 0;
  return 9;
}

function Glyph({ m, x, y }: { m: Mark; x: number; y: number }) {
  switch (m.kind) {
    case 'stop':
      return m.inWorld === false ? (
        <line className={styles.stopOut} x1={x} x2={x} y1={y - 3.5} y2={y + 3.5} />
      ) : (
        <line className={styles.stop} x1={x} x2={x} y1={y - 6} y2={y + 6} />
      );
    case 'death':
      return <circle className={styles.death} cx={x} cy={y} r={4.5} />;
    case 'recovery':
      return <circle className={styles.recovery} cx={x} cy={y} r={3.2} />;
    case 'operator':
      return <line className={styles.operator} x1={x} x2={x} y1={y - 7} y2={y - 17} />;
    case 'ruling':
      return <line className={styles.ruling} x1={x} x2={x} y1={y + 5} y2={y + 12} />;
    default:
      return <circle className={styles.dot} cx={x} cy={y + 9} r={1.4} />;
  }
}

const GLYPH_ORDER: Record<Mark['kind'], number> = {
  note: 0, start: 0, logout: 0, result: 0, ruling: 1, operator: 1, stop: 2, recovery: 3, death: 4,
};

function AttemptLine({ am, x, y, first }: { am: AttemptModel; x: Scale; y: number; first: boolean }) {
  const [l0, l1] = am.line;
  const marks = [...am.marks].sort((a, b) => GLYPH_ORDER[a.kind] - GLYPH_ORDER[b.kind]);
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
        <text key={i} className={styles.hold} x={(x(g.from) + x(g.to)) / 2} y={y + 25} textAnchor="middle">
          {i === 0 ? `logged out ${fmtDuration(g.to - g.from)}` : fmtDuration(g.to - g.from)}
        </text>
      ))}
      <text
        className={styles.name}
        x={first ? x(l0) : x(am.end)}
        y={y - 24}
        textAnchor={first ? 'start' : 'end'}
      >
        {am.shortName}
      </text>
      {marks.map((m) => (
        <Glyph key={m.key} m={m} x={x(m.t)} y={y} />
      ))}
    </g>
  );
}

interface Props {
  model: ChartModel;
  finishTicks: number;
  selected: Mark | null;
  onSelect: (m: Mark) => void;
}

export function TimelineChart({ model, finishTicks, selected, onSelect }: Props) {
  const [measureRef, measured] = useWidth<HTMLDivElement>();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<{ mark: Mark; px: number; py: number } | null>(null);

  const width = Math.max(measured, MIN_WIDTH);
  const rowY = (i: number) => MARGIN.top + i * ROW_PITCH;
  const axisY = rowY(model.rows.length - 1) + AXIS_GAP;
  const height = axisY + AXIS_HEIGHT;

  const scale = useMemo(
    () => scaleUtc().domain(model.domain).range([MARGIN.left, width - MARGIN.right]),
    [model.domain, width],
  );
  const x: Scale = (t) => scale(t);

  const rowMarks = useMemo(
    () => model.rows.map((row) => row.flatMap((am) => am.marks).sort((a, b) => a.t - b.t)),
    [model.rows],
  );
  const rowOf = useMemo(() => {
    const m = new Map<string, number>();
    rowMarks.forEach((list, i) => list.forEach((mk) => m.set(mk.key, i)));
    return m;
  }, [rowMarks]);

  const quotes = useMemo(
    () =>
      PULLED.map((q) => ({
        ...q,
        mark: findMark(model, q.attempt, q.utc),
        row: model.rows.findIndex((r) => r.some((am) => am.attempt.id === q.attempt)),
      })),
    [model],
  );

  const ticks = scale.ticks(utcHour.every(AXIS_STEP_HOURS) ?? utcHour).map((d) => +d);
  const [d0, d1] = model.domain;
  const midnights = utcDay.range(new Date(d0), new Date(d1), 1).map((d) => +d).filter((t) => t > d0);
  const dayBands = [d0, ...midnights].map((from, i, all) => ({ from, to: all[i + 1] ?? d1 }));

  const last = model.last;
  const lastRow = model.rows.findIndex((r) => r.includes(last));

  const locate = (e: { clientX: number; clientY: number }) => {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r) return null;
    const px = e.clientX - r.left;
    const py = e.clientY - r.top;
    const ri = Math.round((py - MARGIN.top) / ROW_PITCH);
    const list = rowMarks[ri];
    if (!list || Math.abs(py - rowY(ri)) > ROW_PITCH / 2) return null;
    let best: Mark | null = null;
    let bestD = HIT;
    for (const m of list) {
      const d = Math.abs(x(m.t) - px);
      if (d < bestD) {
        bestD = d;
        best = m;
      }
    }
    return best ? { mark: best, px, py } : null;
  };

  const reveal = (m: Mark) => {
    const el = scrollRef.current;
    if (!el) return;
    const px = x(m.t);
    if (px < el.scrollLeft + 40 || px > el.scrollLeft + el.clientWidth - 40) {
      el.scrollLeft = px - el.clientWidth / 2;
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const cur = selected ?? rowMarks[0]?.[0];
    if (!cur) return;
    const ri = rowOf.get(cur.key) ?? 0;
    const list = rowMarks[ri] ?? [];
    const i = list.findIndex((m) => m.key === cur.key);
    let next: Mark | undefined;
    switch (e.key) {
      case 'ArrowRight':
        next = list[i + 1];
        break;
      case 'ArrowLeft':
        next = list[i - 1];
        break;
      case 'Home':
        next = list[0];
        break;
      case 'End':
        next = list.at(-1);
        break;
      case 'ArrowDown':
      case 'ArrowUp': {
        const other = rowMarks[ri + (e.key === 'ArrowDown' ? 1 : -1)];
        next = other?.reduce((a, b) => (Math.abs(b.t - cur.t) < Math.abs(a.t - cur.t) ? b : a));
        break;
      }
      default:
        return;
    }
    e.preventDefault();
    if (next) {
      onSelect(next);
      reveal(next);
    }
  };

  const ringAt = (m: Mark) => {
    const ri = rowOf.get(m.key) ?? 0;
    return { cx: x(m.t), cy: rowY(ri) + glyphDy(m), row: ri };
  };
  const sel = selected ? ringAt(selected) : null;
  const hov = hover && hover.mark.key !== selected?.key ? ringAt(hover.mark) : null;

  // The tooltip lives outside the scroller so it is never clipped; place it in the visible frame.
  const tooltipStyle = (() => {
    if (!hover) return undefined;
    const el = scrollRef.current;
    const scrollLeft = el?.scrollLeft ?? 0;
    const viewW = el?.clientWidth ?? width;
    const px = hover.px - scrollLeft;
    const left = px + 14 + TOOLTIP_W > viewW ? Math.max(0, px - 14 - TOOLTIP_W) : px + 14;
    const below = hover.py < height * 0.4;
    return { left, top: below ? hover.py + 14 : hover.py - 14, transform: below ? undefined : 'translateY(-100%)', width: TOOLTIP_W };
  })();

  return (
    <div ref={measureRef} className={styles.root}>
      <div
        ref={scrollRef}
        className={styles.scroller}
        tabIndex={0}
        role="group"
        aria-label="Attempts timeline. Arrow keys move between events; the reading pane below shows the selected one."
        onKeyDown={onKeyDown}
      >
        <div className={styles.inner} style={{ width, height }}>
          <svg
            ref={svgRef}
            className={styles.svg}
            width={width}
            height={height}
            onPointerMove={(e) => setHover(locate(e))}
            onPointerLeave={() => setHover(null)}
            onClick={(e) => {
              const hit = locate(e);
              if (hit) onSelect(hit.mark);
            }}
            style={{ cursor: hover ? 'pointer' : 'default' }}
            aria-hidden="true"
          >
            {midnights.map((t) => (
              <line key={t} className={styles.midnight} x1={x(t)} x2={x(t)} y1={MARGIN.top - 36} y2={axisY} />
            ))}

            {sel && <line className={styles.guide} x1={sel.cx} x2={sel.cx} y1={sel.cy + 7} y2={axisY} />}

            {quotes.map((q) => {
              const qx = x(q.mark.t);
              const ry = rowY(q.row);
              return <line key={q.utc} className={styles.leader} x1={qx} x2={qx} y1={ry - q.lift} y2={ry - 18} />;
            })}

            {model.rows.map((row, ri) => (
              <g key={ri}>
                {row.map((am, j) => (
                  <AttemptLine key={am.attempt.id} am={am} x={x} y={rowY(ri)} first={j === 0} />
                ))}
              </g>
            ))}

            <g>
              <text className={styles.finish} x={width - MARGIN.right + 12} y={rowY(lastRow) + 8}>
                {fmtInt(finishTicks)}
              </text>
              <text className={styles.finishUnit} x={width - MARGIN.right + 13} y={rowY(lastRow) + 22}>
                ticks at {fmtUtcHms(last.end)}
              </text>
            </g>

            {hov && <circle className={styles.ringHover} cx={hov.cx} cy={hov.cy} r={7.5} />}
            {sel && <circle className={styles.ring} cx={sel.cx} cy={sel.cy} r={7.5} />}

            <line className={styles.axis} x1={MARGIN.left} x2={width - MARGIN.right} y1={axisY} y2={axisY} />
            {ticks.map((t, i) => (
              <g key={t}>
                <line className={styles.axis} x1={x(t)} x2={x(t)} y1={axisY} y2={axisY + 4} />
                <text className={styles.tickUtc} x={x(t)} y={axisY + 16} textAnchor="middle">
                  {fmtUtcHm(t)}
                  {i === 0 && ' UTC'}
                </text>
                <text className={styles.tickPacific} x={x(t)} y={axisY + 28} textAnchor="middle">
                  {fmtPacificHm(t)}
                  {i === 0 && ` ${pacificZone(t)}`}
                </text>
              </g>
            ))}
            {dayBands.map((b) => (
              <text key={b.from} className={styles.day} x={(x(b.from) + x(b.to)) / 2} y={axisY + 50} textAnchor="middle">
                {x(b.to) - x(b.from) > 220 ? fmtUtcDayLong(b.from) : fmtUtcDayShort(b.from)}
              </text>
            ))}
          </svg>

          {quotes.map((q) => {
            const qx = x(q.mark.t);
            const lines = q.mark.event.quote!.split(' / ');
            return (
              <button
                key={q.utc}
                type="button"
                tabIndex={-1}
                className={styles.quote}
                data-align={q.align}
                data-selected={selected?.key === q.mark.key || undefined}
                style={{
                  left: q.align === 'start' ? qx + 6 : qx - 6,
                  top: rowY(q.row) - q.lift,
                  maxWidth: q.maxWidth,
                }}
                onClick={() => onSelect(q.mark)}
              >
                <span className={styles.quoteText}>
                  “
                  {lines.map((l, i) => (
                    <span key={i}>
                      {i > 0 && <br />}
                      {l}
                    </span>
                  ))}
                  ”
                </span>
                <span className={styles.quoteTime}>{fmtUtcHms(q.mark.t)} UTC</span>
              </button>
            );
          })}
        </div>
      </div>
      {hover && (
        <div className={styles.tooltip} style={tooltipStyle} role="presentation">
          <EventCard mark={hover.mark} attemptName={model.byId.get(hover.mark.attemptId)?.attempt.name ?? ''} compact />
        </div>
      )}
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
      {item('stop', <line className={styles.stop} x1={8} x2={8} y1={3} y2={15} />, 16)}
      {item('recovery', <circle className={styles.recovery} cx={8} cy={9} r={3.2} />, 16)}
      {item('death', <circle className={styles.death} cx={8} cy={9} r={4.5} />, 16)}
      {item('operator message', <line className={styles.operator} x1={8} x2={8} y1={2} y2={12} />, 16)}
      {item('ruling', <line className={styles.ruling} x1={8} x2={8} y1={5} y2={12} />, 16)}
      {item('note', <circle className={styles.dot} cx={8} cy={9} r={1.6} />, 16)}
      {item('rehearsal and lab run, start to end', <line className={styles.extent} x1={1} x2={21} y1={9} y2={9} />)}
    </div>
  );
}
