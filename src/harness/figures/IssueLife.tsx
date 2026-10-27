import { countWord } from '../../lib/numbers';
import { fmtDuration, fmtPacificHm, fmtPacificWeekday } from '../../lib/time';
import { axisAt, AXIS_GAP, type HarnessModel } from '../model';
import { NARROW, useChartWidth } from './frame';
import styles from './Figures.module.css';

const H = 258;
const LEFT = 46;
const RIGHT = 10;
const Y = { recipe: 26, source: 74, turn: 98, read: 122, run: 140, write: 158, pr: 182, axis: 222 };
const LANES = ['read', 'run', 'write'] as const;

/** A run of wakes' label: what woke those turns. */
function wakeLabel(source: string, count: number, narrow: boolean): string {
  if (source === 'tests') return narrow ? 'tests done' : `${countWord(count)} test runs finishing`;
  if (source === 'command') return narrow ? 'command' : 'a command finishing';
  return narrow ? source : `messages from ${source}, the coordinator`;
}

/**
 * rs/843 from filing to merge on a three-part broken axis: the 27 hours it was held, compressed;
 * the builder's hour, expanded, with its turns, verb calls and pull-request versions; and the
 * wait for merge, compressed. Above it, the recipe its execution ran. Each turn after the first
 * carries a mark for the wake that began it, and the marks are labelled by what sent them.
 */
