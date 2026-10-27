// Turns the lab films into what the site places: each cut (a window of a film's clip.mp4)
// re-encoded and hashed into the world-assets mirror by scripts/world/publish-videos.ts, its poster
// under public/clips/, and the fields data/clips.json needs (src, bytes, recorded, ticks from the
// film's own feed); and the frames a card shows in place of a clip, under public/stills/.
//
//   bun lab/films/deliver.ts <films> <mirror>
//
// <films> holds one clip directory per film (film/out/<name> from film.sh: clip.mp4, meta.json,
// feed.jsonl); <mirror> is publish-videos' --dir. Run from the repository root.

import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [films, mirror] = process.argv.slice(2);
if (!films || !mirror) throw new Error('usage: bun lab/films/deliver.ts <films> <mirror>');

/** Seconds into each film's capture: the window, and the frame the poster shows. */
const CUTS = [
    { id: 'lab-dialogue-burst', film: 'aereck', from: 1.0, to: 13.8, poster: 2.6 },
    { id: 'lab-dialogue-fixed', film: 'aereck', from: 13.3, to: 23.3, poster: 15.2 },
    { id: 'lab-relog', film: 'relog', from: 6.4, to: 16.4, poster: 11.8 },
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

for (const c of CUTS) {
    const dir = join(films, c.film);
    const cut = join(work, `${c.id}.mp4`);
    ff('-ss', String(c.from), '-to', String(c.to), '-i', join(dir, 'clip.mp4'), ...X264, cut);
    ff('-ss', String(c.poster), '-i', join(dir, 'clip.mp4'), '-frames:v', '1', '-q:v', '3', `public/clips/${c.id}.jpg`);
    const added = JSON.parse(sh(['bun', 'scripts/world/publish-videos.ts', '--add', c.id, cut, `--dir=${mirror}`])) as Record<string, unknown>;
    // The tick on screen at each ms of the cut: the film's feed ticks, on the capture's clock.
    const t0 = (JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8')) as { start: { ms: number } }).start.ms;
    let ticks: [number, number][] = [];
    for (const line of readFileSync(join(dir, 'feed.jsonl'), 'utf8').split('\n')) {
        if (!line.includes('"t":"tick"')) continue;
        const r = JSON.parse(line) as { recv: number; frame?: { t?: string; k?: number } };
        if (r.frame?.t !== 'tick' || typeof r.frame.k !== 'number') continue;
        const ms = r.recv - t0 - c.from * 1000;
        if (ms <= 0) ticks = [[0, r.frame.k]];
        else if (ms < (c.to - c.from) * 1000) ticks.push([Math.round(ms), r.frame.k]);
    }
    console.log(JSON.stringify({ ...added, recorded: [utc(t0 + c.from * 1000), utc(t0 + c.to * 1000)], ticks }));
}

for (const s of STILLS) {
    const dir = join(films, s.film);
    const t0 = (JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8')) as { start: { ms: number } }).start.ms;
    s.at.forEach((t, i) => ff('-ss', String(t), '-i', join(dir, 'clip.mp4'), '-frames:v', '1', '-q:v', '3', `public/stills/${s.name}-${i + 1}.jpg`));
    console.log(JSON.stringify({ stills: s.name, recorded: [utc(t0 + s.at[0] * 1000), utc(t0 + s.at[s.at.length - 1] * 1000)] }));
}
