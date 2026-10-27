// Turns the lab films into what the site places: each cut (a window of a film's clip.mp4)
// re-encoded and hashed into the world-assets mirror by scripts/world/publish-videos.ts, its poster
// under public/clips/, and the fields data/clips.json needs (src, bytes, recorded, ticks from the
// film's own feed); each pair (two windows of one film, cropped and set side by side on one clock);
// and the frames a card shows in place of a clip, under public/stills/.
//
//   bun lab/films/deliver.ts <films> <mirror> [id,id,...]
//
// <films> holds one clip directory per film (film/out/<name> from film.sh: clip.mp4, meta.json,
// feed.jsonl); <mirror> is publish-videos' --dir; the ids, when given, deliver only those cuts, pairs
// and stills, so re-delivering one leaves the others' encodes (and content keys) alone. Run from the
// repository root.

import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [films, mirror, ids] = process.argv.slice(2);
if (!films || !mirror) throw new Error('usage: bun lab/films/deliver.ts <films> <mirror> [id,id,...]');
const wanted = (id: string) => !ids || ids.split(',').includes(id);

/** Seconds into each film's capture: the window, and the frame the poster shows. */
const CUTS = [
    { id: 'lab-dialogue-burst', film: 'aereck', from: 1.0, to: 13.8, poster: 2.6 },
    { id: 'lab-dialogue-fixed', film: 'aereck', from: 13.3, to: 23.3, poster: 15.2 },
    { id: 'lab-relog', film: 'relog', from: 6.4, to: 16.4, poster: 11.8 },
    { id: 'lab-bury', film: 'bury1', from: 8.0, to: 21.0, poster: 8.3 },
] as const;
/**
 * Two windows of one film side by side, each starting on the tick frame its first click went out in,
 * cropped to the same region (ffmpeg crop w:h:x:y) and doubled pixel for pixel. The counter is the
 * left window's ticks counted from its first, so it reads 0 on the tick both first clicks go out in.
 * The poster is seconds into the pair.
 */
const PAIRS = [
    { id: 'lab-bank-pair', film: 'bank2', left: 11.995, right: 38.437, seconds: 12, crop: '218:298:532:172', poster: 4.0 },
] as const;
/** Frames shown in place of a clip, in order. */
const STILLS = [{ name: 'tutorial-skip', film: 'tutorial-skip', at: [1.2, 2.2, 2.6, 4.0] }] as const;

function sh(cmd: string[]): string {
    const r = Bun.spawnSync(cmd, { stdout: 'pipe', stderr: 'pipe' });
    if (r.exitCode !== 0) throw new Error(`${cmd.join(' ')}: ${r.stderr.toString()}`);
    return r.stdout.toString().trim();
}
const ff = (...a: string[]) => sh(['ffmpeg', '-loglevel', 'error', '-y', ...a]);
const X264 = ['-c:v', 'libx264', '-crf', '22', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an'];
const utc = (ms: number) => new Date(ms).toISOString().replace(/\.\d+Z$/, 'Z');
const work = mkdtempSync(join(tmpdir(), 'deliver-'));
const startMs = (dir: string) => (JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8')) as { start: { ms: number } }).start.ms;
const add = (id: string, cut: string) =>
    JSON.parse(sh(['bun', 'scripts/world/publish-videos.ts', '--add', id, cut, `--dir=${mirror}`])) as Record<string, unknown>;

/** The tick on screen at each ms of a window: the film's feed ticks, on the capture's clock. */
function feedTicks(dir: string, from: number, seconds: number): [number, number][] {
    const t0 = startMs(dir);
    let ticks: [number, number][] = [];
    for (const line of readFileSync(join(dir, 'feed.jsonl'), 'utf8').split('\n')) {
        if (!line.includes('"t":"tick"')) continue;
        const r = JSON.parse(line) as { recv: number; frame?: { t?: string; k?: number } };
        if (r.frame?.t !== 'tick' || typeof r.frame.k !== 'number') continue;
        const ms = r.recv - t0 - from * 1000;
        if (ms <= 0) ticks = [[0, r.frame.k]];
        else if (ms < seconds * 1000) ticks.push([Math.round(ms), r.frame.k]);
    }
    return ticks;
}

for (const c of CUTS.filter((c) => wanted(c.id))) {
    const dir = join(films, c.film);
    const cut = join(work, `${c.id}.mp4`);
    ff('-ss', String(c.from), '-to', String(c.to), '-i', join(dir, 'clip.mp4'), ...X264, cut);
    ff('-ss', String(c.poster), '-i', join(dir, 'clip.mp4'), '-frames:v', '1', '-q:v', '3', `public/clips/${c.id}.jpg`);
    const t0 = startMs(dir);
    const ticks = feedTicks(dir, c.from, c.to - c.from);
    console.log(JSON.stringify({ ...add(c.id, cut), recorded: [utc(t0 + c.from * 1000), utc(t0 + c.to * 1000)], ticks }));
}

for (const p of PAIRS.filter((p) => wanted(p.id))) {
    const dir = join(films, p.film);
    const clip = join(dir, 'clip.mp4');
    const cut = join(work, `${p.id}.mp4`);
    const side = (i: number) => `[${i}:v]crop=${p.crop},setpts=PTS-STARTPTS`;
    const graph = `${side(0)},pad=iw+4:ih:0:0:color=black[a];${side(1)}[b];[a][b]hstack,scale=iw*2:ih*2:flags=neighbor[v]`;
    const window = (from: number) => ['-ss', String(from), '-t', String(p.seconds), '-i', clip];
    ff(...window(p.left), ...window(p.right), '-filter_complex', graph, '-map', '[v]', ...X264, cut);
    ff('-ss', String(p.poster), '-i', cut, '-frames:v', '1', '-q:v', '3', `public/clips/${p.id}.jpg`);
    const t0 = startMs(dir);
    const left = feedTicks(dir, p.left, p.seconds);
    const ticks = left.map(([ms, k]) => [ms, k - left[0]![1]]);
    // From the left window's first frame to the right window's last: the pair was filmed across both.
    console.log(JSON.stringify({ ...add(p.id, cut), pair: true, recorded: [utc(t0 + p.left * 1000), utc(t0 + (p.right + p.seconds) * 1000)], ticks }));
}

for (const s of STILLS.filter((s) => wanted(s.name))) {
    const dir = join(films, s.film);
    const t0 = startMs(dir);
    s.at.forEach((t, i) => ff('-ss', String(t), '-i', join(dir, 'clip.mp4'), '-frames:v', '1', '-q:v', '3', `public/stills/${s.name}-${i + 1}.jpg`));
    console.log(JSON.stringify({ stills: s.name, recorded: [utc(t0 + s.at[0] * 1000), utc(t0 + s.at[s.at.length - 1] * 1000)] }));
}
