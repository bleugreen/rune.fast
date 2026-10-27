import { useEffect, useMemo, useRef, type PointerEvent } from 'react';
import { countWord } from '../../lib/numbers';
import { fmtDuration, fmtPacificHm, fmtPacificWeekday } from '../../lib/time';
import { axisAt, AXIS_GAP, type HarnessModel, type Phase } from '../model';
import { keysLabel, travelSpan, usePlayer } from '../player';
import { EASE_OUT, NARROW, TRAVEL_MS, useChartWidth } from './frame';
import styles from './Figures.module.css';

const H = 258;
const LEFT = 46;
const RIGHT = 10;
const Y = { recipe: 26, source: 74, turn: 98, read: 122, run: 140, write: 158, pr: 182, axis: 222 };
/** Playback length at full speed: long enough to read the status word at each phase. */
const DURATION = 11_000;
const LANES = ['read', 'run', 'write'] as const;

const PHASE_WORD = (p: Phase, pr: number) => ({ held: 'held', running: 'running', open: `PR #${pr} open`, merged: 'merged' })[p];
const PHASE_BUTTON = (p: Phase) => ({ held: 'held', running: 'running', open: 'PR open', merged: 'merged' })[p];

/**
 * rs/843 from filing to merge on a three-part broken axis: the 27 hours it was held, compressed;
 * the builder's hour, expanded, with its turns, verb calls and pull-request versions; and the
 * wait for merge, compressed. Above it, the recipe its execution ran, with the node that holds the
 * issue lit. Played, a playhead crosses it; each turn after the first begins with a wake, which
 * drops into the builder's lane from what sent it.
 */
