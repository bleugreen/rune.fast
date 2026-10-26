import type { Trick } from '../src/tricks/model';
import { plainSource } from './plain-source';

/** data/tricks.json with each source line in plain words; the addresses stay in the data file. */
export function projectTricks(raw: readonly Trick[]): Trick[] {
  return raw.map((t) => ({ ...t, sources: t.sources.map(plainSource) }));
}
