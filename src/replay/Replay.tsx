import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { WorldLoadError } from '@rune/world';
import type { MediaHandle, MediaProps } from '../clips/Clip';
import { TICK_MS, type ReplayEntry } from '../clips/registry';
// Asked to play and not yet shown, a load that has not moved on for this long has stalled.
import { STALL_MS } from '../clips/watchdog';
import { Superseded, acquire, loadProgress, release, type Stage } from './world';
import styles from './Replay.module.css';

/** If the scene never settles (the account out of the recorded area), show it anyway after this long. */
const SHOW_AFTER_MS = 3000;


/**
 * A window of a published world-feed recording, as the footage inside a clip frame. It borrows the
 * page's one shared world (src/replay/world.ts) for as long as it is off its poster: the canvas
 * moves into this frame, the world opens at the window's first tick following the recording's
 * account, and plays to its last. Another replay played meanwhile takes the stage, and this one goes
 * back to its poster. The reader cannot move the camera: the layer takes no input, so the frame's
 * own controls are the only ones. Only the record account is ever named in the scene; a recording
 * that follows another account follows it unlabelled.
 */
const Replay = forwardRef<MediaHandle, MediaProps<ReplayEntry>>(function Replay(props, ref) {
  const { entry } = props;
  const host = useRef<HTMLDivElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState<Stage>();
  const stageRef = useRef<Stage>();
  stageRef.current = stage;
  const latest = useRef(props);
  latest.current = props;
  const shown = useRef(false);

  useImperativeHandle(ref, () => ({
    seek: (ms) => {
      const s = stageRef.current;
      if (s) void s.driver.seek(Math.min(s.kFrom + Math.round(ms / TICK_MS), s.kTo));
    },
  }));

  useEffect(() => {
    let alive = true;
    shown.current = false;
    // Moved off the stage by another replay: back to the poster, as at the end.
    const ticket = acquire(entry, host.current!, overlay.current!, () => latest.current.onEnded());
    ticket.ready.then(
      (s) => alive && setStage(s),
      (e: unknown) => {
        if (!alive || e instanceof Superseded) return;
        console.error(e);
        latest.current.onFailed(e instanceof WorldLoadError ? e.message : 'The replay failed to load');
      },
    );
    // Never an indefinite dimmed mark: a load that stops moving on is reported, naming where it stopped.
    const watchdog = setInterval(() => {
      const { phase, at } = loadProgress();
      if (shown.current || performance.now() - at < STALL_MS) return;
      clearInterval(watchdog);
      console.error(`Replay ${entry.id} stalled: no progress for ${STALL_MS / 1000} s at "${phase}"`);
      latest.current.onFailed('The replay stopped loading. Play it to try again.');
    }, 1000);
    return () => {
      alive = false;
      clearInterval(watchdog);
      release(ticket);
    };
    // The frame's callbacks are read through `latest`: they are new closures on every render.
  }, [entry]);

  return (
    <div
      className={styles.media}
      data-replay={entry.id}
      ref={(el) => {
        // No pointer, key or focus reaches the renderer's canvas, so its camera controls never engage.
        if (el) el.inert = true;
      }}
    >
      <div ref={host} className={styles.stage} />
      <div ref={overlay} className={styles.overlay} />
      {stage && <Playback stage={stage} latest={latest} shownRef={shown} />}
    </div>
  );
});

export default Replay;

