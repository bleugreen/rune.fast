import { HOUR, MINUTE, SECOND, pacificHour, pacificMidnights } from '../lib/time';
import type { HarnessData, RawStep, RecipeNode, Verb } from './types';

/**
 * Everything the harness page draws and writes, derived from data/harness.json. The figures take
 * their geometry from here and add only pixels; the prose prints only numbers held here
 * (src/harness/model.test.ts fails on any other). Times are epoch milliseconds.
 */

const ms = (s: number) => s * SECOND;
const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);
/** 'rs/158 coordinator' -> 158. */
const issueOf = (plain: string) => Number(/rs\/(\d+)/.exec(plain)?.[1] ?? NaN);
/** 'rs/158 coordinator' -> 'rs/158'; 'main' stays 'main'. */
export const shortId = (plain: string) => /^rs\/\d+/.exec(plain)?.[0] ?? plain;

/* ------------------------------------------------------------------------- */
/* Fig 2: six threads across six days                                         */
/* ------------------------------------------------------------------------- */

export const BIN = 6 * HOUR;

/** The six-hour boundary of the Pacific day (midnight, 6 AM, noon, 6 PM) at or before t. */
function binFloor(t: number): number {
  let x = Math.floor(t / HOUR) * HOUR;
  while (pacificHour(x) % 6) x -= HOUR;
  return x;
}

export interface LifelineRow {
  name: string;
  /** The operator's messages to the thread, per bin (none for the coordinators' row). */
  operator: number[] | null;
  /** Issues the thread filed (or, for the coordinators' row, coordinators filed), per bin. */
  filed: number[];
  operatorTotal: number;
  filedTotal: number;
}

function binned(ts: readonly number[], from: number, bins: number): number[] {
  const out = new Array<number>(bins).fill(0);
  for (const t of ts) out[Math.min(bins - 1, Math.max(0, Math.floor((t - from) / BIN)))]! += 1;
  return out;
}

/* ------------------------------------------------------------------------- */
/* Fig 3: rs/843 on a broken axis                                             */
/* ------------------------------------------------------------------------- */

export type SegmentKey = 'held' | 'work' | 'wait';

export interface AxisSegment {
  key: SegmentKey;
  from: number;
  to: number;
  /** Where the segment starts on the drawn axis, and how much of it it takes, as fractions of its width. */
  offset: number;
  share: number;
}

/** The drawn axis: held compressed, the builder's hour expanded, the wait for merge compressed. */
const SHARES: Readonly<Record<SegmentKey, number>> = { held: 0.2, work: 0.68, wait: 0.08 };
/** The break between two segments, as a fraction of the axis. */
export const AXIS_GAP = 0.02;

export interface Wake {
  /** What resumed the turn: a command batch it was waiting on finishing, a message, or both at once. */
  kind: 'batch' | 'message' | 'both';
  /** Whether the batch was a test run. */
  tests: boolean;
  /** Who sent the waking message(s), short ('rs/158'). */
  from: string[];
}

export interface Turn {
  n: number;
  start: number;
  end: number;
  wake: Wake | null;
}

export function axisAt(segments: readonly AxisSegment[], t: number): number {
  const first = segments[0]!;
  if (t <= first.from) return 0;
  for (const s of segments) if (t <= s.to) return s.offset + ((t - s.from) / (s.to - s.from)) * s.share;
  return 1;
}

/**
 * Where a turn's wake came from, as Fig 3 labels it: test runs, another command, or the agent that
 * messaged it. A wake by a command and a message at once is labelled by its sender.
 */
export function wakeSource(w: Wake): string {
  if (w.kind !== 'batch') return w.from[0]!;
  return w.tests ? 'tests' : 'command';
}

/** Consecutive wakes from the same source, as one labelled run of marks. */
export function wakeRuns(turns: readonly Turn[]): { source: string; turns: Turn[] }[] {
  const runs: { source: string; turns: Turn[] }[] = [];
  for (const tn of turns) {
    if (!tn.wake) continue;
    const source = wakeSource(tn.wake);
    const last = runs.at(-1);
    if (last?.source === source && last.turns.at(-1)!.n === tn.n - 1) last.turns.push(tn);
    else runs.push({ source, turns: [tn] });
  }
  return runs;
}

