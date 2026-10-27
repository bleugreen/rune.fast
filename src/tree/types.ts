/**
 * The story page's hero: the whole run as a tree, as scripts/tree/extract.py writes it. Times are
 * seconds from t0 (main's creation); t0 and cut (the #1) are epoch seconds. The units are the
 * threads, then the issues in filing order, and the edges and problem ticks name units by that
 * index.
 */
export type Outcome = 'm' | 'c' | 'o';

export interface TreeThread {
  name: string;
  s: number;
  /** 'main' when main's write created it; null for a thread the operator opened. */
  p: string | null;
  by: string;
  /** Agent messages to or from it, by hour from t0: [hour, count, hour, count, …]. */
  a: number[];
}

export interface TreeIssue {
  n: number;
  /** Who filed it: a thread's name, or the number of the issue whose agent filed it. */
  p: string | number;
  s: number;
  /** Merged or closed, or the cut for an issue still open at the #1. */
  e: number;
  o: Outcome;
  /** 'rs/158 coordinator', 'main' or 'the harness'. */
  by: string;
  a: number[];
  /** Open at the #1 and resolved since: how, and when. */
  after?: ['m' | 'c', number];
}

export interface TreeTotals {
  exportIssues: number;
  issues: number;
  threads: number;
  threadsFromMain: number;
  merged: number;
  closed: number;
  open: number;
  agentMessages: number;
  labelled: number;
  problem: number;
  problemTicks: number;
  edgeLines: number;
  edgeMessages: number;
}

/** [unit a (sender), unit b (recipient), five-minute window from t0 as a difference from the row before, messages]. */
export type TreeEdgeRow = [number, number, number, number];

export interface TreeData {
  t0: number;
  cut: number;
  totals: TreeTotals;
  threads: TreeThread[];
  issues: TreeIssue[];
  edges: TreeEdgeRow[];
  /** [unit, seconds from t0 as a difference from the row before]. */
  problems: [number, number][];
}

/** The archival file: each thread's origin write and each problem's message id, for --verify. */
export interface RawTreeData extends Omit<TreeData, 'threads' | 'problems'> {
  threads: (TreeThread & { w?: string })[];
  problems: [number, number, string][];
}

/** Issue number to title. */
export type TreeTitles = Record<string, string>;
