import type { Billing, CostInputs, HourlyRow, RoleName, StatusGroup } from '../data/costTypes';
import type { Timeline } from '../data/types';
import { isScored } from '../attempts/model';
import { pacificDayKey, parseUtc, SECOND } from '../lib/time';

const DAY = 86_400 * SECOND;
/** The average month, for prorating a monthly subscription to the window. */
const MONTH = (365.25 / 12) * DAY;

/* ------------------------------------------------------------------------- */
/* Prices                                                                    */
/* ------------------------------------------------------------------------- */

export type PriceTable = Billing['list_prices']['usd_per_million_tokens'];

/** List-price value of one hour's tokens for one model; a model outside the table prices at zero. */
export function listValue([, model, input, cacheRead, cacheWrite, output]: HourlyRow, prices: PriceTable): number {
  const p = prices[model];
  if (!p) return 0;
  return (Number(input) * p[0] + Number(cacheRead) * p[1] + Number(cacheWrite) * p[2] + Number(output) * p[3]) / 1e6;
}

export const MODEL_NAMES: Readonly<Record<string, string>> = {
  opus: 'Opus',
  fable: 'Fable',
  haiku: 'Haiku',
  sonnet: 'Sonnet',
  'gpt-6-astra': 'GPT-6 Astra',
  'gpt-6.1-sol': 'GPT-6.1 Sol',
  'gpt-5.6-luna': 'GPT-5.6 Luna',
  'gpt-5.6-terra': 'GPT-5.6 Terra',
};
const isGpt = (model: string) => model.startsWith('gpt-');

/* ------------------------------------------------------------------------- */
/* Days                                                                      */
/* ------------------------------------------------------------------------- */

/** Bar segments, bottom to top. Carry snapshots and the documenting agent are too small to read apart. */
export const STACKS = ['coord', 'work', 'thread', 'other'] as const;
export type Stack = (typeof STACKS)[number];
const stackOf = (r: RoleName): Stack => (r === 'coord' || r === 'work' || r === 'thread' ? r : 'other');

export interface DayCost {
  /** Pacific calendar day, 'YYYY-MM-DD'. */
  key: string;
  /** A moment inside the day, for formatting it. */
  t: number;
  stacks: Record<Stack, number>;
  total: number;
  byModel: Record<string, number>;
}

function costDays(inputs: CostInputs): DayCost[] {
  const days = new Map<string, DayCost>();
  const day = (bucket: string) => {
    const t = Number(bucket) * SECOND;
    const key = pacificDayKey(t);
    let d = days.get(key);
    if (!d) {
      d = { key, t, stacks: { coord: 0, work: 0, thread: 0, other: 0 }, total: 0, byModel: {} };
      days.set(key, d);
    }
    return d;
  };
  for (const [bucket, roles] of Object.entries(inputs.roles.hourly)) {
    const d = day(bucket);
    for (const [role, usd] of Object.entries(roles) as [RoleName, number][]) {
      d.stacks[stackOf(role)] += usd;
      d.total += usd;
    }
  }
  for (const row of inputs.hourly) {
    const usd = listValue(row, inputs.billing.list_prices.usd_per_million_tokens);
    if (!usd) continue;
    const d = day(row[0]);
    d.byModel[row[1]] = (d.byModel[row[1]] ?? 0) + usd;
  }
  return [...days.values()].sort((a, b) => a.key.localeCompare(b.key));
}

const argmax = <T>(xs: readonly T[], f: (x: T) => number): T => xs.reduce((a, b) => (f(b) > f(a) ? b : a));
const managersLed = (d: DayCost) => d.stacks.coord > d.stacks.work;

/**
 * The order of the lead between workers and managers that the page narrates:
 * the costliest day with workers ahead, the first day managers led, the next
 * day workers led again, and the next day managers led after that.
 */
export interface LeadSwing {
  peak: DayCost;
  first: DayCost;
  back: DayCost;
  again: DayCost;
}

function leadSwing(days: readonly DayCost[], peak: DayCost): LeadSwing {
  const after = (d: DayCost, pred: (x: DayCost) => boolean) => days.find((x) => x.key > d.key && pred(x));
  const first = after(peak, managersLed);
  const back = first && after(first, (x) => !managersLed(x));
  const again = back && after(back, managersLed);
  if (managersLed(peak) || !first || !back || !again) throw new Error('The day series no longer has the lead swing the page narrates');
  return { peak, first, back, again };
}

/* ------------------------------------------------------------------------- */
/* The whole page                                                            */
/* ------------------------------------------------------------------------- */

export interface StatusSegment {
  key: StatusGroup;
  usd: number;
  /** Issues in the group; for threads, the number of threads. */
  count: number;
}

export interface SwarmDay {
  key: string;
  t: number;
  spawns: number;
  merges: number;
  messages: number;
}

