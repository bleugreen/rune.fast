import { useMemo, useRef, type KeyboardEvent, type ReactElement } from 'react';
import { scaleUtc } from 'd3-scale';
import { utcDay, utcHour } from 'd3-time';
import { useWidth } from '../lib/useWidth';
import { fmtDuration, fmtPacificHm, fmtUtcDayLong, fmtUtcDayShort, fmtUtcHm, pacificZone } from '../lib/time';
import { fmtInt } from '../lib/numbers';
import type { AttemptModel, ChartAnchors, ChartModel, Mark } from './model';
import styles from './TimelineChart.module.css';

/* Layout constants, in CSS pixels. */
const MIN_WIDTH = 960;
const MARGIN = { top: 26, right: 84, left: 92 };
const ROW_PITCH = 38;
const AXIS_GAP = 30;
const AXIS_HEIGHT = 58;
const ONE_OFF_W = 1.5;
const AXIS_STEP_HOURS = 6;
/** Pulled-quote ticks closer than this share one numeral label. */
const QUOTE_LABEL_GAP = 12;

/** Short row labels where the attempt's own name will not fit the label column. */
const ROW_LABEL: Readonly<Record<string, string>> = { L2: 'Lab run 2' };

type Scale = (t: number) => number;

function Glyph({ m, x, y, anchors }: { m: Mark; x: number; y: number; anchors: ChartAnchors }) {
  if (anchors.quoteNumber.has(m.key)) return <line className={styles.quoteTick} x1={x} x2={x} y1={y - 5} y2={y - 12} />;
  if (m.key === anchors.finish?.key) return null; // the finish number is its glyph
  if (m.kind === 'death') return <circle className={styles.death} cx={x} cy={y} r={4.5} />;
  return <line className={styles.stop} x1={x} x2={x} y1={y - 5} y2={y + 5} />;
}

/** Numerals over the quote ticks, with ticks that nearly coincide labelled together ('3 4 5'). */
function QuoteNumerals({ marks, x, y }: { marks: Mark[]; x: Scale; y: (m: Mark) => number }) {
  const groups: { xs: number[]; ns: number[]; y: number }[] = [];
  marks.forEach((m, i) => {
    const px = x(m.t);
    const last = groups.at(-1);
    if (last && px - last.xs.at(-1)! < QUOTE_LABEL_GAP && last.y === y(m)) {
      last.xs.push(px);
      last.ns.push(i + 1);
    } else groups.push({ xs: [px], ns: [i + 1], y: y(m) });
  });
  return (
    <>
      {groups.map((g) => (
        <text key={g.ns[0]} className={styles.tickNum} x={(g.xs[0]! + g.xs.at(-1)!) / 2} y={g.y - 15} textAnchor="middle">
          {g.ns.join(' ')}
        </text>
      ))}
    </>
  );
}

function AttemptLine({ am, x, y, anchors }: { am: AttemptModel; x: Scale; y: number; anchors: ChartAnchors }) {
  const [l0, l1] = am.line;
  const marks = am.marks
    .filter((m) => anchors.keys.has(m.key))
    .sort((a, b) => Number(a.kind === 'death') - Number(b.kind === 'death'));
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
        <Glyph key={m.key} m={m} x={x(m.t)} y={y} anchors={anchors} />
      ))}
    </g>
  );
}

interface Props {
  model: ChartModel;
  anchors: ChartAnchors;
  finishTicks: number;
  /** The mark the reading pane shows: the previewed one while hovering, else the pinned one. */
  shown: Mark | null;
  onPreview: (m: Mark | null) => void;
  onSelect: (m: Mark) => void;
}

