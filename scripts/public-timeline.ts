import type { ArchivalSource, ArchivalTimeline, Attempt, Bound, OtherFigures, Timeline, TimelineEvent } from '../src/data/types';
import { plainArchivalSource } from './plain-source';

/**
 * Identifiers that stay in the archival export but never reach the public site:
 * fleet helper accounts, lab accounts, machine hostnames, and the demo server's
 * game-process tokens. The scored account is already withheld upstream ('SCORED').
 */
export const REDACTIONS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bcairn_[a-z]+\d+\b/g, '[helper]'],
  [/\bdr\d{4}[a-z]\b/g, '[lab account]'],
  [/\bbgsrv-[a-z0-9]+\b/g, '[lab machine]'],
  [/\bmv[a-z0-9]{6}\b/g, '[token]'],
];

const EVENT_OPTIONAL = ['cause_verbatim', 'quote', 'detail', 'by', 'offline_note', 'note', 'uncertain', 'uncertain_why'] as const;

const sources = (xs: ArchivalSource[] | undefined) => (xs ?? []).map(plainArchivalSource);

function bound(b: Bound<ArchivalSource>): Bound {
  return { utc: b.utc, evidence: b.evidence, sources: sources(b.sources) };
}

function event(e: TimelineEvent<ArchivalSource>): TimelineEvent {
  const out: TimelineEvent = { utc: e.utc, type: e.type, title: e.title, sources: sources(e.sources) };
  for (const k of EVENT_OPTIONAL) if (e[k] !== undefined) (out as unknown as Record<string, unknown>)[k] = e[k];
  return out;
}

/** The swarm's counts beside the official one: the figures only, without the note that cites them. */
function otherFigures(o: OtherFigures | undefined): { other_figures?: OtherFigures } {
  if (!o) return {};
  const { observed_client_ledger, runner_aggregate, final_99_milestone_observed, residual_official_minus_observed } = o;
  return { other_figures: { observed_client_ledger, runner_aggregate, final_99_milestone_observed, residual_official_minus_observed } };
}

function attempt(a: Attempt<ArchivalSource>): Attempt {
  const { value, basis, uncertain, why, other_figures } = a.final_ticks;
  return {
    id: a.id,
    name: a.name,
    kind: a.kind,
    start: bound(a.start),
    end: bound(a.end),
    outcome: a.outcome,
    final_ticks: { value, uncertain, ...(basis ? { basis } : {}), ...(why ? { why } : {}), ...otherFigures(other_figures) },
    events: a.events.map(event),
  };
}

function scrub<T>(v: T): T {
  if (typeof v === 'string') return REDACTIONS.reduce((s, [re, sub]) => s.replace(re, sub), v as string) as T;
  if (Array.isArray(v)) return v.map(scrub) as T;
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, scrub(x)])) as T;
  }
  return v;
}

/**
 * The fields the site renders, and nothing else: no message ids, no account
 * column, no record holder's name, no archival paths or fact-check tables, and
 * sources in plain words rather than the swarm's addresses.
 */
export function projectTimeline(raw: ArchivalTimeline): Timeline {
  const { previous_record_ticks, final_ticks, exact_margin } = raw.meta.record;
  return scrub({
    meta: {
      generated_utc: raw.meta.generated_utc,
      tick_units: raw.meta.tick_units,
      record: { previous_record_ticks, final_ticks, exact_margin },
    },
    project_start: { utc: raw.project_start.utc },
    attempts: raw.attempts.map(attempt),
  });
}