/** Plays the stage as the frame asks, and tells the frame where the playhead is. Draws nothing itself. */
function Playback({
  stage,
  latest,
  shownRef,
}: {
  stage: Stage;
  latest: { current: MediaProps<ReplayEntry> };
  shownRef: { current: boolean };
}) {
  const { renderer, pool, driver, controller, kFrom, kTo } = stage;
  /** Held at the first tick under the poster until the scene is drawn, so the reader sees the window from its start. */
  const [shown, setShown] = useState(false);
  const playing = latest.current.playing;

  // Play and pause as the frame asks, once the scene is shown; from the end, play from the start.
  useEffect(() => {
    if (!shown) return;
    if (!playing) {
      driver.pause();
      return;
    }
    if (driver.getSnapshot().k >= kTo) void driver.seek(kFrom).then((done) => done && driver.play());
    else driver.play();
  }, [shown, playing, driver, kFrom, kTo]);

  // Report the playhead, between ticks too, so the frame's rule moves smoothly; stop at the window's end.
  useEffect(() => {
    let raf = 0;
    let tick = -1;
    let tickAt = 0;
    const follow = () => {
      const s = driver.getSnapshot();
      const now = performance.now();
      if (s.k !== tick) {
        tick = s.k;
        tickAt = now;
      }
      const moving = !s.paused && !s.loading;
      const ms = (Math.min(s.k, kTo) - kFrom) * TICK_MS + (moving ? Math.min(now - tickAt, TICK_MS) : 0);
      latest.current.onTime(Math.max(0, Math.min(ms, (kTo - kFrom) * TICK_MS)));
      if (!s.paused && s.k >= kTo) {
        driver.pause();
        latest.current.onEnded();
        return;
      }
      if (moving) latest.current.onPlaying();
      raf = requestAnimationFrame(follow);
    };
    raf = requestAnimationFrame(follow);
    return () => cancelAnimationFrame(raf);
  }, [driver, kFrom, kTo, latest]);

  // Shown once the followed account is drawn on loaded ground (so the camera has reached them) with
  // no map squares or entity bakes outstanding. Ready for a screenshot when that has held for eight
  // checks in a row (0.8 s); the attribute goes at once when a seek starts, and while anything is
  // outstanding.
  useEffect(() => {
    const host = renderer.canvas.closest<HTMLElement>('[data-replay]');
    let streak = 0;
    // A seek from memory can finish between two checks; it must still clear the signal.
    const unsubscribe = driver.subscribe(() => {
      if (!driver.getSnapshot().loading) return;
      streak = 0;
      host?.removeAttribute('data-replay-ready');
    });
    let firstFrameAt: number | undefined;
    const once = new Set<string>();
    const mark = (name: string, reached: boolean) => {
      if (reached && !once.has(name)) {
        once.add(name);
        performance.mark(`replay:${name}`);
      }
    };
    const timer = setInterval(() => {
      const s = driver.getSnapshot();
      const followed = controller.getFollowed();
      const live = renderer.liveRenderer;
      const firstFrame = renderer.stats.frameCount > 0 && !!renderer.mainProgram;
      if (firstFrame) firstFrameAt ??= performance.now();
      mark('renderer-ready', !!renderer.mainProgram);
      mark('first-frame', firstFrame);
      mark('maps-loaded', renderer.mapManager.mapSquares.size > 0 && renderer.mapManager.loadingMapIds.size === 0 && pool.pendingTasks === 0);
      mark('followed-drawn', !!followed && !!live && live.lastDrawn.has(followed));
      const settled =
        !s.loading &&
        !!followed &&
        !!live &&
        live.lastDrawn.has(followed) &&
        renderer.getLiveGroundY(followed) !== undefined &&
        live.pendingBakes === 0 &&
        renderer.mapManager.loadingMapIds.size === 0 &&
        pool.pendingTasks === 0;
      streak = settled ? streak + 1 : 0;
      mark('settled', streak === 1);
      if (streak >= 1 || (firstFrameAt !== undefined && performance.now() - firstFrameAt > SHOW_AFTER_MS)) {
        mark('shown', true);
        shownRef.current = true;
        setShown(true);
      }
      if (streak >= 8) {
        mark('ready', true);
        host?.setAttribute('data-replay-ready', '');
      } else if (streak === 0) host?.removeAttribute('data-replay-ready');
    }, 100);
    return () => {
      clearInterval(timer);
      unsubscribe();
      host?.removeAttribute('data-replay-ready');
    };
  }, [driver, controller, renderer, pool, shownRef]);

  // Paused before the scene was shown: show it anyway, still, so the frame is not left on its poster.
  useEffect(() => {
    if (shown && !playing) latest.current.onPlaying();
  }, [shown, playing, latest]);

  return null;
}
