/**
 * Labels each agent message by what it is mainly about: routine, problem, landed or decision. The
 * hero tree draws the problems as its red ticks (scripts/tree/extract.py reads the labels).
 *
 *     uv run scripts/tree/extract.py <export.duckdb> --texts <texts.json>
 *     bun scripts/tree/classify.ts <texts.json> <labels.jsonl>        # CONC=10 by default
 *
 * The input is [{id, text}], each message's first 700 characters. The output is one JSON line per
 * message, {id, k, p}: the most likely label and its probability. A run resumes from the ids the
 * output already holds, so it can be stopped and started again; about 25 minutes for 13,000
 * messages at the default concurrency. The question, the model and the options are the ones the
 * site's labels were made with, unchanged: changing any of them is a new reading of the run.
 *
 * It asks through Cairn's decide endpoint, so it runs where @cairn/sdk does (a Cairn agent's
 * machine); CAIRN_SDK overrides where the SDK is loaded from.
 */
import { appendFileSync, existsSync, readFileSync } from 'node:fs';

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error('usage: bun scripts/tree/classify.ts <texts.json> <labels.jsonl>');
  process.exit(2);
}

const MODEL = 'typesafe/jev-1.14';
const PROVIDER = 'openrouter';
const QUESTIONS = [
  {
    name: 'kind',
    type: 'choice',
    instructions:
      'This is a message from one AI agent to another inside a swarm that was building and running bots for a game speedrun. What is it mainly about?',
    options: [
      { value: 'routine', description: 'routine coordination: status update, acknowledgement, progress report, plan, question, handover or request with nothing notable' },
      { value: 'problem', description: 'a problem: something failed, broke, blocked, crashed, was wrong, died, timed out, or a bug or incident was found' },
      { value: 'landed', description: 'something succeeded: merged, landed, passed a test or lab, a measurement came in good, a record or milestone was reached' },
      { value: 'decision', description: 'a decision or ruling: someone decides, rules, approves, rejects, sets a rule, or changes the plan' },
    ],
  },
];

interface Text {
  id: string;
  text: string;
}
interface Choice {
  value: string;
  probability: number;
}

const sdkPath = process.env.CAIRN_SDK ?? `${process.env.HOME}/.cairn/runtime/node_modules/@cairn/sdk/src/index.ts`;
const { run } = (await import(sdkPath)) as { run: (items: unknown[]) => Promise<unknown> };

const texts = JSON.parse(readFileSync(input, 'utf8')) as Text[];
const done = new Set(
  existsSync(output)
    ? readFileSync(output, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((l) => (JSON.parse(l) as { id: string }).id)
    : [],
);
const todo = texts.filter((t) => !done.has(t.id) && t.text.trim());
const log = (m: string) => console.log(`${new Date().toISOString()} ${m}`);
log(`classify: ${todo.length} of ${texts.length} to label (${done.size} already in ${output})`);

async function label(t: Text): Promise<boolean> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const raw = await run([
        { target: 'cairn://models/decide', payload: { args_json: { model: MODEL, provider: PROVIDER, input: t.text, questions: QUESTIONS } } },
      ]);
      const s = typeof raw === 'string' ? raw : JSON.stringify(raw);
      const r = JSON.parse(s.slice(s.indexOf('{'), s.lastIndexOf('}') + 1)) as { answers: { probabilities: Choice[] }[] };
      const best = r.answers[0]!.probabilities.reduce((a, b) => (b.probability > a.probability ? b : a));
      appendFileSync(output!, JSON.stringify({ id: t.id, k: best.value, p: Number(best.probability.toFixed(3)) }) + '\n');
      return true;
    } catch (e) {
      if (attempt === 3) log(`FAIL ${t.id}: ${String((e as Error)?.message ?? e).slice(0, 100)}`);
    }
  }
  return false;
}

let next = 0;
let ok = 0;
await Promise.all(
  Array.from({ length: Number(process.env.CONC ?? 10) }, async () => {
    while (next < todo.length) {
      if (await label(todo[next++]!)) {
        ok++;
        if (ok % 1000 === 0) log(`classify: ${ok}/${todo.length}`);
      }
    }
  }),
);
log(`classify: labelled ${ok}, failed ${todo.length - ok}`);