/* ------------------------------------------------------------------------- */
/* Fig 7: the routing tree around rs/3                                        */
/* ------------------------------------------------------------------------- */

/** A node of the drawn tree: the operator, main, rs/3's coordinator, rs/22 and rs/23, and rs/3's children ('c10'). */
export type NodeKey = string;

export function nodeOf(plain: string): NodeKey {
  if (plain === 'the operator') return 'operator';
  if (plain === 'main') return 'main';
  if (plain === 'rs/3 coordinator') return 'rs3';
  const issue = /^rs\/(22|23)$/.exec(plain);
  if (issue) return `rs${issue[1]}`;
  const child = /^rs\/(\d+) builder$/.exec(plain);
  if (child) return `c${child[1]}`;
  throw new Error(`The routing figure draws no node for ${plain}`);
}

export interface RouteStep {
  kind: RawStep['kind'];
  t: number;
  from: NodeKey;
  to: NodeKey[];
  words: string;
  options?: string[];
}

/** The edge a message travels: the question and its answer go straight between rs/3 and the operator. */
export function edgeKey(a: NodeKey, b: NodeKey): string {
  if ((a === 'operator' && b === 'rs3') || (a === 'rs3' && b === 'operator')) return 'q';
  return [a, b].sort().join('-');
}

/* ------------------------------------------------------------------------- */

/** Briefing kinds drawn as they are; messages are drawn by sender instead (see the wakes block). */
const WAKE_LABEL: Readonly<Record<string, string>> = {
  resolved: 'Issue resolved',
  schedule: 'Scheduled wake',
  review: 'Work ready for review',
  tasks: 'Tasks need attention',
  question: 'Question awaiting an answer',
  permission: 'Permission awaiting a decision',
  'tenet-verdict': 'Tenet verdict',
  child: 'A child paused for safety',
};
/** Briefing items that wake nobody to act: a pointer to unread chat, and the harness's own notices. */
const CATCH_UP = 'catch-up';

const ROLE_LABEL: Readonly<Record<string, string>> = { builders: 'builders', coordinators: 'coordinators', threads: 'threads' };

export interface RecipeRow {
  id: string;
  executions: number;
  nodes: RecipeNode[];
}

