/**
 * The shapes of the cost exports in data/: cost-data.json and roles.json after
 * scripts/public-cost.ts, and summary.json, hourly.json, billing.json and
 * swarm-events.json as checked in. Times in the exports are epoch seconds.
 */

export type StatusGroup = 'merged' | 'closed' | 'standing' | 'threads';

export interface CostData {
  /** List-price value of every token in the window, USD. */
  total: number;
  /** [model key, USD], largest first. */
  models: [string, number][];
  /** Agent turns in progress, averaged over each `step`-second bucket from `t0`. */
  conc: number[];
  t0: number;
  step: number;
  peak: number;
  peak_t: number;
  /** USD by issue status at the cut; threads are runs on no issue. */
  groups: Record<StatusGroup, number>;
  cnt: Record<Exclude<StatusGroup, 'threads'>, number>;
  /** Median list value of a merged issue, USD. */
  median: number;
}

/** The archival cost-data.json: the public fields plus per-issue rows with titles. */
export interface RawCostData extends CostData {
  merged: [number, number, string][];
  top: [number, number, string, string][];
  agentdays: number;
  days: number;
  start: number;
  activedays: number;
}

export type RoleName = 'work' | 'coord' | 'thread' | 'carry' | 'document';

export interface Roles {
  /** USD by role per hour bucket, keyed by the bucket's start. */
  hourly: Record<string, Partial<Record<RoleName, number>>>;
}

export interface RawRoles extends Roles {
  units: [RoleName, string, number][];
}

export interface Summary {
  cut: number;
  total_list_usd: number;
  role_usd: Record<RoleName, number>;
  model_usd: Record<string, number>;
  /** USD per Pacific day. */
  day_usd: Record<string, number>;
  runs: number;
  turns: number;
  sessions: number;
  groups: Record<StatusGroup, number>;
  cnt: Record<Exclude<StatusGroup, 'threads'>, number>;
  merged_n: number;
  median_merge_usd: number;
  peak_conc: number;
  peak_t: number;
}

/** [hour bucket start, model key, input, cache read, cache write, output], token counts as strings. */
export type HourlyRow = [string, string, string, string, string, string];

export interface Billing {
  list_prices: {
    source: string;
    columns: string[];
    /** [input, cache read, cache write, output] USD per million tokens. */
    usd_per_million_tokens: Record<string, [number, number, number, number]>;
  };
  subscriptions: {
    source: string;
    monthly_usd: number;
    plans: { name: string; count: number }[];
  };
}

export interface SwarmEvents {
  source: string;
  days: { utc_day: string; spawns: number; merges: number; messages: number }[];
  issues: number;
  threads: number;
  backend_swaps: number;
}

export interface CostInputs {
  cost: CostData;
  roles: Roles;
  summary: Summary;
  hourly: HourlyRow[];
  billing: Billing;
  events: SwarmEvents;
}
