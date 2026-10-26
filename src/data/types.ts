/** The public shape of data/attempts-timeline.json, after scripts/public-timeline.ts. */

export type EventType = 'start' | 'stop' | 'ruling' | 'operator' | 'recovery' | 'death' | 'note' | 'logout' | 'result';

export interface Source {
  uri: string;
  ts?: string;
  /** Comment number, for sources that are comments on an issue. */
  comment?: number;
}

export interface TimelineEvent {
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
  sources: Source[];
}

export interface Bound {
  utc: string;
  evidence: string;
  sources: Source[];
}

export interface FinalTicks {
  value: number | string | null;
  basis?: string;
  uncertain: boolean;
  why?: string;
}

export interface Attempt {
  id: string;
  name: string;
  kind: string;
  start: Bound;
  end: Bound;
  outcome: string;
  final_ticks: FinalTicks;
  events: TimelineEvent[];
}

export interface Timeline {
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
  attempts: Attempt[];
}
