// The same-page relog, filmed the way the run's Cooking step does it: rs-sdk speedrun/lib/session.ts
// `relog` (logout with the game's button, the page logging itself back in where it stands), then,
// once it has returned, speedrun/helpers/wine-receive.ts `openBankThroughPages` on the nearest booth.
//
// An in-page login needs the page server (proxy.ts: it mints the one-time login token), which the
// film tool's tab is not on. So, off the clock, this starts the page server on the web port + 6
// (refused if held), logs the staged account out, points the bot's CLIENT_URL at the page server
// (keeping the film tool's `minimal` page) and logs the tab in there once. Then `n` rounds of relog
// and bank, each printing the new session's ticks: its first state, the booth click, the bank open.
//
//   film/film.sh <bot> --clip=<this repo>/lab/films/relog.json --script=<this repo>/lab/films/relog-bank.ts
//
// lab.sh runs it with the rs-sdk checkout as the working directory; everything it uses comes from there.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const bot = process.argv[2];
if (!bot) throw new Error('usage: relog-bank.ts <bot> [--n=2]');
const n = Number(process.argv.find(a => a.startsWith('--n='))?.slice(4) ?? '2');

const { closeSession, loadBotEnv, logoutClean, openSession, relog } = await import(join(ROOT, 'speedrun/lib/session.ts'));
const { openBankThroughPages } = await import(join(ROOT, 'speedrun/helpers/wine-receive.ts'));
const { waitTicks, waitUntil } = await import(join(ROOT, 'speedrun/lib/wait.ts'));
const { labBotEnv } = await import(join(ROOT, 'speedrun/lab/browser.ts'));

const env = loadBotEnv(bot);
const server = /^(localhost|127\.0\.0\.1):(\d+)$/.exec(env.SERVER ?? '');
if (!server) throw new Error(`${bot}: SERVER is '${env.SERVER}', not the local lab`);
const gateway = env.GATEWAY_URL ?? '';
if (!/^ws:\/\/(localhost|127\.0\.0\.1):\d+$/.test(gateway)) throw new Error(`${bot}: GATEWAY_URL is '${gateway}', not the local lab`);
const webPort = Number(server[2]);
const pagePort = webPort + 6;
const log = process.env.LAB_LOG ?? join(process.env.TMPDIR ?? '/tmp', 'speedrun-lab');

if (await fetch(`http://127.0.0.1:${pagePort}/`).then(() => true, () => false)) {
    throw new Error(`port ${pagePort} is already in use; refusing to start the page server`);
}
const { BUN_OPTIONS: _hook, ...proxyEnv } = process.env;
const proxy = Bun.spawn(
    [process.execPath, '--no-install', 'proxy.ts', `--world=http://localhost:${webPort}`, `--port=${pagePort}`, `--gateway=${gateway}`, `--bots-dir=${join(ROOT, 'bots')}`],
    { cwd: join(ROOT, 'server', 'webclient'), env: proxyEnv, stdout: Bun.file(join(log, 'film-proxy.log')), stderr: 'inherit' }
);

let status = 1;
try {
    let up = false;
    for (let i = 0; i < 75 && !up; i++) {
        up = await fetch(`http://127.0.0.1:${pagePort}/`).then(() => true, () => false);
        if (!up) await Bun.sleep(200);
    }
    if (!up) throw new Error(`the page server never answered on ${pagePort}`);

    // Off the clock: out of the film tool's page, onto the page server's, standing by the booths.
    const staged = await openSession(bot, { client: 'browser', pathfinding: false });
    const out = await logoutClean(staged);
    if (!out.ok) throw new Error(`setup logout not confirmed (${out.reason})`);
    await closeSession(staged);
    // localhost keeps the navigation on the film tab's own site; `minimal` keeps the filmed page.
    const envPath = join(ROOT, 'bots', bot, 'bot.env');
    writeFileSync(envPath, labBotEnv(readFileSync(envPath, 'utf8'), `http://localhost:${pagePort}/bot?server=localhost:${webPort}&gateway=${gateway}&minimal`), { mode: 0o600 });
    const session = await openSession(bot, { client: 'browser', launch: true, pathfinding: false });
    await waitUntil(session.sdk, s => s.nearbyLocs.some(l => /bank booth/i.test(l.name)), { maxTicks: 30 });

    for (let round = 1; round <= n; round++) {
        await waitTicks(session.sdk, 5);
        const r = await relog(session);
        const bank = await openBankThroughPages(session.sdk);
        const t = (tick: number) => (tick < 0 ? null : tick - r.tickBase);
        console.log(
            `RELOG ${round} ${JSON.stringify({ via: r.via, logoutClickTick: r.logout.clickTick, confirmedBy: r.logout.confirmedBy, loginWallMs: r.loginWallMs, firstStateTick: t(r.loginTick), bankClickTick: t(bank.startTick), bankOpenTick: t(bank.openTick), bankOk: bank.ok, reason: bank.reason ?? null })}`
        );
        if (!bank.ok) throw new Error(`relog ${round}: the bank did not open (${bank.reason})`);
        await waitTicks(session.sdk, 3);
        await session.sdk.sendCloseModal();
        await waitUntil(session.sdk, s => !s.bank.isOpen, { maxTicks: 10 });
    }
    const last = await logoutClean(session);
    console.log(`final logout: ${last.ok ? `confirmed by ${last.confirmedBy}` : `NOT confirmed (${last.reason})`}`);
    await closeSession(session);
    status = 0;
} finally {
    proxy.kill();
}
process.exit(status);
