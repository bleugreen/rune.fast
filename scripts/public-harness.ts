import type { HarnessData, RawHarnessData } from '../src/harness/types';

/**
 * data/harness.json keeps each source's table and key in the export, so
 * scripts/harness/extract.py --verify can re-query it. The page prints only a
 * source's plain words, so the build ships only those.
 */
export function projectHarness(raw: RawHarnessData): HarnessData {
  const sources = Object.fromEntries(
    Object.entries(raw.sources).map(([fig, rows]) => [fig, rows.map(({ plain }) => ({ plain }))]),
  );
  return { ...raw, sources };
}
