/**
 * data/harness.json as scripts/harness/extract.py writes it. Times are UTC epoch seconds; the
 * model turns them into the milliseconds the rest of the site works in. Senders and recipients
 * are plain ids ('rs/3 coordinator', 'main', 'the operator'), never addresses.
 */

export type Verb = 'read' | 'write' | 'run';

/** A source line as the export keeps it: the table and key it resolves to, and its plain words. */
export interface RawSource {
  table: string;
  id: string | number;
  plain: string;
}

/** What the build ships of a source: its plain words (scripts/public-harness.ts). */
export interface Source {
  plain: string;
}

export interface RecipeNode {
  name: string;
  type: string;
  /** The node holds the execution until a person confirms it. */
  waits: boolean;
}

export interface RawTurn {
  n: number;
  start: number;
  end: number;
  reason: string;
  senders: string[];
  /** Direct messages in the briefing that opened the turn. */
  messages: number;
  waitedOn: string | null;
  waitedOnTests: boolean;
}

export interface RawStep {
  kind: 'report' | 'question' | 'answer' | 'start' | 'decision' | 'fanout' | 'confirm';
  t: number;
  from: string;
  to: string[];
  words: string;
  options?: string[];
  id: string;
}

export interface RawTenet {
  n: number;
  status: 'approved' | 'declined' | 'withdrawn' | 'superseded' | 'proposed';
  verdict: 'yes' | 'no' | null;
  origin: 'standing' | 'filing-gate';
  created: number;
  answered: number | null;
  supersedes: number | null;
  statement?: string;
  comment?: string;
}

export interface WriteItem {
  mode: string;
  target: string;
  payload?: Record<string, unknown>;
}

export interface HarnessData<S = Source> {
  totals: {
    threads: number;
    issues: number;
    topLevelIssues: number;
    childIssues: number;
    coordinatorFiled: number;
    jobs: number;
    executions: number;
    reviewJobs: number;
    exploreTasks: number;
    messages: number;
    systemMessages: number;
    agentMessages: number;
    verbCalls: number;
    verbs: Record<Verb, number>;
    operators: number;
    operatorMessages: number;
    operatorToThreads: number;
    appUserEvents: number;
    carets: number;
    caretsToThreads: number;
    operatorAnswers: number;
    permissionAnswers: number;
    tenetVerdicts: number;
    backstops: number;
    terminalExit: number;
    terminalOutput: number;
    mergesBy: Record<string, number>;
    mergedPrs: number;
    start: number;
    end: number;
  };
  address: {
    issue: number;
    title: string;
    filed: number;
    execution: number;
    recipe: string;
    node: string;
    turns: number;
    start: number;
    end: number;
    artifact: string;
    versions: number;
    pr: number;
    merged: number;
  };
  lifelines: {
    threads: { name: string; created: number; operator: number[]; filed: number[] }[];
    coordinators: number[];
    marks: { rs3: number; rs843: number };
  };
  issue843: {
    filed: number;
    comments: number[];
    start: number;
    end: number;
    turns: RawTurn[];
    calls: { t: number; verb: Verb }[];
    versions: number[];
    review: number;
    reviewer: string;
    prOpened: number;
    merged: number;
    mergedBy: string;
    pr: number;
    recipe: RecipeNode[];
  };
  recipes: { id: string; executions: number; nodes: RecipeNode[] }[];
  write333: { t: number; items: WriteItem[]; filed: { issue: number; t: number } };
  verbsByRole: ({ role: string } & Record<Verb, number>)[];
  rs3: {
    children: number[];
    steps: RawStep[];
    executions: Record<string, { seq: number; t: number; lifecycle: string }[]>;
  };
  wakes: { briefings: number; kinds: { kind: string; headline: string; n: number }[] };
  tenets: RawTenet[];
  git: { days: { day: string; t: number; auto: number; blocking: number }[] };
  quotes: { key: string; t: number; from: string; words: string }[];
  rs302: { seq: number; recipe: string; lifecycle: string; t: number }[];
  sources: Record<string, S[]>;
}

export type RawHarnessData = HarnessData<RawSource>;