export function buildHarnessModel(d: HarnessData) {
  const t = d.totals;
  const start = ms(t.start);
  const end = ms(t.end);

  /* Head ----------------------------------------------------------------- */
  const facts = [
    { label: 'threads', value: t.threads },
    { label: 'issues', value: t.issues },
    { label: 'agent jobs', value: t.jobs },
    { label: 'messages', value: t.messages },
    { label: 'verb calls', value: t.verbCalls },
    { label: 'operator', value: t.operators },
  ];

  /* Fig 1 ---------------------------------------------------------------- */
  const a = d.address;
  const address = { ...a, filed: ms(a.filed), start: ms(a.start), end: ms(a.end), merged: ms(a.merged) };

  /* Fig 2: up to the #1 --------------------------------------------------- */
  const L = d.lifelines;
  const cut = ms(L.cut);
  const from = binFloor(start);
  // The axis stops at the #1, part-way through its last bin.
  const to = cut;
  const bins = Math.ceil((to - from) / BIN);
  const rows: LifelineRow[] = L.threads.map((th) => {
    const op = th.operator.map(ms);
    const filed = th.filed.map(ms);
    return { name: th.name, operator: binned(op, from, bins), filed: binned(filed, from, bins), operatorTotal: op.length, filedTotal: filed.length };
  });
  const coordinators = L.coordinators.map(ms);
  rows.push({ name: 'coordinators', operator: null, filed: binned(coordinators, from, bins), operatorTotal: 0, filedTotal: coordinators.length });
  const threadRows = rows.filter((r) => r.operator !== null);
  const lifelines = {
    from,
    to,
    bins,
    midnights: pacificMidnights(from, to),
    rows,
    marks: (['rs3', 'rs843'] as const).map((key) => ({ key, t: ms(L.marks[key].t), row: rows.findIndex((r) => r.name === L.marks[key].row) })),
    peak: Math.max(...rows.flatMap((r) => [...r.filed, ...(r.operator ?? [])])),
  };
  /** Who filed the issues up to the #1, by author; the groups sum to `issues`. */
  const filing = {
    cut,
    issues: L.issues,
    threads: sum(threadRows.map((r) => r.filedTotal)),
    main: rows.find((r) => r.name === 'main')!.filedTotal,
    coordinators: coordinators.length,
    builders: L.builders.length,
    harness: L.harness.length,
    operatorTyped: L.operatorTyped,
    operatorToThreads: sum(threadRows.map((r) => r.operatorTotal)),
    crossed: { issue: L.crossed.issue, filer: issueOf(L.crossed.filer), filerRole: L.crossed.filer.split(' ')[1]!, parent: L.crossed.parent },
  };

  /* Fig 3 ---------------------------------------------------------------- */
  const i = d.issue843;
  const filed = ms(i.filed);
  const bStart = ms(i.start);
  const review = ms(i.review);
  const merged = ms(i.merged);
  const prOpened = ms(i.prOpened);
  /** The expanded hour runs from the builder's start to just past the final review, on a five-minute grid. */
  const workEnd = bStart + Math.ceil((review - bStart + MINUTE) / (5 * MINUTE)) * 5 * MINUTE;
  const spans: [SegmentKey, number, number][] = [
    ['held', filed, bStart],
    ['work', bStart, workEnd],
    ['wait', workEnd, merged],
  ];
  let offset = 0;
  const segments: AxisSegment[] = spans.map(([key, f, to], k) => {
    const s = { key, from: f, to, offset, share: SHARES[key] };
    offset += SHARES[key] + (k < spans.length - 1 ? AXIS_GAP : 0);
    return s;
  });
  const turns: Turn[] = i.turns.map((r) => {
    const from = r.senders.map(shortId);
    const batch = r.reason === 'wait_resolved';
    const wake: Wake | null =
      r.reason === 'initial' ? null : { kind: batch ? (from.length ? 'both' : 'batch') : 'message', tests: r.waitedOnTests, from };
    return { n: r.n, start: ms(r.start), end: ms(r.end), wake };
  });
  const calls = i.calls.map((c) => ({ t: ms(c.t), verb: c.verb }));
  const callCounts = { read: 0, write: 0, run: 0 } as Record<Verb, number>;
  for (const c of calls) callCounts[c.verb] += 1;
  const comments = i.comments.map(ms);
  const heldComments = comments.filter((c) => c < bStart);
  const wakes843 = turns.filter((tn) => tn.wake);
  const issue = {
    filed,
    start: bStart,
    end: ms(i.end),
    review,
    prOpened,
    merged,
    mergedBy: i.mergedBy,
    reviewer: shortId(i.reviewer),
    reviewerIssue: issueOf(i.reviewer),
    pr: i.pr,
    recipe: i.recipe,
    segments,
    heldMs: bStart - filed,
    workMs: ms(i.end) - bStart,
    waitMs: merged - review,
    heldComments,
    comments: comments.length,
    turns,
    calls,
    callCounts,
    versions: i.versions.map(ms),
    wakeRuns: wakeRuns(turns),
    testWakes: wakes843.filter((tn) => tn.wake!.kind === 'batch' && tn.wake!.tests).length,
    messageWakes: wakes843.filter((tn) => tn.wake!.kind === 'message').length,
    bothWakes: wakes843.filter((tn) => tn.wake!.kind === 'both').length,
    /** Messages in the briefing that opened the turn woken by both. */
    bothMessages: i.turns.find((r) => r.reason === 'wait_resolved' && r.senders.length)?.messages ?? 0,
    heldCommentCount: heldComments.length,
    callCount: calls.length,
  };

  /* Fig 4 ---------------------------------------------------------------- */
  const recipes: RecipeRow[] = d.recipes.map((r) => ({ id: r.id, executions: r.executions, nodes: r.nodes }));
  const recipeTotal = sum(recipes.map((r) => r.executions));
  const recipeOf = (id: string) => recipes.find((r) => r.id === id)!;
  const rs302 = {
    issue: 302,
    executions: d.rs302.length,
    superseded: d.rs302.filter((e) => e.lifecycle === 'superseded').length,
    first: d.rs302[0]!.recipe,
  };

  /* Fig 5 ---------------------------------------------------------------- */
  const write = { t: ms(d.write333.t), items: d.write333.items, filed: { issue: d.write333.filed.issue, t: ms(d.write333.filed.t) } };

  /* Fig 6 ---------------------------------------------------------------- */
  const verbRows = d.verbsByRole
    .filter((r) => ROLE_LABEL[r.role])
    .map((r) => {
      const total = r.read + r.write + r.run;
      return { role: ROLE_LABEL[r.role]!, read: r.read, write: r.write, run: r.run, total, lead: (['write', 'read', 'run'] as const).reduce((x, y) => (r[y] > r[x] ? y : x)) };
    });
  const verbRest = d.verbsByRole.filter((r) => !ROLE_LABEL[r.role]).reduce((acc, r) => acc + r.read + r.write + r.run, 0);
  const verbs = { rows: verbRows, rest: verbRest, total: sum(d.verbsByRole.map((r) => r.read + r.write + r.run)), byVerb: t.verbs };

  /* Fig 7 ---------------------------------------------------------------- */
  const steps: RouteStep[] = d.rs3.steps.map((s) => ({
    kind: s.kind,
    t: ms(s.t),
    from: nodeOf(s.from),
    to: s.to.map(nodeOf),
    words: s.words,
    ...(s.options ? { options: s.options } : {}),
  }));
  const question = steps.find((s) => s.kind === 'question')!;
  const answer = steps.find((s) => s.kind === 'answer')!;
  const fanout = steps.find((s) => s.kind === 'fanout')!;
  const execs = Object.values(d.rs3.executions);
  const routing = {
    coordinator: issueOf(d.rs3.steps.find((s) => s.kind === 'question')!.from),
    childCount: d.rs3.children.length,
    started: d.rs3.steps.find((s) => s.kind === 'start')!.to.map(issueOf),
    children: d.rs3.children.map((n) => ({ n, key: `c${n}` })),
    steps,
    from: steps[0]!.t,
    to: steps.at(-1)!.t,
    answerSeconds: Math.round((answer.t - question.t) / SECOND),
    fanout: fanout.to.length,
    /** main's start of rs/22 and rs/23 is execution 2 of each and supersedes rs/3's. */
    mainExecution: Math.max(...execs.flatMap((e) => e.map((x) => x.seq))),
    superseded: execs.flatMap((e) => e.filter((x) => x.lifecycle === 'superseded')).length,
    spanMinutes: Math.ceil((steps.at(-1)!.t - steps[0]!.t) / MINUTE),
  };

  /* Fig 8 ---------------------------------------------------------------- */
  const kinds = d.wakes.kinds;
  const sent = d.wakes.messages;
  const kindRows = kinds.filter((k) => WAKE_LABEL[k.kind]).map((k) => ({ kind: k.kind, label: WAKE_LABEL[k.kind]!, n: k.n }));
  // A message wakes its recipient whoever sent it: drawn by sender, because the harness's own notices are messages too.
  const wakeRows = [
    { kind: 'agent-message', label: 'A message from another agent', n: sent.agents },
    { kind: 'harness-message', label: 'A message from the harness', n: sent.harness },
    ...kindRows,
  ];
  const messageItems = kinds.find((k) => k.kind === 'message')?.n ?? 0;
  const wakes = {
    rows: wakeRows,
    /** Briefing items: notices, each naming its recipient. */
    items: sum(kinds.map((k) => k.n)),
    messageItems,
    kindItems: sum(kindRows.map((r) => r.n)),
    /** The messages those notices delivered, counted by the sender each names. */
    messages: sent.agents + sent.harness + sent.other,
    fromAgents: sent.agents,
    fromHarness: sent.harness,
    catchUp: kinds.find((k) => k.kind === CATCH_UP)?.n ?? 0,
    other: sum(kinds.filter((k) => !WAKE_LABEL[k.kind] && k.kind !== CATCH_UP && k.kind !== 'message').map((k) => k.n)),
    briefings: d.wakes.briefings,
    messageShare: sent.agents / sum(wakeRows.map((r) => r.n)),
    terminalExit: t.terminalExit,
    terminalOutput: t.terminalOutput,
    backstops: t.backstops,
  };

  /* Fig 9 ---------------------------------------------------------------- */
  const tenetRows = d.tenets.map((r) => ({
    ...r,
    created: ms(r.created),
    answered: r.answered === null ? null : ms(r.answered),
  }));
  const count = (st: string) => tenetRows.filter((r) => r.status === st).length;
  const answeredRows = tenetRows.filter((r) => r.answered !== null);
  const waits = answeredRows.map((r) => r.answered! - r.created).sort((x, y) => x - y);
  const tenets = {
    rows: tenetRows,
    arcs: tenetRows.filter((r) => r.supersedes !== null).map((r) => ({ from: r.supersedes!, to: r.n })),
    total: tenetRows.length,
    answered: answeredRows.length,
    approved: count('approved'),
    superseded: count('superseded'),
    declined: count('declined'),
    withdrawn: count('withdrawn'),
    proposed: count('proposed'),
    gates: tenetRows.filter((r) => r.origin === 'filing-gate').map((r) => r.n),
    /** Answered within the hour. */
    withinHour: waits.filter((w) => w <= HOUR).length,
    withinMinute: waits.filter((w) => w <= MINUTE).length,
    quoted: tenetRows.find((r) => r.n === 39)!,
    research: tenetRows.find((r) => r.n === 3)!,
    /** The part of tenet 3 that says why research is not a sub-agent's job, as the statement words it. */
    researchWhy: /We do not run research as blocking sub-agent tasks \([^)]*\)/.exec(tenetRows.find((r) => r.n === 3)!.statement ?? '')?.[0] ?? '',
    declinedRows: tenetRows.filter((r) => r.status === 'declined'),
    from: Math.min(...tenetRows.map((r) => r.created)),
  };
  /** The merge rule's chain: tenet 5, superseded by 14, superseded by 19. */
  const mergeChain = [19];
  for (let at = 19; ; ) {
    const prev = tenetRows.find((r) => r.n === at)?.supersedes;
    if (!prev) break;
    mergeChain.unshift(prev);
    at = prev;
  }

  /* Fig 10 --------------------------------------------------------------- */
  const gitDays = d.git.days.map((g) => ({ key: g.day, t: ms(g.t), auto: g.auto, blocking: g.blocking, total: g.auto + g.blocking }));
  const gitPeak = gitDays.reduce((x, y) => (y.total > x.total ? y : x));
  const git = {
    days: gitDays,
    peak: gitPeak,
    total: sum(gitDays.map((g) => g.total)),
    blocking: sum(gitDays.map((g) => g.blocking)),
    max: Math.max(...gitDays.map((g) => g.total)),
  };

  /* Fig 11 --------------------------------------------------------------- */
  const operatorInputs = t.operatorMessages + t.operatorAnswers + t.tenetVerdicts;
  const operator = {
    messages: t.operatorMessages,
    answers: t.operatorAnswers,
    verdicts: t.tenetVerdicts,
    inputs: operatorInputs,
    agents: t.agentMessages,
    harness: t.systemMessages,
    carets: t.carets,
    ratio: Math.round(t.agentMessages / operatorInputs),
  };

  /* Quotes and sources ---------------------------------------------------- */
  const quotes = Object.fromEntries(d.quotes.map((q) => [q.key, { ...q, t: ms(q.t), issue: issueOf(q.from) }]));
  const sources = Object.fromEntries(Object.entries(d.sources).map(([k, rows]) => [k, rows.map((r) => r.plain)]));
  const merges = {
    main: t.mergesBy.main ?? 0,
    coordinators: t.mergesBy.coordinators ?? 0,
    integration: t.mergesBy.integration ?? 0,
  };

  const quoted = tenets.quoted;
  return {
    window: { start, end, days: Math.round((end - start) / (24 * HOUR)) },
    totals: t,
    facts,
    address,
    lifelines,
    filing,
    otherThreads: threadRows.filter((r) => r.name !== 'main').map((r) => r.name),
    quotedSeconds: Math.round((quoted.answered! - quoted.created) / SECOND),
    oneOffMinutes: Math.round((ms(d.quotes.find((q) => q.key === 'oneOff')!.t) - ms(d.quotes.find((q) => q.key === 'publish')!.t)) / MINUTE),
    issue,
    recipes,
    recipeTotal,
    build: recipeOf('build'),
    planbuild: recipeOf('planbuild'),
    rs302,
    write,
    verbs,
    routing,
    wakes,
    tenets,
    mergeChain,
    merges,
    git,
    operator,
    quotes,
    sources,
  };
}

export type HarnessModel = ReturnType<typeof buildHarnessModel>;
