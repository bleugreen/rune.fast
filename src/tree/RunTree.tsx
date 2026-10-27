import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { fmtInt } from '../lib/numbers';
import { SECOND, fmtPacificWeekdayHm } from '../lib/time';
import { loadTitles, treeData } from './data';
import { buildTree, layout, type Edge, type Layout, type Tree } from './model';
import type { TreeTitles } from './types';
import styles from './RunTree.module.css';

/** The phone's tap card is on trial with the operator: false removes it, and nothing else changes. */
const TAP_CARD = true;
/** Below this width the figure is the phone's: half as tall, with thinner marks (RunTree.module.css agrees). */
const PHONE = '(max-width: 599px)';
const HOVER_RADIUS = 9;
const TAP_RADIUS = 16;
const RESIZE_DEBOUNCE = 150;
/** A mono label's width per character, as a share of its size, to keep it inside the figure. */
const MONO_ADVANCE = 0.6;

type Rgb = readonly [number, number, number];
interface Colours {
  ink: Rgb;
  accent: Rgb;
}

function rgb(hex: string): Rgb {
  const h = hex.trim().replace('#', '');
  const v = Number.parseInt(h.length === 3 ? [...h].map((c) => c + c).join('') : h, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

const rgba = ([r, g, b]: Rgb, a: number) => `rgba(${r},${g},${b},${a})`;

/** The colours come from tokens.css, like every other figure's. */
function colours(el: Element): Colours {
  const css = getComputedStyle(el);
  return { ink: rgb(css.getPropertyValue('--ink')), accent: rgb(css.getPropertyValue('--accent')) };
}

/** A message line between two branches: slightly arched, its lift growing with its length. */
function arc(ctx: CanvasRenderingContext2D | Path2D, L: Layout, e: Edge): number {
  const xa = L.xAt(e.a, e.t);
  const xb = L.xAt(e.b, e.t);
  const y = L.y(e.t);
  const d = Math.abs(xb - xa);
  if (d < 1.5) return d;
  const lift = Math.min(L.compact ? 18 : 34, d * 0.18);
  ctx.moveTo(xa, y);
  ctx.quadraticCurveTo((xa + xb) / 2, y - lift, xb, y);
  return d;
}

/**
 * The figure, once per size. Draw order: idle hairlines, message lines, active branches (small
 * subtrees first), thread limbs, merge dots, problem ticks. The labels are HTML over the canvas.
 */
function draw(ctx: CanvasRenderingContext2D, tree: Tree, L: Layout, c: Colours): void {
  const { units, weight } = tree;
  const sc = L.compact ? 0.72 : 1;
  ctx.clearRect(0, 0, L.width, L.height);

  ctx.strokeStyle = rgba(c.ink, 0.16);
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  for (const d of L.days) {
    if (!d.rule) continue;
    ctx.moveTo(L.left - 6, d.y);
    ctx.lineTo(L.width, d.y);
  }
  ctx.stroke();

  // Idle stretches, an hour with no messages: hairlines, so backlog recedes.
  ctx.lineCap = 'round';
  for (const kind of ['issue', 'thread'] as const) {
    ctx.beginPath();
    for (const u of units) {
      if (u.kind !== kind) continue;
      const { xy, counts } = L.paths[u.index]!;
      for (let k = 0; k < counts.length; k++) {
        if (counts[k]) continue;
        ctx.moveTo(xy[2 * k]!, xy[2 * k + 1]!);
        ctx.lineTo(xy[2 * k + 2]!, xy[2 * k + 3]!);
      }
    }
    ctx.lineWidth = (kind === 'thread' ? 1 : 0.5) * sc;
    ctx.strokeStyle = rgba(c.ink, kind === 'thread' ? 0.45 : 0.14);
    ctx.stroke();
  }

  // Messages between branches, faint and fading with length; batched by strength.
  ctx.lineCap = 'butt';
  ctx.lineWidth = L.compact ? 0.3 : 0.4;
  const fade = L.compact ? 30 : 70;
  const byAlpha = new Map<number, Path2D>();
  for (const e of tree.edges) {
    const p = new Path2D();
    const d = arc(p, L, e);
    if (d < 1.5) continue;
    const a = Math.min(0.3, 0.05 * Math.sqrt(e.n) * Math.max(0.12, Math.min(1, fade / d)));
    const level = Math.max(1, Math.round(a / 0.004));
    let batch = byAlpha.get(level);
    if (!batch) byAlpha.set(level, (batch = new Path2D()));
    batch.addPath(p);
  }
  for (const [level, path] of byAlpha) {
    ctx.strokeStyle = rgba(c.ink, level * 0.004);
    ctx.stroke(path);
  }

  // Branches where their agents traded messages: weight by the hour's count.
  ctx.lineCap = 'round';
  const issueOrder = units.filter((u) => u.kind === 'issue').sort((a, b) => weight[a.index]! - weight[b.index]! || a.index - b.index);
  for (const u of [...issueOrder, ...units.filter((x) => x.kind === 'thread')]) {
    const limb = u.kind === 'thread';
    ctx.strokeStyle = rgba(c.ink, limb ? 0.9 : 0.6);
    const { xy, counts } = L.paths[u.index]!;
    for (let k = 0; k < counts.length; ) {
      const n = counts[k]!;
      let j = k;
      while (j < counts.length && counts[j] === n) j++;
      if (n) {
        ctx.lineWidth = (limb ? 1.4 + Math.min(5, Math.sqrt(n) * 0.32) : 0.45 + Math.min(3.2, Math.sqrt(n) * 0.3)) * sc;
        ctx.beginPath();
        ctx.moveTo(xy[2 * k]!, xy[2 * k + 1]!);
        for (let m = k + 1; m <= j; m++) ctx.lineTo(xy[2 * m]!, xy[2 * m + 1]!);
        ctx.stroke();
      }
      k = j;
    }
  }

  ctx.fillStyle = rgba(c.ink, 1);
  ctx.beginPath();
  const r = L.compact ? 1.05 : 1.3;
  for (const u of units) {
    if (u.outcome !== 'm') continue;
    const x = L.xAt(u.index, u.e);
    const y = L.y(u.e);
    ctx.moveTo(x + r, y);
    ctx.arc(x, y, r, 0, 2 * Math.PI);
  }
  ctx.fill();

  // The problem ticks: the one accent, light enough that red gathers only where trouble clustered.
  ctx.lineCap = 'butt';
  ctx.strokeStyle = rgba(c.accent, L.compact ? 0.35 : 0.45);
  ctx.lineWidth = L.compact ? 0.55 : 0.6;
  const half = L.compact ? 1.5 : 2;
  ctx.beginPath();
  for (const p of tree.problems) {
    const x = L.xAt(p.u, p.t);
    const y = L.y(p.t);
    ctx.moveTo(x - half, y);
    ctx.lineTo(x + half, y);
  }
  ctx.stroke();
}

/** One unit's message lines and its own path, over the figure. */
function highlight(ctx: CanvasRenderingContext2D, tree: Tree, L: Layout, unit: number, c: Colours): void {
  ctx.clearRect(0, 0, L.width, L.height);
  if (unit < 0) return;
  ctx.lineWidth = 0.8;
  ctx.lineCap = 'butt';
  for (const k of tree.edgesOf[unit]!) {
    const e = tree.edges[k]!;
    ctx.strokeStyle = rgba(c.ink, Math.min(0.35, 0.15 * Math.sqrt(e.n)));
    ctx.beginPath();
    arc(ctx, L, e);
    ctx.stroke();
  }
  const { xy } = L.paths[unit]!;
  ctx.strokeStyle = rgba(c.ink, 1);
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(xy[0]!, xy[1]!);
  for (let k = 2; k < xy.length; k += 2) ctx.lineTo(xy[k]!, xy[k + 1]!);
  ctx.stroke();
}

interface Size {
  width: number;
  height: number;
  compact: boolean;
}

interface Pick {
  unit: number;
  x: number;
  y: number;
  /** A mouse hover, beside the pointer; or a tap, docked at the foot of the screen. */
  mode: 'hover' | 'tap';
}

const OUTCOME = { m: 'merged', c: 'closed without merging', o: 'still open at the #1' } as const;

function CardBody({ tree, unit, titles }: { tree: Tree; unit: number; titles: TreeTitles | null }) {
  const u = tree.units[unit]!;
  const at = (s: number) => fmtPacificWeekdayHm((tree.t0 + s) * SECOND);
  const threadNames = new Set(tree.threads.map((i) => tree.units[i]!.name));
  const who = (by: string) => (threadNames.has(by) ? <code>{by}</code> : by);
  if (u.kind === 'thread') {
    return (
      <>
        <p className={styles.cardTitle}>
          <code>{u.name}</code>
        </p>
        <p className={styles.cardMeta}>
          opened by {who(u.by)} · {at(u.s)}
        </p>
      </>
    );
  }
  const resolved =
    u.outcome === 'm'
      ? `merged ${at(u.e)}`
      : u.outcome === 'c'
        ? `closed ${at(u.e)}`
        : u.after
          ? `${u.after[0] === 'm' ? 'merged' : 'closed'} ${at(u.after[1])}, after the record`
          : null;
  return (
    <>
      <p className={styles.cardMeta}>
        {u.name} · filed by {who(u.by)}
      </p>
      <p className={styles.cardTitle} aria-busy={titles ? undefined : true}>
        {titles?.[String(u.number)] ?? ' '}
      </p>
      <p className={styles.cardMeta}>
        <span className={styles.outcome}>{OUTCOME[u.outcome!]}</span> · filed {at(u.s)}
        {resolved && ` · ${resolved}`}
      </p>
    </>
  );
}

/**
 * The story page's hero: the whole run as a tree, from main's creation at the top to the #1 at the
 * foot. Drawn once on mount and again only when the figure's size changes; never on scroll.
 */
export function RunTree() {
  const tree = useMemo(() => buildTree(treeData), []);
  const frameRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLCanvasElement>(null);
  const overRef = useRef<HTMLCanvasElement>(null);
  const coloursRef = useRef<Colours | null>(null);
  const pointerType = useRef('mouse');
  const [size, setSize] = useState<Size | null>(null);
  const [pick, setPick] = useState<Pick | null>(null);
  const [titles, setTitles] = useState<TreeTitles | null>(null);
  const L = useMemo(() => (size ? layout(tree, size) : null), [tree, size]);

  useEffect(() => {
    const el = frameRef.current!;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const next = { width: Math.round(r.width), height: Math.round(r.height), compact: matchMedia(PHONE).matches };
      setSize((prev) => (prev && prev.width === next.width && prev.height === next.height && prev.compact === next.compact ? prev : next));
    };
    measure();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const ro = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(measure, RESIZE_DEBOUNCE);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!L) return;
    const base = baseRef.current!;
    const over = overRef.current!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    for (const cv of [base, over]) {
      cv.width = Math.round(L.width * dpr);
      cv.height = Math.round(L.height * dpr);
      cv.getContext('2d')!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    coloursRef.current = colours(base);
    performance.mark('rune:tree-draw-start');
    draw(base.getContext('2d')!, tree, L, coloursRef.current);
    performance.measure('rune:tree-draw', 'rune:tree-draw-start');
    setPick(null);
  }, [tree, L]);

  const picked = pick?.unit ?? -1;
  useEffect(() => {
    if (!L || !coloursRef.current) return;
    highlight(overRef.current!.getContext('2d')!, tree, L, picked, coloursRef.current);
  }, [tree, L, picked]);

  // A tap card goes away when the reader scrolls on; the listener exists only while one is open.
  const tapped = pick?.mode === 'tap';
  useEffect(() => {
    if (!tapped) return;
    const close = () => setPick(null);
    window.addEventListener('scroll', close, { passive: true, once: true });
    return () => window.removeEventListener('scroll', close);
  }, [tapped]);

  const at = (e: ReactPointerEvent | React.MouseEvent): [number, number] => {
    const r = overRef.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  const choose = (unit: number, x: number, y: number, mode: Pick['mode']) => {
    if (unit < 0) return setPick(null);
    if (!titles) void loadTitles().then(setTitles);
    setPick({ unit, x, y, mode });
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType !== 'mouse' || !L) return;
    const [x, y] = at(e);
    choose(L.nearest(x, y, HOVER_RADIUS), x, y, 'hover');
  };
  const onPointerLeave = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === 'mouse') setPick((p) => (p?.mode === 'hover' ? null : p));
  };
  const onClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!TAP_CARD || pointerType.current === 'mouse' || !L) return;
    const [x, y] = at(e);
    choose(L.nearest(x, y, TAP_RADIUS), x, y, 'tap');
  };

  const t = tree.totals;
  const description =
    `The whole run as a tree, from Tuesday 20 October at the top to the #1 on Monday 26 October at the foot: ` +
    `${fmtInt(t.issues)} issues, each growing from the thread or coordinator that filed it until it merged or closed.`;

  const monoPx = L?.compact ? 10 : 11;
  const cardWidth = L ? Math.min(300, L.width) : 300;
  const below = pick && L ? pick.y < L.height * 0.7 : true;

  return (
    <figure className={styles.hero}>
      <div ref={frameRef} className={styles.frame} role="img" aria-label={description}>
        <canvas ref={baseRef} className={styles.canvas} aria-hidden="true" />
        <canvas
          ref={overRef}
          className={styles.canvas}
          aria-hidden="true"
          onPointerDown={(e) => (pointerType.current = e.pointerType)}
          onPointerMove={onPointerMove}
          onPointerLeave={onPointerLeave}
          onClick={onClick}
        />
        {L && (
          <div className={styles.labels} aria-hidden="true">
            {L.days.map((d) => (
              <span key={d.t} className={styles.day} style={{ top: d.y }}>
                {d.label}
              </span>
            ))}
            {L.labels.map((l) => {
              const w = l.text.length * monoPx * MONO_ADVANCE;
              const x = l.side === 'left' ? l.x - w - 6 : l.side === 'right' ? l.x + 6 : l.x - w / 2;
              return (
                <code key={l.unit} className={styles.thread} style={{ left: Math.max(L.left, Math.min(L.width - w - 2, x)), top: l.y }}>
                  {l.text}
                </code>
              );
            })}
          </div>
        )}
        {pick && L && (
          <div
            className={pick.mode === 'tap' ? `${styles.card} ${styles.docked}` : styles.card}
            style={
              pick.mode === 'tap'
                ? undefined
                : {
                    width: cardWidth,
                    left: Math.max(0, Math.min(L.width - cardWidth, pick.x + 14)),
                    ...(below ? { top: pick.y + 14 } : { bottom: L.height - pick.y + 14 }),
                  }
            }
          >
            <CardBody tree={tree} unit={pick.unit} titles={titles} />
          </div>
        )}
      </div>
      <figcaption className={styles.caption}>
        <p className={styles.key}>
          Each line is an issue, growing from the thread or coordinator that filed it until it merged{' '}
          <span className={styles.dot} aria-hidden="true" /> or closed. It thickens where its agents traded messages, and the faint lines between
          branches are those messages; <span className={styles.tick} role="img" aria-label="a red tick" /> marks a message reporting a
          problem.
        </p>
        <details className={styles.sources}>
          <summary>Sources</summary>
          <p>
            The rs project&rsquo;s database export of 26 October 2026: its threads and who opened them, its issues and who filed them, and
            the messages between agents. A language model read each message&rsquo;s opening and marked those reporting a problem; the red
            ticks are its reading.
          </p>
        </details>
      </figcaption>
    </figure>
  );
}
