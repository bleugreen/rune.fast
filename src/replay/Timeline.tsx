import { useRef, useState, type PointerEvent } from 'react';
import type { ClipManifest } from '@rune/world/replay/clip';
import type { ReplaySpeed, ReplayState } from '@rune/world/replay/ReplayDriver';
import { fmtInt } from '../lib/numbers';
import { pacificZone } from '../lib/time';
import type { ReplayMark } from './clips';
import styles from './Timeline.module.css';

const SPEEDS: ReplaySpeed[] = [1, 4, 16];

/** The receive time of tick k, interpolated within the chunk that holds it. */
export function recvOfTick(manifest: ClipManifest, k: number): number {
  const chunk = manifest.chunks.find((c) => c.k1 >= k) ?? manifest.chunks[manifest.chunks.length - 1]!;
  if (chunk.k1 === chunk.k0) return chunk.recv0;
  const f = Math.min(Math.max((k - chunk.k0) / (chunk.k1 - chunk.k0), 0), 1);
  return chunk.recv0 + f * (chunk.recv1 - chunk.recv0);
}

/** The site shows Pacific time; UTC stays in the clip's data. */
const pacificClock = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'America/Los_Angeles',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

export type TimelineProps = {
  manifest: ClipManifest;
  state: ReplayState;
  marks: ReplayMark[];
  onSeek: (k: number) => void;
  onPlay: () => void;
  onPause: () => void;
  onSpeed: (speed: ReplaySpeed) => void;
};

/** The scrub bar: a hairline over the clip's ticks, dragged to seek, with marks and play controls. */
export function Timeline({ manifest, state, marks, onSeek, onPlay, onPause, onSpeed }: TimelineProps) {
  const { kStart, kEnd } = manifest.window;
  const kOffset = manifest.anchor.kOffset;
  const track = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState<number>();

  const pct = (k: number) => `${((k - kStart) / (kEnd - kStart)) * 100}%`;
  const kAt = (clientX: number) => {
    const box = track.current!.getBoundingClientRect();
    const f = Math.min(Math.max((clientX - box.left) / box.width, 0), 1);
    return Math.round(kStart + f * (kEnd - kStart));
  };

  const down = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    onPause();
    setPreview(kAt(e.clientX));
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (preview !== undefined) setPreview(kAt(e.clientX));
  };
  const up = (e: PointerEvent<HTMLDivElement>) => {
    if (preview === undefined) return;
    const k = kAt(e.clientX);
    setPreview(undefined);
    onSeek(k);
  };

  const shown = preview ?? state.k;
  const clock = preview !== undefined || state.recv === null ? recvOfTick(manifest, shown) : state.recv;

  return (
    <div className={styles.timeline}>
      <div className={styles.controls}>
        <button type="button" className={styles.button} onClick={state.paused ? onPlay : onPause} disabled={state.ended && state.paused}>
          {state.paused ? 'play' : 'pause'}
        </button>
        <span className={styles.speeds} role="group" aria-label="Speed">
          {SPEEDS.map((s) => (
            <button key={s} type="button" className={state.speed === s ? styles.on : styles.button} onClick={() => onSpeed(s)} aria-pressed={state.speed === s}>
              {s}×
            </button>
          ))}
        </span>
        <span className={styles.readout} aria-live="off">
          <span>tick {fmtInt(shown - kOffset)}</span>
          <span className={styles.clock}>
            {pacificClock.format(clock)} {pacificZone(clock)}
          </span>
          {state.loading && <span className={styles.clock}>loading</span>}
        </span>
      </div>

      <div
        ref={track}
        className={styles.track}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={() => setPreview(undefined)}
        role="slider"
        aria-label="Replay position, in session ticks"
        aria-valuemin={kStart - kOffset}
        aria-valuemax={kEnd - kOffset}
        aria-valuenow={state.k - kOffset}
        tabIndex={0}
      >
        {state.loaded.map(([a, b]) => (
          <span key={a} className={styles.loaded} style={{ left: pct(a), width: `calc(${pct(b)} - ${pct(a)})` }} />
        ))}
        <span className={styles.rule} />
        {manifest.followGaps.map(([a, b]) => (
          <span key={a} className={styles.gap} style={{ left: pct(a), width: `calc(${pct(b + 1)} - ${pct(a)})` }} />
        ))}
        {marks.map((m, i) => (
          <span key={m.label} className={styles.mark} style={{ left: pct(m.sessionTick + kOffset) }}>
            <span className={styles.markLabel} data-edge={i === 0 ? 'start' : i === marks.length - 1 ? 'end' : undefined}>
              {m.label}, {pacificClock.format(recvOfTick(manifest, m.sessionTick + kOffset))}
            </span>
          </span>
        ))}
        <span className={styles.playhead} style={{ left: pct(state.k) }} />
        {preview !== undefined && <span className={styles.preview} style={{ left: pct(preview) }} />}
      </div>

      {manifest.followGaps.length > 0 && (
        <div className={styles.legend}>
          <span className={styles.swatch} />
          <span>outside the recorded area: the camera follows the roster until the account is back in view</span>
        </div>
      )}
    </div>
  );
}
