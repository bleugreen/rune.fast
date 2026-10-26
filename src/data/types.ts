/**
 * The public shape of data/attempts-timeline.json, after scripts/public-timeline.ts,
 * and the archival shape it is projected from, which differs only in its sources.
 */

export type EventType = 'start' | 'stop' | 'ruling' | 'operator' | 'recovery' | 'death' | 'note' | 'logout' | 'result';

/** A source as the archival export records it: the swarm's address for it. */
export interface ArchivalSource {
  uri: string;
  ts?: string;
  /** Comment number, for sources that are comments on an issue. */
  comment?: number;
}

/** A source as the site carries it: plain-words provenance, never an address. */
export type Source = string;

export interface TimelineEvent<S = Source> {
  utc: string;
  type: EventType;
  title: string;
  cause_verbatim?: string;
  quote?: string;
  detail?: string;
  by?: string;
  offline_note?: string;
  note?: string;
  uncertain?: boolean;
  uncertain_why?: string;
  sources: S[];
}

export interface Bound<S = Source> {
  utc: string;
  evidence: string;
  sources: S[];
}

export interface FinalTicks {
  value: number | string | null;
  basis?: string;
  uncertain: boolean;
  why?: string;
}

export interface Attempt<S = Source> {
  id: string;
  name: string;
  kind: string;
  start: Bound<S>;
  end: Bound<S>;
  outcome: string;
  final_ticks: FinalTicks;
  events: TimelineEvent<S>[];
}

export interface Timeline<S = Source> {
  meta: {
    generated_utc: string;
    tick_units: string;
    record: {
      previous_record_ticks: number;
      final_ticks: number;
      exact_margin: string;
    };
  };
  project_start: { utc: string };
  attempts: Attempt<S>[];
}

export type ArchivalTimeline = Timeline<ArchivalSource>;