export function IssueLife({ m, label }: { m: HarnessModel; label: string }) {
  const [ref, width] = useChartWidth();
  const i = m.issue;
  const narrow = width < NARROW;
  const x0 = LEFT;
  const x1 = width - RIGHT;
  const X = (f: number) => x0 + f * (x1 - x0);
  const at = (t: number) => X(axisAt(i.segments, t));

  const recipeGap = narrow ? 64 : 104;
  // On a phone the last node sits in from the edge, so its centred label (“pull request”) fits.
  const recipeX = (k: number) => (narrow ? x1 - 2 * recipeGap - 28 : (x0 + x1) / 2 + 40) + k * recipeGap;
  const seg = Object.fromEntries(i.segments.map((s) => [s.key, s]));
  const held = seg.held!;
  const work = seg.work!;
  const wait = seg.wait!;
  const axisLabels: { x: number; text: string; anchor: 'start' | 'middle' | 'end'; y?: number }[] = [
    { x: X(held.offset), text: `${fmtPacificWeekday(i.filed).slice(0, 3)} ${fmtPacificHm(i.filed)}`, anchor: 'start' },
    // The held span is named above its own stretch of axis, clear of the clock times below it.
    { x: X(held.offset + held.share / 2), text: `held ${fmtDuration(i.heldMs)}`, anchor: 'middle', y: Y.axis - 6 },
    { x: X(work.offset), text: `${fmtPacificWeekday(i.start).slice(0, 3)} ${fmtPacificHm(i.start)}`, anchor: 'start' },
    { x: at(i.prOpened), text: fmtPacificHm(i.prOpened), anchor: 'middle' },
    { x: at(i.end), text: fmtPacificHm(i.end), anchor: 'middle' },
    { x: X(wait.offset + wait.share), text: fmtPacificHm(i.merged), anchor: 'end' },
  ];
  const breaks = [held.offset + held.share + AXIS_GAP / 2, work.offset + work.share + AXIS_GAP / 2].map(X);
  // Wake labels sit on one line above the turns. The first run's label ends at a mark of its own,
  // into the room over the long first turn, and the others start at their first mark. On a phone the
  // runs are too close for it to end at its last mark: the two labels would read as one phrase.
  const bracketY = Y.source + 6;
  const markTop = Y.turn - 12;

  return (
    <div ref={ref} className={styles.root}>
      <svg className={styles.svg} width={width} height={H} role="img" aria-label={label}>
        {/* The recipe the execution ran */}
        <text className={styles.lane} x={0} y={Y.recipe + 3}>
          recipe
        </text>
        <line className={styles.inkLine} x1={recipeX(0)} x2={recipeX(i.recipe.length - 1)} y1={Y.recipe} y2={Y.recipe} />
        {i.recipe.map((n, k) => (
          <g key={n.name}>
            <circle className={styles.hollow} cx={recipeX(k)} cy={Y.recipe} r={6.5} />
            <text className={styles.lane} x={recipeX(k)} y={Y.recipe + 22} textAnchor="middle">
              {n.type === 'pr' ? 'pull request' : n.name.toLowerCase()}
            </text>
          </g>
        ))}

        {/* Lanes */}
        <text className={styles.lane} x={0} y={Y.source + 3}>
          woken by
        </text>
        <text className={styles.lane} x={0} y={Y.turn + 3}>
          turns
        </text>
        {LANES.map((v) => (
          <g key={v}>
            <line className={styles.hair} x1={X(work.offset)} x2={X(work.offset + work.share)} y1={Y[v]} y2={Y[v]} />
            <text className={styles.lane} x={0} y={Y[v] + 3}>
              {v}
            </text>
          </g>
        ))}
        <text className={styles.lane} x={0} y={Y.pr + 3}>
          PR
        </text>

        {/* Held: the evidence comments left on the issue while it waited */}
        {i.heldComments.map((t, k) => (
          <line key={k} className={styles.inkLine} x1={at(t)} x2={at(t)} y1={Y.read} y2={Y.write} opacity={0.6} />
        ))}
        <text className={styles.tick} x={X(held.offset)} y={Y.pr + 3}>
          {narrow ? `${countWord(i.heldComments.length)} comments` : `${countWord(i.heldComments.length)} evidence comments while held`}
        </text>

        {/* The builder's hour */}
        {i.turns.map((tn) => (
          <rect key={tn.n} className={styles.ink} x={at(tn.start)} y={Y.turn - 3} width={Math.max(2, at(tn.end) - at(tn.start))} height={6} />
        ))}
        {i.calls.map((c, k) => (
          <line key={k} className={styles.inkLine} x1={at(c.t)} x2={at(c.t)} y1={Y[c.verb] - 5} y2={Y[c.verb] + 5} />
        ))}
        {i.versions.map((t, k) => (
          <circle key={k} className={styles.ink} cx={at(t)} cy={Y.pr} r={2.4} />
        ))}
        <text className={styles.tick} x={at(i.versions[0]!)} y={Y.pr + 16} textAnchor="middle">
          {`v1 opens PR #${i.pr}`}
        </text>
        <line className={styles.accentLine} x1={at(i.review)} x2={at(i.review)} y1={Y.pr - 8} y2={Y.pr + 8} />
        {!narrow && (
          <text className={styles.note} x={at(i.review) + 4} y={Y.pr - 6}>
            review approved
          </text>
        )}
        <circle className={styles.ink} cx={X(1) - 4} cy={Y.pr} r={3.5} />
        <text className={styles.tick} x={X(1)} y={Y.pr + 16} textAnchor="end">
          merged
        </text>

        {/* Wakes: what began each turn after the first, a mark on the turn and a label above */}
        {i.turns.map((tn) =>
          tn.wake ? (
            <g key={tn.n}>
              {tn.wake.kind !== 'message' && (
                <rect className={styles.accent} x={at(tn.start) - 2.75} y={Y.turn - 9.5} width={5.5} height={5.5} />
              )}
              {tn.wake.kind !== 'batch' && (
                <circle className={styles.accent} cx={at(tn.start) + (tn.wake.kind === 'both' ? 6 : 0)} cy={Y.turn - 7} r={2.9} />
              )}
            </g>
          ) : null,
        )}
        {i.wakeRuns.map((w, k) => {
          const xs = w.turns.map((tn) => at(tn.start));
          const first = xs[0]!;
          const last = xs.at(-1)!;
          return (
            <g key={k}>
              <line className={styles.hair} x1={first} x2={last} y1={bracketY} y2={bracketY} />
              {xs.map((x) => (
                <line key={x} className={styles.hair} x1={x} x2={x} y1={bracketY} y2={markTop} />
              ))}
              <text
                className={styles.tick}
                x={k === 0 ? (narrow ? first : last) + 2 : first - 2}
                y={Y.source + 2}
                textAnchor={k === 0 ? 'end' : 'start'}
              >
                {wakeLabel(w.source, w.turns.length, narrow)}
              </text>
            </g>
          );
        })}

        {/* The axis, broken twice */}
        {i.segments.map((s) => (
          <line key={s.key} className={styles.baseline} x1={X(s.offset)} x2={X(s.offset + s.share)} y1={Y.axis} y2={Y.axis} />
        ))}
        {breaks.map((bx) => (
          <path key={bx} className={styles.baseline} d={`M${bx - 4},${Y.axis + 4}l4,-8M${bx},${Y.axis + 4}l4,-8`} />
        ))}
        {axisLabels.map((l) => (
          <text key={l.text} className={styles.tick} x={l.x} y={l.y ?? Y.axis + 15} textAnchor={l.anchor}>
            {l.text}
          </text>
        ))}
      </svg>
      <p className={styles.key}>
        <span>
          <svg width={8} height={8} aria-hidden="true">
            <rect className={styles.accent} x={1} y={1} width={6} height={6} />
          </svg>
          woken when a command it left running finished
        </span>
        <span>
          <svg width={8} height={8} aria-hidden="true">
            <circle className={styles.accent} cx={4} cy={4} r={3} />
          </svg>
          woken by a message from {i.reviewer}
        </span>
      </p>
    </div>
  );
}
