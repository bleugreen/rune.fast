import type { Attempt, Bound, Source, Timeline, TimelineEvent } from '../src/data/types';

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

function source(s: Source): Source {
  return { uri: s.uri, ...(s.ts ? { ts: s.ts } : {}), ...(s.comment !== undefined ? { comment: s.comment } : {}) };
}

function bound(b: Bound): Bound {
  return { utc: b.utc, evidence: b.evidence, sources: (b.sources ?? []).map(source) };
}

function event(e: TimelineEvent): TimelineEvent {
  const out: TimelineEvent = { utc: e.utc, type: e.type, title: e.title, sources: (e.sources ?? []).map(source) };
  for (const k of EVENT_OPTIONAL) if (e[k] !== undefined) (out as unknown as Record<string, unknown>)[k] = e[k];
  return out;
}

function attempt(a: Attempt): Attempt {
  const { value, basis, uncertain, why } = a.final_ticks;
  return {
    id: a.id,
    name: a.name,
    kind: a.kind,
    start: bound(a.start),
    end: bound(a.end),
    outcome: a.outcome,
    final_ticks: { value, uncertain, ...(basis ? { basis } : {}), ...(why ? { why } : {}) },
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
 * column, no record holder's name, no archival paths or fact-check tables.
 */
export function projectTimeline(raw: Timeline): Timeline {
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
