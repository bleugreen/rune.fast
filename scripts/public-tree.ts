import type { RawTreeData, TreeData, TreeTitles } from '../src/tree/types';
import { redact } from './public-timeline';

/**
 * data/tree.json keeps the id of each problem message and of main's write that created each
 * thread, so scripts/tree/extract.py --verify can re-query them. The hero draws neither, so the
 * build ships the drawing without them.
 */
export function projectTree(raw: RawTreeData): TreeData {
  return {
    ...raw,
    threads: raw.threads.map(({ w: _write, ...t }) => t),
    problems: raw.problems.map(([u, t]) => [u, t]),
  };
}

/** The issue titles as the run wrote them, less the identifiers the site never publishes. */
export function projectTreeTitles(raw: TreeTitles): TreeTitles {
  return Object.fromEntries(Object.entries(raw).map(([n, title]) => [n, redact(title)]));
}
