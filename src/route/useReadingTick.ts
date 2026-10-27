import { createContext, useContext, useSyncExternalStore } from 'react';

/**
 * Where the reader is on the hiscore's clock. Each step section reports a list of points, a y
 * offset inside the section and the tick it stands for, and the reading line, 40% of the way down
 * the window, is mapped through them: linearly between points, so a step's prose runs its ticks at
 * a steady rate and a logged-out break, whose two points share a tick, holds it.
 */
export type Points = readonly (readonly [y: number, tick: number])[];

interface Track {
  top: number;
  height: number;
  points: Points;
}

/** The reading line, as a share of the window's height from its top. */
export const READING_LINE = 0.4;

/** The tick at `dy` into a section, through its points. */
export function tickIn(points: Points, dy: number): number {
  const first = points[0];
  if (!first) return 0;
  if (dy <= first[0]) return first[1];
  for (let i = 1; i < points.length; i++) {
    const [y0, t0] = points[i - 1]!;
    const [y1, t1] = points[i]!;
    if (dy <= y1) return y1 === y0 ? t1 : t0 + ((dy - y0) / (y1 - y0)) * (t1 - t0);
  }
  return points.at(-1)![1];
}

/** Where a tick sits in a section: the first y its points give it (a break's tick is its top). */
export function yIn(points: Points, tick: number): number | undefined {
  for (let i = 1; i < points.length; i++) {
    const [y0, t0] = points[i - 1]!;
    const [y1, t1] = points[i]!;
    if (t1 > t0 && tick >= t0 && tick <= t1) return y0 + ((tick - t0) / (t1 - t0)) * (y1 - y0);
  }
  return undefined;
}

/** The tick at page offset `y`, over sections in page order; before the first, its start; after the last, the finish. */
export function tickAt(tracks: readonly Track[], y: number, finish: number): number {
  for (const t of tracks) {
    if (y < t.top) return t.points[0]?.[1] ?? 0;
    if (y <= t.top + t.height) return tickIn(t.points, y - t.top);
  }
  return tracks.length ? finish : 0;
}

export class ReadingClock {
  private tracks = new Map<HTMLElement, Points>();
  private cache: Track[] | null = null;
  private tick = 0;
  private listeners = new Set<() => void>();
  private raf = 0;

  constructor(private readonly finish: number) {}

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    if (this.listeners.size === 1) {
      // One passive listener for the page; the work waits for the next frame.
      window.addEventListener('scroll', this.schedule, { passive: true });
      window.addEventListener('resize', this.invalidate);
      this.schedule();
    }
    return () => {
      this.listeners.delete(fn);
      if (this.listeners.size === 0) {
        window.removeEventListener('scroll', this.schedule);
        window.removeEventListener('resize', this.invalidate);
        cancelAnimationFrame(this.raf);
        this.raf = 0;
      }
    };
  };

  get = () => this.tick;

  /** A section's points, measured; the page offsets of every section are read again on the next frame. */
  set(el: HTMLElement, points: Points) {
    this.tracks.set(el, points);
    this.invalidate();
  }

  remove(el: HTMLElement) {
    this.tracks.delete(el);
    this.invalidate();
  }

  invalidate = () => {
    this.cache = null;
    this.schedule();
  };

  private schedule = () => {
    if (!this.raf && typeof requestAnimationFrame !== 'undefined') this.raf = requestAnimationFrame(this.frame);
  };

  private frame = () => {
    this.raf = 0;
    if (!this.cache) {
      this.cache = [...this.tracks]
        .map(([el, points]) => {
          const b = el.getBoundingClientRect();
          return { top: b.top + window.scrollY, height: b.height, points };
        })
        .sort((a, b) => a.top - b.top);
    }
    const t = Math.floor(tickAt(this.cache, window.scrollY + window.innerHeight * READING_LINE, this.finish));
    if (t === this.tick) return;
    this.tick = t;
    for (const fn of this.listeners) fn();
  };
}

export const ClockContext = createContext<ReadingClock | null>(null);

const none = () => () => {};
const zero = () => 0;

/** The tick under the reading line; 0 where there is no clock (a server render). */
export function useReadingTick(): number {
  const clock = useContext(ClockContext);
  return useSyncExternalStore(clock?.subscribe ?? none, clock?.get ?? zero, zero);
}
