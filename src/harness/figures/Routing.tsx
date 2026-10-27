import { useEffect, useMemo, useRef } from 'react';
import { countWord, listWords } from '../../lib/numbers';
import { fmtPacificHms } from '../../lib/time';
import { edgeKey, type HarnessModel, type NodeKey, type RouteStep } from '../model';
import { shownSteps, stepTimeline, usePlayer, useReducedMotion } from '../player';
import { EASE_OUT, TRAVEL_MS, useChartWidth } from './frame';
import styles from './Figures.module.css';

const H = 300;
/** Each step's slot in playback. Real times are printed, not simulated. */
const SLOT = 1100;
/** A reduced-motion Play only highlights, so it can take longer over each step. */
const REDUCED_SLOT = 1600;
/** Between dots of one fan-out. */
const STAGGER = 40;

type Point = readonly [number, number];

/** One sentence per step, in plain words, from the step's own data. */
export function stepText(s: RouteStep, m: HarnessModel): string {
  const r = m.routing;
  const issue = (k: NodeKey) => `rs/${k.replace(/\D/g, '')}`;
  switch (s.kind) {
    case 'report':
      return s.to[0] === 'main'
        ? `rs/3 reports up to main: “${s.words}”`
        : `${issue(s.from)}’s builder reports up to rs/3: “${s.words}”`;
    case 'question':
      return `rs/3 asks the operator: “${s.words}” ${(s.options ?? []).join(' · ')}`;
    case 'answer':
      return `The operator answers “${s.words}”, ${r.answerSeconds} seconds later.`;
    case 'start':
      return `rs/3 starts ${listWords(s.to.map(issue))}, each its own issue with its own pull request.`;
    case 'decision':
      return `main to rs/3: “${s.words}” main has started both fixes itself; its starts become execution ${r.mainExecution} of each and supersede rs/3’s.`;
    case 'fanout':
      return `rs/3 to ${countWord(s.to.length)} of its children: “${s.words}”`;
    case 'confirm':
      return `main to rs/3: “${s.words}”`;
  }
}

/**
 * The routing tree around rs/3 for four minutes on the first evening: the operator, the main thread,
 * rs/3's coordinator and its child issues, and the two fixes it started. Played, each step's
 * message travels its edge: questions up to the person, decisions down, reports up.
 */