export function IssueLife({ m, label }: { m: HarnessModel; label: string }) {
  const [ref, width] = useChartWidth();
  const i = m.issue;
  const narrow = width < NARROW;
  const x0 = LEFT;
  const x1 = width - RIGHT;
  const X = (f: number) => x0 + f * (x1 - x0);
  const at = (t: number) => X(axisAt(i.segments, t));
  const tl = useMemo(() => ({ duration: DURATION, marks: i.marks }), [i]);
  const head = useRef<HTMLDivElement>(null);
  const player = usePlayer(tl, (f) => {
    if (head.current) head.current.style.transform = `translateX(${X(f)}px)`;
  });
  const { state, reduced } = player;
  const f = state.t;
  const reached = (t: number) => axisAt(i.segments, t) <= f + 1e-9;
  const phase = i.phases.reduce((k, p, j) => (reached(p.at) ? j : k), 0);

  // A wake travels when the playhead crosses its turn's start in play or by the Step button.
  // The keyboard, a scrub or a jump snaps, and settles any wake still dropping.
  const wakeEls = useRef(new Map<number, SVGGElement>());
  useEffect(() => {
    const span = travelSpan(state, reduced);
    const markers = (n: number) => [...(wakeEls.current.get(n)?.querySelectorAll<SVGElement>('[data-from]') ?? [])];
    if (!span) {
      for (const tn of i.turns) for (const el of markers(tn.n)) el.getAnimations().forEach((a) => a.cancel());
      return;
    }
    for (const tn of i.turns) {
      const pos = axisAt(i.segments, tn.start);
      if (!tn.wake || pos <= span[0] || pos > span[1] + 1e-9) continue;
      for (const el of markers(tn.n)) {
        el.getAnimations().forEach((a) => a.cancel());
        el.animate([{ transform: `translateY(${Number(el.dataset.from)}px)`, opacity: 0.2 }, { transform: 'translateY(0)', opacity: 1 }], {
          duration: TRAVEL_MS,
          easing: EASE_OUT,
        });
      }
    }
    // Keyed on the rendered state alone: a reduced-motion change must not drop a wake again.
  }, [state, i]);

  const scrub = (e: PointerEvent<SVGSVGElement>) => {
    if (e.type === 'pointermove' && !e.currentTarget.hasPointerCapture(e.pointerId)) return;
    if (e.type === 'pointerdown') e.currentTarget.setPointerCapture(e.pointerId);
    const box = e.currentTarget.getBoundingClientRect();
    player.seek((e.clientX - box.left - x0) / (x1 - x0), 'scrub');
  };

  const recipeGap = narrow ? 64 : 104;
  const recipeX = (k: number) => (narrow ? x1 - 2 * recipeGap - 14 : (x0 + x1) / 2 + 40) + k * recipeGap;
  const seg = Object.fromEntries(i.segments.map((s) => [s.key, s]));
  const held = seg.held!;
  const work = seg.work!;
  const wait = seg.wait!;
  const workX = (t: number) => at(t);
  const axisLabels: { x: number; text: string; anchor: 'start' | 'middle' | 'end'; y?: number }[] = [
    { x: X(held.offset), text: `${fmtPacificWeekday(i.filed).slice(0, 3)} ${fmtPacificHm(i.filed)}`, anchor: 'start' },
    // The held span is named above its own stretch of axis, clear of the clock times below it.
    { x: X(held.offset + held.share / 2), text: `held ${fmtDuration(i.heldMs)}`, anchor: 'middle', y: Y.axis - 6 },
    { x: X(work.offset), text: `${fmtPacificWeekday(i.start).slice(0, 3)} ${fmtPacificHm(i.start)}`, anchor: 'start' },
    { x: workX(i.prOpened), text: fmtPacificHm(i.prOpened), anchor: 'middle' },
    { x: workX(i.end), text: fmtPacificHm(i.end), anchor: 'middle' },
    { x: X(wait.offset + wait.share), text: fmtPacificHm(i.merged), anchor: 'end' },
  ];
  const breaks = [held.offset + held.share + AXIS_GAP / 2, work.offset + work.share + AXIS_GAP / 2].map(X);

  return (
    <div
      ref={(el) => {
        ref(el);
        player.ref(el);
      }}
      className={`${styles.root} ${styles.player}`}
      role="group"
      tabIndex={0}
      aria-label={`${label}. ${keysLabel(reduced)}`}
      aria-keyshortcuts="Space ArrowLeft ArrowRight Home End"
      onKeyDown={player.onKeyDown}
    >
      <div className={styles.stage}>
      <svg
        className={`${styles.svg} ${styles.scrub}`}
        width={width}
        height={H}
        role="img"
        aria-label={label}
        onPointerDown={scrub}
        onPointerMove={scrub}
      >
        {/* The recipe the execution ran, the node holding the issue lit */}
        <text className={styles.status} x={0} y={Y.recipe + 4}>
          {PHASE_WORD(i.phases[phase]!.key, i.pr)}
        </text>
        <text className={styles.lane} x={0} y={Y.recipe + 18}>
          status
        </text>
        <line className={styles.inkLine} x1={recipeX(0)} x2={recipeX(i.recipe.length - 1)} y1={Y.recipe} y2={Y.recipe} />
        {i.recipe.map((n, k) => {
          const merged = i.phases[phase]!.key === 'merged';
          const on = !merged && k === phase;
          const done = merged || k < phase;
          return (
            <g key={n.name}>
              <circle className={styles.hollow} cx={recipeX(k)} cy={Y.recipe} r={6.5} />
              <circle className={`${styles.ink} ${styles.fade}`} cx={recipeX(k)} cy={Y.recipe} r={6.5} opacity={done ? 1 : 0} />
              <circle className={`${styles.accent} ${styles.fade}`} cx={recipeX(k)} cy={Y.recipe} r={6.5} opacity={on ? 1 : 0} />
              <text className={styles.lane} x={recipeX(k)} y={Y.recipe + 22} textAnchor="middle">
                {n.type === 'pr' ? 'pull request' : n.name.toLowerCase()}
              </text>
            </g>
          );
        })}

        {/* Lanes */}
        <text className={styles.lane} x={0} y={Y.source + 3}>
          {i.reviewer}
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
        <line className={styles.hair} x1={X(work.offset)} x2={X(work.offset + work.share)} y1={Y.source} y2={Y.source} />
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

        {/* Wakes: what began each turn after the first */}
        {i.turns.map((tn) =>
          tn.wake ? (
            <g
              key={tn.n}
              ref={(el) => {
                if (el) wakeEls.current.set(tn.n, el);
                else wakeEls.current.delete(tn.n);
              }}
            >
              {tn.wake.kind !== 'message' && (
                <rect data-from={Y.run - Y.turn} className={styles.accent} x={at(tn.start) - 2.75} y={Y.turn - 9.5} width={5.5} height={5.5} />
              )}
              {tn.wake.kind !== 'batch' && (
                <circle data-from={Y.source - Y.turn} className={styles.accent} cx={at(tn.start) + (tn.wake.kind === 'both' ? 6 : 0)} cy={Y.turn - 7} r={2.9} />
              )}
            </g>
          ) : null,
        )}

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
      {/* The playhead, and the veil over what is ahead of it: an HTML layer of its own, moved by
          transform each frame without repainting the chart beneath. */}
      <div
        ref={head}
        className={styles.headLayer}
        aria-hidden="true"
        style={{ top: Y.source - 14, height: Y.axis + 18 - Y.source, transform: `translateX(${X(f)}px)`, opacity: state.started ? 1 : 0 }}
      >
        <div className={styles.veilBox} style={{ top: 2, height: Y.pr + 18 - Y.source }} />
        <div className={styles.headLine} />
      </div>
      </div>
      <div className={styles.controls}>
        {reduced ? (
          i.phases.map((p) => (
            <button
              key={p.key}
              type="button"
              className={styles.button}
              aria-pressed={i.phases[phase]!.key === p.key}
              onClick={() => player.seek(axisAt(i.segments, p.at), 'jump')}
            >
              {PHASE_BUTTON(p.key)}
            </button>
          ))
        ) : (
          <button type="button" className={styles.button} onClick={player.toggle}>
            {state.playing ? 'Pause' : state.started && f >= 1 ? 'Replay' : 'Play'}
          </button>
        )}
        <span className={styles.hint}>
          {reduced ? 'or Space and the arrow keys, event by event' : 'drag across it to scrub; the arrow keys step event by event'}
        </span>
      </div>
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
