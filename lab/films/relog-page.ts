// The same-page relog, filmed: rs-sdk speedrun/lab/measure-relog.ts without its own Chrome.
//
// measure-relog.ts starts proxy.ts (the page server that mints one-time login tokens; an in-page
// login needs it) and a Chrome of its own. Under rs-sdk film/capture.ts the client is the film
// tool's tab, so this starts only the page server, logs the staged account out the way
// measure-relog.ts does, points the bot's CLIENT_URL at the page server, and runs the swarm's
// speedrun/tools/relog-probe.ts --via=page --bank unchanged: it logs the tab in, then out and back
// in where it stands, and clicks a bank booth on the new session's first state.
//
//   film/film.sh <bot> --clip=<this repo>/lab/films/relog.json --script=<this repo>/lab/films/relog-page.ts
//
// lab.sh runs it with the rs-sdk checkout as the working directory; everything it uses comes from
// there. The page server takes the web port + 6, beside the film block, and is refused if held.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const bot = process.argv[2];
if (!bot) throw new Error('usage: relog-page.ts <bot> [--n=2]');
const n = process.argv.find(a => a.startsWith('--n='))?.slice(4) ?? '2';

const { closeSession, loadBotEnv, logoutClean, openSession } = await import(join(ROOT, 'speedrun/lib/session.ts'));
const { labBotEnv } = await import(join(ROOT, 'speedrun/lab/browser.ts'));

const env = loadBotEnv(bot);
const loopback = /^(localhost|127\.0\.0\.1):(\d+)$/;
const server = loopback.exec(env.SERVER ?? '');
if (!server) throw new Error(`${bot}: SERVER is '${env.SERVER}', not the local lab`);
const gateway = env.GATEWAY_URL ?? '';
if (!/^ws:\/\/(localhost|127\.0\.0\.1):\d+$/.test(gateway)) throw new Error(`${bot}: GATEWAY_URL is '${gateway}', not the local lab`);
const webPort = Number(server[2]);
const pagePort = webPort + 6;
const log = process.env.LAB_LOG ?? join(process.env.TMPDIR ?? '/tmp', 'speedrun-lab');

if (await fetch(`http://127.0.0.1:${pagePort}/`).then(() => true, () => false)) {
    throw new Error(`port ${pagePort} is already in use; refusing to start the page server`);
}
// The page server, as measure-relog.ts starts it, in front of the lab world. Not under the film hook.
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

    // Off the clock, as measure-relog.ts: the account stands by the Varrock west booths (the clip's
    // setup put it there); log it out of the film tool's tab.
    const session = await openSession(bot, { client: 'browser', pathfinding: false });
    const out = await logoutClean(session);
    if (!out.ok) throw new Error(`setup logout not confirmed (${out.reason})`);
    await closeSession(session);

    // measure-relog.ts's launchLabBrowser({ clientUrl }): the tab's page is the page server's.
    // localhost, not 127.0.0.1, keeps the navigation on the film tab's own site; `minimal` keeps the
    // page capture.ts films (the canvas alone, no overlay panels) through the probe's navigation.
    const envPath = join(ROOT, 'bots', bot, 'bot.env');
    writeFileSync(envPath, labBotEnv(readFileSync(envPath, 'utf8'), `http://localhost:${pagePort}/bot?server=localhost:${webPort}&gateway=${gateway}&minimal`), { mode: 0o600 });

    const probe = Bun.spawn(
        [process.execPath, '--no-install', 'speedrun/tools/relog-probe.ts', bot, '--via=page', `--n=${n}`, '--bank', `--json=${join(log, `relog-${bot}.json`)}`],
        { cwd: ROOT, env: { ...process.env }, stdout: 'inherit', stderr: 'inherit' }
    );
    status = await probe.exited;
} finally {
    proxy.kill();
}
process.exit(status);
