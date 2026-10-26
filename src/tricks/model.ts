import raw from '../../data/tricks.json';
import { clipById } from '../clips/registry';

export type Kind =
  | 'game-mechanic exploit'
  | 'client and packet technique'
  | 'infrastructure'
  | 'economic and swarm'
  | 'route choice'
  | 'rejected';
export type Group = 'game' | 'client' | 'infrastructure';
export type Basis = 'measured' | 'inferred' | 'estimated';
/** A single figure, or the low and high of the runs measured. */
export type Value = number | readonly [number, number];

export interface Saving {
  /** The chart's title; it carries the unit, so the bars' numbers go without one. */
  label: string;
  unit: string;
  before_label: string;
  before: Value;
  after_label: string;
  after: Value;
  /** Which direction is the improvement; ticks are better lower, reactions landed higher. */
  better?: 'lower' | 'higher';
  basis: Basis;
  n?: number;
  /** The basis line under the chart. */
  note: string;
}

export interface Trick {
  id: string;
  name: string;
  kind: Kind;
  group: Group | null;
  what_normally: string | null;
  /** For a rejected technique, its one line. */
  what_instead: string;
  why_allowed: string | null;
  /** Absent where the source has no before-and-after measurement; the card then claims no saving. */
  saving: Saving | null;
  steps_plain: string[];
  failed_live: string | null;
  /** Kept in the data and shown only behind each card's sources disclosure. */
  sources: string[];
  /** The card's clip, by its id in data/clips.json. */
  clip: string | null;
}

export const TRICKS = raw as unknown as readonly Trick[];

export const GROUPS: readonly { id: Group; title: string }[] = [
  { id: 'game', title: 'The game let us' },
  { id: 'client', title: 'The client let us' },
  { id: 'infrastructure', title: 'The infrastructure let us' },
];

export const lo = (v: Value) => (typeof v === 'number' ? v : v[0]);
export const hi = (v: Value) => (typeof v === 'number' ? v : v[1]);
export const mid = (v: Value) => (lo(v) + hi(v)) / 2;

/** The share of the cost the trick removes (or, where higher is better, the share of the result it adds). */
export function savedShare(s: Saving): number {
  const b = mid(s.before);
  const a = mid(s.after);
  return s.better === 'higher' ? (a - b) / a : (b - a) / b;
}

const tier = (t: Trick) => (!t.saving ? 2 : t.saving.basis === 'measured' ? 0 : 1);

/**
 * A group's tricks, largest measured saving first; then inferred and estimated
 * charts by the same measure; then the tricks with no chart, in the data's order.
 */
export function inGroup(tricks: readonly Trick[], group: Group): Trick[] {
  return tricks
    .filter((t) => t.group === group)
    .map((t, i) => ({ t, i }))
    .sort((x, y) => {
      const d = tier(x.t) - tier(y.t);
      if (d) return d;
      if (x.t.saving && y.t.saving) return savedShare(y.t.saving) - savedShare(x.t.saving);
      return x.i - y.i;
    })
    .map(({ t }) => t);
}

export const rejected = (tricks: readonly Trick[]) => tricks.filter((t) => t.kind === 'rejected');

export interface HeadlineFacts {
  /** Techniques the run used. */
  used: number;
  measured: number;
  /** Charts drawn from inferred or estimated figures. */
  unmeasured: number;
  /** Measured techniques that remove at least half the cost they target. */
  halved: number;
}

export function headlineFacts(tricks: readonly Trick[]): HeadlineFacts {
  const used = tricks.filter((t) => t.kind !== 'rejected');
  const charted = used.flatMap((t) => (t.saving ? [t.saving] : []));
  const measured = charted.filter((s) => s.basis === 'measured');
  return {
    used: used.length,
    measured: measured.length,
    unmeasured: charted.length - measured.length,
    halved: measured.filter((s) => savedShare(s) >= 0.5).length,
  };
}

/** Every string a card puts on the reading surface (the sources disclosure aside). */
export function cardText(t: Trick): string[] {
  const s = t.saving;
  return [
    t.name,
    t.what_normally,
    t.what_instead,
    t.why_allowed,
    ...t.steps_plain,
    t.failed_live,
    ...(s ? [s.label, s.before_label, s.after_label, s.note] : []),
    ...(t.clip ? [clipById(t.clip).caption, clipById(t.clip).step] : []),
  ].filter((x): x is string => x !== null);
}

/** 'a', 'a and b', 'a, b and c'. */
export function listJoin(items: readonly string[]): string {
  if (items.length < 2) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}
