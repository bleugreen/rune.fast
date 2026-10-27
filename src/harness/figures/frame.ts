import { useWidth } from '../../lib/useWidth';

/** Width before the first measurement (and in server rendering). */
const FALLBACK_WIDTH = 640;
/** Below this a figure stacks its labels above its rows instead of beside them. */
export const NARROW = 560;

/** The page's one curve for things that travel: a strong ease-out, so motion lands rather than drifts. */
export const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';
/** How long a travelling dot takes along its edge. */
export const TRAVEL_MS = 600;

export function useChartWidth() {
  const [ref, measured] = useWidth<HTMLDivElement>();
  return [ref, measured || FALLBACK_WIDTH] as const;
}
