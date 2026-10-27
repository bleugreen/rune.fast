import { useWidth } from '../../lib/useWidth';

/** Width before the first measurement (and in server rendering). */
const FALLBACK_WIDTH = 640;
/** Below this a figure stacks its labels above its rows instead of beside them. */
export const NARROW = 560;

/** The page's one curve for things that travel: a strong ease-out, so motion lands rather than drifts. */
export const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';
/**
 * How long a travelling dot takes along its edge. Longer than a UI transition on purpose: these are
 * explanations the reader starts, seen once a visit, and the eye has to follow the dot from sender
 * to recipient across most of the figure.
 */
export const TRAVEL_MS = 600;
/** Between the dots of one fan-out. */
export const STAGGER = 40;
/** When the j-th dot of a step leaves. */
export const dotDelay = (j: number) => j * STAGGER;
/** When its arrival ring starts to fade in: just before that dot lands, so the two finish together. */
export const arrivalDelay = (j: number) => dotDelay(j) + TRAVEL_MS - 40;

export function useChartWidth() {
  const [ref, measured] = useWidth<HTMLDivElement>();
  return [ref, measured || FALLBACK_WIDTH] as const;
}
