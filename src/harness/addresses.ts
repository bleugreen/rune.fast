/**
 * The Cairn addresses the harness page teaches, written as the run's agents wrote them. They are
 * the page's subject matter, so they are the one exception to the rule that no cairn:// address
 * is published: scripts/check-public.ts lets through exactly these strings, each only as a whole
 * address, and still fails on any other. scripts/harness/extract.py reads this file and refuses
 * to write data/harness.json if an excerpt carries an address that is not here.
 */
export const ADDRESSES = {
  /** Issue rs/843's pull request: project, issue, execution, node, artifact. */
  pr: 'cairn://p/rs/843/1/builder/create-pr',
  node: 'cairn://p/rs/843/1/builder',
  execution: 'cairn://p/rs/843/1',
  issue: 'cairn://p/rs/843',
  /** A thread: a name where an issue has a number. */
  thread: 'cairn://p/rs/main',
  /** The collection a write appends to when it files an issue. */
  issues: 'cairn://p/rs/issues',
  /** Relative to the agent writing it: its own wake subscriptions, and its own terminal. */
  wakes: 'cairn:~/wakes',
  terminal: 'cairn:~/terminal/lite-lab',
  /** The question rs/3's coordinator put to the operator. */
  question: 'cairn://p/rs/3/1/coordinator/questions/q-1',
  /** The tenet the ledger sets in full. */
  tenet: 'cairn://p/rs/tenets/39',
} as const;

export type AddressKey = keyof typeof ADDRESSES;

export const TAUGHT: readonly string[] = Object.values(ADDRESSES);
