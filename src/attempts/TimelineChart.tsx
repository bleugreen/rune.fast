import { useMemo, useRef, useState, type KeyboardEvent, type ReactElement } from 'react';
import { scaleUtc } from 'd3-scale';
import { utcDay, utcHour } from 'd3-time';
import { useWidth } from '../lib/useWidth';
import { fmtDuration, fmtPacificHm, fmtUtcDayLong, fmtUtcDayShort, fmtUtcHm, pacificZone } from '../lib/time';
import { fmtInt } from '../lib/numbers';
import { findMark, type AttemptModel, type ChartModel, type Mark } from './model';
import { PULLED } from './pulled';
import { EventCard } from './EventCard';
import styles from './TimelineChart.module.css';

/* Layout constants, in CSS pixels. */
const MIN_WIDTH = 960;
const MARGIN = { top: 26, right: 84, left: 92 };
const ROW_PITCH = 38;
const AXIS_GAP = 30;
const AXIS_HEIGHT = 58;
const HIT = 14;
const TOOLTIP_W = 340;
const ONE_OFF_W = 1.5;
const AXIS_STEP_HOURS = 6;

/** Short row labels where the attempt's own name will not fit the label column. */
const ROW_LABEL: Readonly<Record<string, string>> = { L2: 'Lab run 2' };

type Scale = (t: number) => number;

/**
 * The chart draws three things: logged-in time, stops while the account was in
 * the world, and deaths, plus a numbered tick for each pulled quote. Every other
 * event stays reachable from the keyboard and the reading pane.
 */
function drawn(m: Mark, quoted: ReadonlyMap<string, number>): boolean {
  return m.kind === 'death' || (m.kind === 'stop' && m.inWorld !== false) || quoted.has(m.key);
}

function Glyph({ m, x, y, n }: { m: Mark; x: number; y: number; n?: number }) {
  if (n !== undefined) {
    return (
      <g>
        <line className={styles.quoteTick} x1={x} x2={x} y1={y - 5} y2={y - 12} />
        <text className={styles.tickNum} x={x} y={y - 15} textAnchor="middle">
          {n}
        </text>
      </g>
    );
  }
  if (m.kind === 'death') return <circle className={styles.death} cx={x} cy={y} r={4.5} />;
  return <line className={styles.stop} x1={x} x2={x} y1={y - 5} y2={y + 5} />;
}

function AttemptLine({ am, x, y, quoted }: { am: AttemptModel; x: Scale; y: number; quoted: ReadonlyMap<string, number> }) {
  const [l0, l1] = am.line;
  const marks = am.marks.filter((m) => drawn(m, quoted)).sort((a, b) => Number(a.kind === 'death') - Number(b.kind === 'death'));
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
      {marks.map((m) => (
        <Glyph key={m.key} m={m} x={x(m.t)} y={y} n={quoted.get(m.key)} />
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

  const quotes = useMemo(() => PULLED.map((q) => findMark(model, q.attempt, q.utc)), [model]);
  const quoted = useMemo(() => new Map(quotes.map((m, i) => [m.key, i + 1])), [quotes]);

  /** Every event per row, for the keyboard; the drawn ones, for the pointer. */
  const rowMarks = useMemo(
    () => model.rows.map((row) => row.flatMap((am) => am.marks).sort((a, b) => a.t - b.t)),
    [model.rows],
  );
  const rowTargets = useMemo(() => rowMarks.map((list) => list.filter((m) => drawn(m, quoted))), [rowMarks, quoted]);
  const rowOf = useMemo(() => {
    const m = new Map<string, number>();
    rowMarks.forEach((list, i) => list.forEach((mk) => m.set(mk.key, i)));
    return m;
  }, [rowMarks]);

  const ticks = scale.ticks(utcHour.every(AXIS_STEP_HOURS) ?? utcHour).map((d) => +d);
  const [d0, d1] = model.domain;
  const midnights = utcDay.range(new Date(d0), new Date(d1), 1).map((d) => +d).filter((t) => t > d0);
  const dayBands = [d0, ...midnights].map((from, i, all) => ({ from, to: all[i + 1] ?? d1 }));

  const lastRow = model.rows.findIndex((r) => r.includes(model.last));

  const locate = (e: { clientX: number; clientY: number }) => {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r) return null;
    const px = e.clientX - r.left;
    const py = e.clientY - r.top;
    const ri = Math.round((py - MARGIN.top) / ROW_PITCH);
    const list = rowTargets[ri];
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
    return { cx: x(m.t), cy: rowY(ri) - (quoted.has(m.key) ? 9 : 0) };
  };
  const sel = selected ? ringAt(selected) : null;
  const hov = hover && hover.mark.key !== selected?.key ? ringAt(hover.mark) : null;

  // The tooltip lives outside the scroller so it is never clipped; place it in the visible frame.
  const tooltipStyle = (() => {
    if (!hover) return undefined;
    const el = scrollRef.current;
    const px = hover.px - (el?.scrollLeft ?? 0);
    const viewW = el?.clientWidth ?? width;
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
            <line key={t} className={styles.midnight} x1={x(t)} x2={x(t)} y1={MARGIN.top - 18} y2={axisY} />
          ))}

          {sel && <line className={styles.guide} x1={sel.cx} x2={sel.cx} y1={sel.cy + 7} y2={axisY} />}

          {model.rows.map((row, ri) => (
            <g key={ri}>
              <text className={styles.rowLabel} x={MARGIN.left - 14} y={rowY(ri) + 4} textAnchor="end">
                {ROW_LABEL[row[0]!.attempt.id] ?? row[0]!.shortName}
              </text>
              {row.slice(1).map((am) => (
                <text key={am.attempt.id} className={styles.inlineLabel} x={x(am.end) + 6} y={rowY(ri) + 4}>
                  {(ROW_LABEL[am.attempt.id] ?? am.shortName).toLowerCase()}
                </text>
              ))}
              {row.map((am) => (
                <AttemptLine key={am.attempt.id} am={am} x={x} y={rowY(ri)} quoted={quoted} />
              ))}
            </g>
          ))}

          <text className={styles.finish} x={width - MARGIN.right + 10} y={rowY(lastRow) + 8}>
            {fmtInt(finishTicks)}
          </text>
          <text className={styles.finishUnit} x={width - MARGIN.right + 11} y={rowY(lastRow) + 21}>
            ticks
          </text>

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
      </div>

      {hover && (
        <div className={styles.tooltip} style={tooltipStyle} role="presentation">
          <EventCard mark={hover.mark} attemptName={model.byId.get(hover.mark.attemptId)?.attempt.name ?? ''} compact />
        </div>
      )}

      <ol className={styles.quotes}>
        {quotes.map((m, i) => (
          <li key={m.key}>
            <button
              type="button"
              className={styles.quote}
              data-selected={selected?.key === m.key || undefined}
              onClick={() => onSelect(m)}
            >
              <span className={styles.quoteNum}>{i + 1}</span>
              <span className={styles.quoteText}>
                {m.event.quote!.split(' / ').map((l, j) => (
                  <span key={j}>
                    {j > 0 && <br />}
                    {l}
                  </span>
                ))}
              </span>
              <span className={styles.quoteTime}>
                {fmtUtcDayShort(m.t)}, {fmtUtcHm(m.t)} UTC
              </span>
            </button>
          </li>
        ))}
      </ol>
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