export interface CostModel {
  total: number;
  window: { from: number; to: number; days: number };
  subscription: { monthly: number; plans: { name: string; count: number }[]; prorated: number; ratio: number };
  days: DayCost[];
  peakDay: DayCost;
  managerDays: DayCost[];
  swing: LeadSwing;
  gptDay: { day: DayCost; model: string; usd: number; share: number; opus: number };
  /** Largest first; share is of the whole list value. */
  models: { key: string; name: string; usd: number; share: number }[];
  status: { segments: StatusSegment[]; unattributed: number; median: number };
  concurrency: { points: { t: number; v: number }[]; from: number; to: number; peak: { t: number; v: number } };
  attempts: { n: number; from: number; to: number }[];
  swarm: {
    days: SwarmDay[];
    issues: number;
    threads: number;
    units: number;
    messages: number;
    swaps: number;
    runs: number;
    turns: number;
    /** The two adjacent days that spawned the most, in order. */
    growth: [SwarmDay, SwarmDay];
    spawnPeak: SwarmDay;
    mergePeak: SwarmDay;
    messagePeak: SwarmDay;
    /** Most spawns on any day after the growth days. */
    laterSpawnsMax: number;
  };
}

export function buildCostModel(inputs: CostInputs, timeline: Timeline): CostModel {
  const { cost, summary, billing, events } = inputs;

  const from = cost.t0 * SECOND;
  const to = summary.cut * SECOND;
  const windowDays = (to - from) / DAY;
  const monthly = billing.subscriptions.monthly_usd;
  const prorated = (monthly * (to - from)) / MONTH;

  const days = costDays(inputs);
  const peakDay = argmax(days, (d) => d.total);

  const gptDay = argmax(days, (d) => Object.entries(d.byModel).reduce((s, [m, v]) => s + (isGpt(m) ? v : 0), 0) / d.total);
  const [gptModel, gptUsd] = argmax(
    Object.entries(gptDay.byModel).filter(([m]) => isGpt(m)),
    ([, v]) => v,
  );

  const conc = cost.conc.map((v, i) => ({ t: (cost.t0 + i * cost.step) * SECOND, v }));
  const peak = argmax(conc, (p) => p.v);

  const groups = (['merged', 'closed', 'standing', 'threads'] as const).map((key) => ({
    key,
    usd: cost.groups[key],
    count: key === 'threads' ? events.threads : cost.cnt[key],
  }));

  const swarmDays = events.days.map((d) => ({ key: d.utc_day, t: parseUtc(`${d.utc_day}T12:00Z`), spawns: d.spawns, merges: d.merges, messages: d.messages }));
  const growthEnd = argmax(swarmDays.slice(1), (d) => {
    const i = swarmDays.indexOf(d);
    return d.spawns + swarmDays[i - 1]!.spawns;
  });
  const gi = swarmDays.indexOf(growthEnd);

  return {
    total: cost.total,
    window: { from, to, days: windowDays },
    subscription: { monthly, plans: billing.subscriptions.plans, prorated, ratio: cost.total / prorated },
    days,
    peakDay,
    managerDays: days.filter(managersLed),
    swing: leadSwing(days, peakDay),
    gptDay: { day: gptDay, model: gptModel, usd: gptUsd, share: gptUsd / gptDay.total, opus: gptDay.byModel.opus ?? 0 },
    models: cost.models.map(([key, usd]) => ({ key, name: MODEL_NAMES[key] ?? key, usd, share: usd / cost.total })),
    status: {
      segments: groups,
      unattributed: cost.total - groups.reduce((s, g) => s + g.usd, 0),
      median: cost.median,
    },
    concurrency: { points: conc, from, to: conc.at(-1)!.t + cost.step * SECOND, peak },
    attempts: timeline.attempts
      .filter(isScored)
      .map((a) => ({ from: parseUtc(a.start.utc), to: parseUtc(a.end.utc) }))
      .sort((a, b) => a.from - b.from)
      .map((a, i) => ({ n: i + 1, ...a })),
    swarm: {
      days: swarmDays,
      issues: events.issues,
      threads: events.threads,
      units: events.issues + events.threads,
      messages: swarmDays.reduce((s, d) => s + d.messages, 0),
      swaps: events.backend_swaps,
      runs: summary.runs,
      turns: summary.turns,
      growth: [swarmDays[gi - 1]!, growthEnd],
      spawnPeak: argmax(swarmDays, (d) => d.spawns),
      mergePeak: argmax(swarmDays, (d) => d.merges),
      messagePeak: argmax(swarmDays, (d) => d.messages),
      laterSpawnsMax: Math.max(...swarmDays.slice(gi + 1).map((d) => d.spawns)),
    },
  };
}
