import { scaleBand, scaleLinear, scalePoint, scaleUtc } from 'd3-scale';
import { max } from 'd3-array';
import { useWidth } from '../lib/useWidth';
import { fmtInt, fmtUsd } from '../lib/numbers';
import { fmtPacificHm, fmtPacificWeekdayDay, fmtUtcWeekdayDay, pacificMidnights, pacificZone } from '../lib/time';
import { STACKS, type CostModel, type DayCost } from './model';
import styles from './Charts.module.css';

/** Width before the first measurement (and in server rendering). */
const FALLBACK_WIDTH = 640;
/** Labels that would sit closer than this share one label. */
const LABEL_GAP = 14;
/** Narrowest day on the time axis that still carries its name. */
const MIN_DAY_LABEL = 44;

function useChartWidth() {
  const [ref, measured] = useWidth<HTMLDivElement>();
  return [ref, measured || FALLBACK_WIDTH] as const;
}

/* ------------------------------------------------------------------------- */
/* List value per day, stacked by role                                       */
/* ------------------------------------------------------------------------- */

const DAY_H = 250;
const DAY_TOP = 44;
const DAY_BOTTOM = 26;
const DAY_BAR_MAX = 64;

export function DayChart({ days, firstLead, label }: { days: readonly DayCost[]; firstLead: DayCost; label: string }) {
  const [ref, width] = useChartWidth();
  const base = DAY_H - DAY_BOTTOM;
  const x = scaleBand<string>().domain(days.map((d) => d.key)).range([0, width]).paddingInner(0.32).paddingOuter(0.04);
  const y = scaleLinear().domain([0, max(days, (d) => d.total) ?? 0]).range([base, DAY_TOP]);
  const bw = Math.min(x.bandwidth(), DAY_BAR_MAX);

  return (
    <div ref={ref} className={styles.root}>
      <svg className={styles.svg} width={width} height={DAY_H} role="img" aria-label={label}>
        {days.map((d) => {
          const x0 = x(d.key)! + (x.bandwidth() - bw) / 2;
          const cx = x0 + bw / 2;
          let below = 0;
          return (
            <g key={d.key}>
              {STACKS.map((s) => {
                const y0 = y(below);
                below += d.stacks[s];
                return <rect key={s} className={styles[s]} x={x0} width={bw} y={y(below)} height={Math.max(0, y0 - y(below))} />;
              })}
              <text className={styles.value} x={cx} y={y(d.total) - 6} textAnchor="middle">
                {fmtUsd(d.total)}
              </text>
              {d.key === firstLead.key && (
                <text className={styles.note} x={x0} y={y(d.total) - 22}>
                  managers ahead
                </text>
              )}
              <text className={styles.day} x={cx} y={base + 17} textAnchor="middle">
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

export function DayLegend() {
  const items: [string, string][] = [
    ['coord', 'managers'],
    ['work', 'workers'],
    ['thread', 'threads'],
    ['other', 'carry and document'],
  ];
  return (
    <span className={styles.legend}>
      {items.map(([k, label]) => (
        <span key={k} className={styles.legendItem}>
          <svg width={10} height={10} aria-hidden="true">
            <rect className={styles[k]} x={0.5} y={0.5} width={9} height={9} />
          </svg>
          {label}
        </span>
      ))}
    </span>
  );
}

/* ------------------------------------------------------------------------- */
/* Turn concurrency over the window, with the scored attempts beneath        */
/* ------------------------------------------------------------------------- */

const CONC_H = 270;
const CONC_M = { top: 30, right: 6, bottom: 26, left: 30 };

/** Numerals over bands that nearly coincide are drawn as one label ('1 2 3'). */
function groupLabels(items: { x: number; n: number }[]) {
  const groups: { xs: number[]; ns: number[] }[] = [];
  for (const it of items) {
    const last = groups.at(-1);
    if (last && it.x - last.xs.at(-1)! < LABEL_GAP) {
      last.xs.push(it.x);
      last.ns.push(it.n);
    } else groups.push({ xs: [it.x], ns: [it.n] });
  }
  return groups;
}

export function ConcurrencyChart({ model, label }: { model: CostModel; label: string }) {
  const [ref, width] = useChartWidth();
  const { points, from, to, peak } = model.concurrency;
  const base = CONC_H - CONC_M.bottom;
  const x = scaleUtc().domain([from, to]).range([CONC_M.left, width - CONC_M.right]);
  const y = scaleLinear().domain([0, peak.v]).nice().range([base, CONC_M.top]);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join('');

  const midnights = pacificMidnights(from, to);
  const dayBands = [from, ...midnights].map((a, i, all) => ({ a, b: all[i + 1] ?? to }));
  const bands = model.attempts.map((a) => ({ ...a, x0: x(a.from), x1: Math.max(x(a.to), x(a.from) + 1.5) }));
  const px = x(peak.t);
  const py = y(peak.v);
  const peakRight = px < width - 150;

  return (
    <div ref={ref} className={styles.root}>
      <svg className={styles.svg} width={width} height={CONC_H} role="img" aria-label={label}>
        {y.ticks(5).map((v) => (
          <g key={v}>
            <line className={v ? styles.grid : styles.baseline} x1={CONC_M.left} x2={width - CONC_M.right} y1={y(v)} y2={y(v)} />
            <text className={styles.tick} x={CONC_M.left - 6} y={y(v) + 3.5} textAnchor="end">
              {fmtInt(v)}
            </text>
          </g>
        ))}
        {bands.map((b) => (
          <rect key={b.n} className={styles.attempt} x={b.x0} width={b.x1 - b.x0} y={CONC_M.top} height={base - CONC_M.top} />
        ))}
        {groupLabels(bands.map((b) => ({ x: (b.x0 + b.x1) / 2, n: b.n }))).map((g) => (
          <text key={g.ns[0]} className={styles.attemptLabel} x={(g.xs[0]! + g.xs.at(-1)!) / 2} y={CONC_M.top - 8} textAnchor="middle">
            {g.ns.join(' ')}
          </text>
        ))}
        <path className={styles.line} d={path} />
        {midnights.map((t) => (
          <line key={t} className={styles.baseline} x1={x(t)} x2={x(t)} y1={base} y2={base + 5} />
        ))}
        {dayBands
          .filter((d) => x(d.b) - x(d.a) >= MIN_DAY_LABEL)
          .map((d) => (
            <text key={d.a} className={styles.day} x={(x(d.a) + x(d.b)) / 2} y={base + 17} textAnchor="middle">
              {fmtPacificWeekdayDay(d.a)}
            </text>
          ))}
        <circle className={styles.peakDot} cx={px} cy={py} r={3} />
        <text className={styles.peakValue} x={px + (peakRight ? 8 : -8)} y={py + 4} textAnchor={peakRight ? 'start' : 'end'}>
          {fmtInt(Math.round(peak.v))} turns
        </text>
        <text className={styles.peakWhen} x={px + (peakRight ? 8 : -8)} y={py + 18} textAnchor={peakRight ? 'start' : 'end'}>
          {fmtPacificWeekdayDay(peak.t)}, {fmtPacificHm(peak.t)} {pacificZone(peak.t)}
        </text>
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Spawns and merges per UTC day                                             */
/* ------------------------------------------------------------------------- */

const SWARM_H = 230;
const SWARM_M = { top: 28, right: 24, bottom: 26, left: 30 };

export function SwarmChart({ model, label }: { model: CostModel; label: string }) {
  const [ref, width] = useChartWidth();
  const { days, spawnPeak, mergePeak } = model.swarm;
  const base = SWARM_H - SWARM_M.bottom;
  const x = scalePoint<string>().domain(days.map((d) => d.key)).range([SWARM_M.left + 18, width - SWARM_M.right]);
  const y = scaleLinear().domain([0, max(days, (d) => d.spawns) ?? 0]).nice(4).range([base, SWARM_M.top]);
  const series = [
    { key: 'spawns', cls: styles.spawns, at: (d: (typeof days)[number]) => d.spawns, peak: spawnPeak, word: 'spawned', dy: -9 },
    { key: 'merges', cls: styles.merges, at: (d: (typeof days)[number]) => d.merges, peak: mergePeak, word: 'merged', dy: 16 },
  ] as const;

  return (
    <div ref={ref} className={styles.root}>
      <svg className={styles.svg} width={width} height={SWARM_H} role="img" aria-label={label}>
        {y.ticks(4).map((v) => (
          <g key={v}>
            <line className={v ? styles.grid : styles.baseline} x1={SWARM_M.left} x2={width - SWARM_M.right} y1={y(v)} y2={y(v)} />
            <text className={styles.tick} x={SWARM_M.left - 6} y={y(v) + 3.5} textAnchor="end">
              {fmtInt(v)}
            </text>
          </g>
        ))}
        {series.map((s) => (
          <g key={s.key}>
            <path className={s.cls} d={days.map((d, i) => `${i ? 'L' : 'M'}${x(d.key)!.toFixed(1)},${y(s.at(d)).toFixed(1)}`).join('')} />
            {days.map((d) => (
              <circle key={d.key} className={s.cls} cx={x(d.key)} cy={y(s.at(d))} r={2.25} />
            ))}
            <text className={styles.seriesLabel} x={x(s.peak.key)} y={y(s.at(s.peak)) + s.dy} textAnchor="middle">
              {fmtInt(s.at(s.peak))} {s.word}
            </text>
          </g>
        ))}
        {days.map((d) => (
          <text key={d.key} className={styles.day} x={x(d.key)} y={base + 17} textAnchor="middle">
            {fmtUtcWeekdayDay(d.t)}
          </text>
        ))}
      </svg>
    </div>
  );
}