export function Routing({ m, label }: { m: HarnessModel; label: string }) {
  const [ref, width] = useChartWidth();
  const r = m.routing;
  const n = r.steps.length;
  const reduced = useReducedMotion();
  // Under reduced motion, Play keeps a slower beat over each step and nothing travels.
  const tl = useMemo(() => stepTimeline(n, reduced ? REDUCED_SLOT : SLOT), [n, reduced]);
  const player = usePlayer(tl);
  const { state } = player;
  const shown = state.started ? shownSteps(n, state.t) : n;
  const current = state.started && shown > 0 ? r.steps[shown - 1]! : null;

  // Layout
  const cx = Math.round(width / 2) - (width < 420 ? 30 : 60);
  const gap = Math.min(26, (width - 24) / r.children.length);
  const P = new Map<NodeKey, Point>([
    ['operator', [cx, 24]],
    ['main', [cx, 96]],
    ['rs3', [cx, 178]],
  ]);
  const side = Math.min(170, width - cx - 46);
  P.set('rs22', [cx + side - 34, 138]);
  P.set('rs23', [cx + side + 6, 138]);
  const childX0 = width / 2 - ((r.children.length - 1) * gap) / 2;
  r.children.forEach((c, k) => P.set(c.key, [childX0 + k * gap, 258]));
  const pt = (k: NodeKey) => P.get(k)!;
  const op = pt('operator');
  const rs3 = pt('rs3');
  const bow = cx - Math.min(150, cx - 12);
  const qPath = `M${rs3[0]},${rs3[1]} C${bow},${rs3[1] - 20} ${bow},${op[1] + 20} ${op[0]},${op[1]}`;
  const edgePath = (key: string, a: NodeKey, b: NodeKey) => (key === 'q' ? qPath : `M${pt(a)[0]},${pt(a)[1]} L${pt(b)[0]},${pt(b)[1]}`);

  const edges = new Map<string, [NodeKey, NodeKey]>();
  edges.set(edgeKey('operator', 'main'), ['operator', 'main']);
  edges.set(edgeKey('main', 'rs3'), ['main', 'rs3']);
  edges.set(edgeKey('main', 'rs22'), ['main', 'rs22']);
  edges.set(edgeKey('main', 'rs23'), ['main', 'rs23']);
  edges.set('q', ['rs3', 'operator']);
  // rs/22 and rs/23 are main's children; rs/3 started them without being their parent.
  edges.set(edgeKey('rs3', 'rs22'), ['rs3', 'rs22']);
  edges.set(edgeKey('rs3', 'rs23'), ['rs3', 'rs23']);
  for (const c of r.children) edges.set(edgeKey('rs3', c.key), ['rs3', c.key]);
  const routeEdge = edgeKey;
  const dashed = (key: string) => key === 'q' || key === edgeKey('rs3', 'rs22') || key === edgeKey('rs3', 'rs23');

  const used = new Set<string>();
  r.steps.slice(0, shown).forEach((s) => s.to.forEach((to) => used.add(routeEdge(s.from, to))));
  const live = new Set(current ? current.to.map((to) => routeEdge(current.from, to)) : []);
  const arrived = new Set(current ? current.to : []);
  const started = r.steps.findIndex((s) => s.kind === 'start');
  const fixesShown = !state.started || shown > started;

  // Travel: the step just reached, by play or the Step button, sends its dots along its edges.
  const dots = useRef<SVGGElement>(null);
  const lastShown = useRef(shown);
  useEffect(() => {
    const prev = lastShown.current;
    lastShown.current = shown;
    const g = dots.current;
    if (!g || !state.started || reduced || shown !== prev + 1 || (state.via !== 'play' && state.via !== 'step')) return;
    const s = r.steps[shown - 1]!;
    s.to.forEach((to, j) => {
      const key = routeEdge(s.from, to);
      const probe = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      probe.setAttribute('d', key === 'q' ? qPath : `M${pt(s.from)[0]},${pt(s.from)[1]} L${pt(to)[0]},${pt(to)[1]}`);
      const len = probe.getTotalLength();
      // Answers travel the question's curve the other way.
      const forward = !(key === 'q' && s.from === 'operator');
      const frames = Array.from({ length: 13 }, (_, q) => {
        const p = probe.getPointAtLength(((forward ? q : 12 - q) / 12) * len);
        return { transform: `translate(${p.x}px, ${p.y}px)` };
      });
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('r', '3.5');
      dot.setAttribute('class', styles.accent!);
      dot.style.transform = frames[0]!.transform;
      g.appendChild(dot);
      const run = dot.animate(frames, { duration: TRAVEL_MS, delay: j * STAGGER, easing: EASE_OUT, fill: 'both' });
      run.onfinish = run.oncancel = () => dot.remove();
    });
  }, [shown, state.started, state.via, reduced]);

  const node = (k: NodeKey, r0: number, cls: string) => (
    <g key={k}>
      <circle className={cls} cx={pt(k)[0]} cy={pt(k)[1]} r={r0} />
      <circle className={`${styles.accentLine} ${styles.arrive}`} cx={pt(k)[0]} cy={pt(k)[1]} r={r0 + 4} opacity={arrived.has(k) ? 1 : 0} />
    </g>
  );

  return (
    <div
      ref={(el) => {
        ref(el);
        player.ref(el);
      }}
      className={`${styles.root} ${styles.player}`}
      role="group"
      tabIndex={0}
      aria-label={`${label}. Space plays; the arrow keys step.`}
      aria-keyshortcuts="Space ArrowLeft ArrowRight Home End"
      onKeyDown={player.onKeyDown}
    >
      <svg className={styles.svg} width={width} height={H} role="img" aria-label={label}>
        {[...edges].map(([key, [a, b]]) => {
          const d = edgePath(key, a, b);
          const dash = dashed(key) ? '3 3' : undefined;
          return (
            <g key={key}>
              <path className={styles.hair} d={d} strokeDasharray={dash} />
              <path className={`${styles.inkLine} ${styles.fade}`} d={d} strokeDasharray={dash} opacity={used.has(key) && !live.has(key) ? 1 : 0} />
              <path className={`${styles.accentLine} ${styles.fade}`} d={d} strokeDasharray={dash} opacity={live.has(key) ? 1 : 0} />
            </g>
          );
        })}
        <rect className={styles.ink} x={op[0] - 6} y={op[1] - 6} width={12} height={12} />
        <circle className={`${styles.accentLine} ${styles.arrive}`} cx={op[0]} cy={op[1]} r={11} opacity={arrived.has('operator') ? 1 : 0} />
        <text className={styles.row} x={op[0] + 14} y={op[1] + 4}>
          the operator
        </text>
        {node('main', 6, styles.hollow!)}
        <text className={styles.row} x={pt('main')[0] + 14} y={pt('main')[1] + 4}>
          main
        </text>
        {node('rs3', 6, styles.hollow!)}
        <text className={styles.row} x={rs3[0] + 14} y={rs3[1] + 4}>
          {`rs/${r.coordinator} coordinator`}
        </text>
        {(['rs22', 'rs23'] as const).map((k) => (
          <g key={k} className={styles.fade} opacity={fixesShown ? 1 : 0.15}>
            {node(k, 4.5, styles.ink!)}
            <text className={styles.rowSub} x={pt(k)[0]} y={pt(k)[1] + 18} textAnchor="middle">
              {`rs/${k.slice(2)}`}
            </text>
          </g>
        ))}
        {r.children.map((c) => (
          <g key={c.key}>
            {node(c.key, 4, styles.hollow!)}
            <text className={styles.rowSub} x={pt(c.key)[0]} y={274} textAnchor="middle">
              {c.n}
            </text>
          </g>
        ))}
        <text className={styles.rowSub} x={width / 2} y={292} textAnchor="middle">
          {`rs/3’s ${countWord(r.children.length)} child issues, each with its own builder`}
        </text>
        <g ref={dots} />
      </svg>
      <p className={styles.caption} aria-live="polite">
        {current ? (
          <>
            <span className={styles.time}>{fmtPacificHms(current.t)}</span>
            {stepText(current, m)}
          </>
        ) : (
          'Press Play, or step through the exchange.'
        )}
      </p>
      <div className={styles.controls}>
        <button type="button" className={styles.button} onClick={player.toggle}>
          {state.playing ? 'Pause' : 'Play'}
        </button>
        <button type="button" className={styles.button} onClick={() => player.step(1, 'step')}>
          Step
        </button>
        <button type="button" className={styles.button} onClick={player.reset}>
          Reset
        </button>
      </div>
      <ol className={styles.steps}>
        {r.steps.map((s, k) => (
          <li key={k} aria-current={current === s ? 'step' : undefined}>
            <span className={styles.stepTime}>{fmtPacificHms(s.t)}</span>
            {stepText(s, m)}
          </li>
        ))}
      </ol>
    </div>
  );
}