export function TimelineChart({ model, anchors, finishTicks, shown, onPreview, onSelect }: Props) {
  const [measureRef, measured] = useWidth<HTMLDivElement>();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const width = Math.max(measured, MIN_WIDTH);
  const rowY = (i: number) => MARGIN.top + i * ROW_PITCH;
  const axisY = rowY(model.rows.length - 1) + AXIS_GAP;
  const height = axisY + AXIS_HEIGHT;

  const scale = useMemo(
    () => scaleUtc().domain(model.domain).range([MARGIN.left, width - MARGIN.right]),
    [model.domain, width],
  );
  const x: Scale = (t) => scale(t);

  /** The anchors of each row, in time order: what the pointer and the arrow keys move between. */
  const rowAnchors = useMemo(
    () => model.rows.map((row) => row.flatMap((am) => am.marks.filter((m) => anchors.keys.has(m.key))).sort((a, b) => a.t - b.t)),
    [model.rows, anchors],
  );
  const rowOf = useMemo(() => {
    const m = new Map<string, number>();
    model.rows.forEach((row, i) => row.forEach((am) => am.marks.forEach((mk) => m.set(mk.key, i))));
    return m;
  }, [model.rows]);

  const ticks = scale.ticks(utcHour.every(AXIS_STEP_HOURS) ?? utcHour).map((d) => +d);
  const [d0, d1] = model.domain;
  const midnights = utcDay.range(new Date(d0), new Date(d1), 1).map((d) => +d).filter((t) => t > d0);
  const dayBands = [d0, ...midnights].map((from, i, all) => ({ from, to: all[i + 1] ?? d1 }));
  const lastRow = model.rows.findIndex((r) => r.includes(model.last));

  /** The anchor nearest the pointer in the row under it, however far along the row. */
  const locate = (e: { clientX: number; clientY: number }): Mark | null => {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r) return null;
    const px = e.clientX - r.left;
    const py = e.clientY - r.top;
    const ri = Math.round((py - MARGIN.top) / ROW_PITCH);
    const list = rowAnchors[ri];
    if (!list?.length || Math.abs(py - rowY(ri)) > ROW_PITCH / 2) return null;
    return list.reduce((a, b) => (Math.abs(x(b.t) - px) < Math.abs(x(a.t) - px) ? b : a));
  };

  const reveal = (m: Mark) => {
    const el = scrollRef.current;
    if (!el) return;
    const px = x(m.t);
    if (px < el.scrollLeft + 40 || px > el.scrollLeft + el.clientWidth - 40) el.scrollLeft = px - el.clientWidth / 2;
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const all = anchors.list;
    const cur = shown ?? all[0];
    if (!cur) return;
    const i = all.findIndex((m) => m.key === cur.key);
    let next: Mark | undefined;
    switch (e.key) {
      case 'ArrowRight':
        next = all[i + 1];
        break;
      case 'ArrowLeft':
        next = all[i - 1];
        break;
      case 'Home':
        next = all[0];
        break;
      case 'End':
        next = all.at(-1);
        break;
      case 'ArrowDown':
      case 'ArrowUp': {
        const ri = rowOf.get(cur.key) ?? 0;
        const other = rowAnchors[ri + (e.key === 'ArrowDown' ? 1 : -1)];
        next = other?.reduce((a, b) => (Math.abs(b.t - cur.t) < Math.abs(a.t - cur.t) ? b : a));
        break;
      }
      default:
        return;
    }
    e.preventDefault();
    if (next) {
      onPreview(null);
      onSelect(next);
      reveal(next);
    }
  };

  const ring = shown
    ? { cx: x(shown.t), cy: rowY(rowOf.get(shown.key) ?? 0) - (anchors.quoteNumber.has(shown.key) ? 9 : 0) }
    : null;
  const finishX = width - MARGIN.right + 10;

  return (
    <div ref={measureRef} className={styles.root}>
      <div
        ref={scrollRef}
        className={styles.scroller}
        tabIndex={0}
        role="group"
        aria-label="Attempts timeline. Arrow keys move between the marked events; the reading pane below shows the selected one."
        onKeyDown={onKeyDown}
      >
        <svg
          ref={svgRef}
          className={styles.svg}
          width={width}
          height={height}
          onPointerMove={(e) => onPreview(locate(e))}
          onPointerLeave={() => onPreview(null)}
          onClick={(e) => {
            const hit = locate(e);
            if (hit) onSelect(hit);
          }}
          aria-hidden="true"
        >
          {midnights.map((t) => (
            <line key={t} className={styles.midnight} x1={x(t)} x2={x(t)} y1={MARGIN.top - 18} y2={axisY} />
          ))}

          {/* Row bands: the whole row is the pointer target. */}
          {model.rows.map((_, ri) => (
            <rect key={ri} className={styles.band} x={MARGIN.left} y={rowY(ri) - ROW_PITCH / 2} width={width - MARGIN.left} height={ROW_PITCH} />
          ))}

          {ring && <line className={styles.guide} x1={ring.cx} x2={ring.cx} y1={ring.cy + 7} y2={axisY} />}

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
                <AttemptLine key={am.attempt.id} am={am} x={x} y={rowY(ri)} anchors={anchors} />
              ))}
            </g>
          ))}

          <QuoteNumerals marks={anchors.quotes} x={x} y={(m) => rowY(rowOf.get(m.key) ?? 0)} />

          <text className={styles.finish} x={finishX} y={rowY(lastRow) + 8}>
            {fmtInt(finishTicks)}
          </text>
          <text className={styles.finishUnit} x={finishX + 1} y={rowY(lastRow) + 21}>
            ticks
          </text>

          {ring && <circle className={styles.ring} cx={ring.cx} cy={ring.cy} r={7.5} />}

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

      <ol className={styles.quotes}>
        {anchors.quotes.map((m, i) => (
          <li key={m.key}>
            <button
              type="button"
              className={styles.quote}
              data-selected={shown?.key === m.key || undefined}
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
