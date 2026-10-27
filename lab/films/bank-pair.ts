// The same 24-kind deposit twice, filmed in one client: rs-sdk's stock `bot.depositItem(/./, -1)`,
// one deposit a tick, then the swarm's speedrun/lib/bank.ts `depositAll`, every deposit sent at once
// and the server taking five a tick. These are speedrun/lab/measure-bank.ts's own two calls, staged
// the same way (its bankFixture and its 24 distinct lab items, one of each), with a pause around each
// deposit so the two can be cut out and set side by side, aligned on their first click.
//
//   film/film.sh <bot> --clip=<this repo>/lab/films/bank.json --script=<this repo>/lab/films/bank-pair.ts
//
// lab.sh runs it with the rs-sdk checkout as the working directory; everything it uses comes from there.
// Each deposit prints one DEPOSIT line: which path, its measured ticks, and the actions it sent.

import { join } from 'node:path';

const ROOT = process.cwd();
const bot = process.argv[2];
if (!bot) throw new Error('usage: bank-pair.ts <bot> [--rounds=2]');
const rounds = Number(process.argv.find(a => a.startsWith('--rounds='))?.slice(9) ?? '2');

const { closeSession, openSession } = await import(join(ROOT, 'speedrun/lib/session.ts'));
const { depositAll, withdrawMany } = await import(join(ROOT, 'speedrun/lib/bank.ts'));
const { waitTicks } = await import(join(ROOT, 'speedrun/lib/wait.ts'));
const { formatReport, report } = await import(join(ROOT, 'speedrun/lib/ticks.ts'));
const { labLog, sample } = await import(join(ROOT, 'speedrun/lab/common.ts'));
const { bankFixture, isLabItem, LAB_ITEMS } = await import(join(ROOT, 'speedrun/lab/setup.ts'));

// Attach to the film tool's tab (no launch), as the lab's scripts must.
const session = await openSession(bot, { client: 'browser' });
const { sdk, bot: actions } = session;
const log = labLog('bank-pair');

await bankFixture(session, { ironOre: 0 });
const bank = () => sdk.getState()!.bank.items as { id: number; name: string }[];
const ids = LAB_ITEMS.map((d: string) => bank().find(i => isLabItem(i.name, d))?.id).filter((id: number | undefined): id is number => id !== undefined).slice(0, 24);
if (ids.length < 24) throw new Error(`bank holds only ${ids.length} lab items`);

async function stage() {
    const r = await withdrawMany(sdk, ids.map((id: number) => ({ item: id, n: 1 })));
    if (!r.ok || sdk.getState()!.inventory.length !== 24) throw new Error(`staging 24 items failed: ${JSON.stringify(r)}`);
}

async function film(path: 'stock' | 'ours', fn: () => Promise<unknown>) {
    await stage();
    await waitTicks(sdk, 6);
    const startMs = Date.now();
    await sample(log, session, `deposit 24 distinct (${path})`, async () => {
        await fn();
        const len = sdk.getState()!.inventory.length;
        return len === 0 ? { ok: true } : { ok: false, reason: `inventory holds ${len} items` };
    });
    const row = log.rows[log.rows.length - 1]!;
    console.log(`DEPOSIT ${JSON.stringify({ path, ticks: row.ticks, ok: row.ok, startMs, endMs: Date.now() })}`);
    await waitTicks(sdk, 6);
}

for (let i = 0; i < rounds; i++) {
    await film('stock', () => actions.depositItem(/./, -1));
    await film('ours', () => depositAll(sdk));
}

console.log(formatReport(report(log.rows)));
await closeSession(session);
process.exit(0);
