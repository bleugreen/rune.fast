/**
 * Builds data/finish-steps.json: the recovery run's steps by session tick, from the runner's
 * sanitized log, each with the code that ran it, extracted from the rs-sdk fork.
 *
 *   bun scripts/world/import-steps.ts --log <postrun-docs>/run-sanitized.jsonl --sdk <rs-sdk checkout>
 *
 * The run itself used commit 9b9c9a8771, made on the run host and never published, so the code is
 * read at 4f62822f, the fork's main when the recovery started (git show; the checkout is never
 * changed). Plain words are written here, by hand. The output is scanned for the site's forbidden
 * identifiers and not written on a hit.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { findForbidden } from '../forbidden';

const RUN = 'run-20261026-102708';
const COMMIT = '4f62822f0fa2a0f320abedba7fc473776c5b408d';

type Locator = { module: string; symbol: string; find: RegExp };
type StepSpec = { step: string; id: string; plain: string; code: Locator | null; codeNote?: string };

/** The runner's step names, in order, with what each did in plain words and where its code is. */
const STEPS: StepSpec[] = [
  {
    step: 'R1 recovery receive',
    id: 'R1',
    plain: 'Back in Lumbridge after the death, take the rebuilt kit from a helper by trade: the cannonballs, the potions and the food.',
    code: null,
    codeNote: 'A one-off recovery script, reviewed and run pinned by its hash; it is not part of the fork.',
  },
  {
    step: 'T26-27 Ardougne teleport + lever + keep web + run',
    id: 'T26-27',
    plain: 'Teleport to Ardougne, pull the lever into the deep Wilderness, cut through the web and run to the poison spiders.',
    code: { module: 'speedrun/runner/legs.ts', symbol: "leg('T26-27')", find: /^    leg\('T26-27'/ },
  },
  {
    step: 'S27 combat finish',
    id: 'S27',
    plain: 'Set the cannon down under the poison spiders and fight beside it until Defence, Ranged and Hitpoints are 99: melee first, then the scimitar, then the magic shortbow.',
    code: { module: 'speedrun/skills/ranged.ts', symbol: 'combatFinishStep()', find: /^export function combatFinishStep\(/ },
  },
  {
    step: 'T27-17 run to the ridge gate + ridge + run to the pipe',
    id: 'T27-17',
    plain: 'Run north to the ridge gate, cross the ridge and run to the pipe at the start of the Agility course.',
    code: { module: 'speedrun/runner/legs.ts', symbol: "leg('T27-17')", find: /^    leg\('T27-17'/ },
  },
  {
    step: 'agility:wilderness',
    id: 'S17',
    plain: 'Lap the Wilderness Agility Course until level 99. The agility program runs each obstacle, eats on landing and watches for other players.',
    code: { module: 'speedrun/skills/agility.ts', symbol: 'bandProgram()', find: /^async function bandProgram\(/ },
  },
  {
    step: 'agility:final-logout',
    id: 'S17 logout',
    plain: 'Wait for the level-up messages to close, step clear of any fight, and log out: the run is over.',
    code: { module: 'speedrun/skills/agility.ts', symbol: 'finalLogout()', find: /^export async function finalLogout\(/ },
  },
];

const { values: args } = parseArgs({
  options: {
    log: { type: 'string' },
    sdk: { type: 'string' },
    out: { type: 'string', default: 'data/finish-steps.json' },
  },
});
if (!args.log || !args.sdk) throw new Error('--log and --sdk are required');

type LogRow = { runId?: string; kind?: string; step?: string; startTick?: number; endTick?: number; ok?: boolean; at?: string };
const rows = readFileSync(args.log, 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((l) => JSON.parse(l) as LogRow)
  .filter((r) => r.runId === RUN && r.kind === undefined);

/** One top-level definition: from the matching line to where its braces and brackets close. */
function extract(source: string, find: RegExp): { startLine: number; code: string } {
  const lines = source.split('\n');
  const start = lines.findIndex((l) => find.test(l));
  if (start === -1) throw new Error(`definition not found: ${find}`);
  let depth = 0;
  let opened = false;
  for (let i = start; i < lines.length; i++) {
    for (const ch of lines[i]!.replace(/'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`|\/\/.*$/g, '')) {
      if ('{(['.includes(ch)) {
        depth++;
        opened = true;
      } else if ('})]'.includes(ch)) depth--;
    }
    if (opened && depth <= 0) {
      return { startLine: start + 1, code: lines.slice(start, i + 1).join('\n') };
    }
  }
  throw new Error(`definition never closes: ${find}`);
}

const sources = new Map<string, string>();
const read = (module: string) => {
  if (!sources.has(module)) {
    sources.set(module, execFileSync('git', ['-C', args.sdk!, 'show', `${COMMIT}:${module}`], { encoding: 'utf8' }));
  }
  return sources.get(module)!;
};

const steps = STEPS.map((spec) => {
  const row = rows.find((r) => r.step === spec.step);
  if (!row || row.startTick === undefined || row.endTick === undefined) throw new Error(`no log row for ${spec.step}`);
  if (!row.ok) throw new Error(`${spec.step} did not end ok`);
  const code = spec.code ? { module: spec.code.module, symbol: spec.code.symbol, ...extract(read(spec.code.module), spec.code.find) } : null;
  return {
    id: spec.id,
    name: spec.step,
    plain: spec.plain,
    from: row.startTick,
    to: row.endTick,
    endedAt: row.at,
    code,
    ...(spec.codeNote ? { codeNote: spec.codeNote } : {}),
  };
});

const out = {
  run: RUN,
  source: {
    repository: 'The swarm’s fork of rs-sdk',
    commit: COMMIT.slice(0, 10),
    note: 'The code as it stood on the fork’s main branch when the recovery started (25 Oct, 19:31 UTC). The run itself used a commit made on the run host and never published, built on this one.',
  },
  ticks: 'Session ticks, as the runner counted them from the recovery login; the replay numbers ticks the same way.',
  steps,
};
const text = JSON.stringify(out, null, 2) + '\n';
const hit = findForbidden(text);
if (hit) {
  console.error(`import-steps: ${hit.what} in the output at offset ${hit.index}; not written`);
  process.exit(1);
}
writeFileSync(args.out, text);
for (const s of steps) console.log(`${s.id}: ticks ${s.from}-${s.to}, ${s.code ? `${s.code.module}:${s.code.startLine} ${s.code.symbol}, ${s.code.code.split('\n').length} lines` : 'no code'}`);
