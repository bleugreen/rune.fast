import {
  forwardRef,
  lazy,
  Suspense,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
} from 'react';
import { Contained } from '../components/Contained';
import { fmtInt } from '../lib/numbers';
import { clipSource, clipSrc, clipTickAt, clipWhen, type ClipEntry, type ReplayEntry, type VideoEntry } from './registry';
import { ProgressWatch, STALL_MS } from './watchdog';
import styles from './Clip.module.css';

/** rest: the poster; loading: asked to play, no frame yet; then playing or paused. */
type Phase = 'rest' | 'loading' | 'playing' | 'paused';

const SEEK_SECONDS = 1;

/** How near the screen a replay must come, in viewports, before the game cache starts downloading. */
const CACHE_MARGIN = '100% 0px';

/** What the frame can ask of the footage inside it beyond playing and pausing. */
export interface MediaHandle {
  /** Moves the playhead to this many ms into the window. */
  seek(ms: number): void;
}

/** The footage inside a frame: told whether to move, it reports what it is doing. */
export interface MediaProps<E extends ClipEntry> {
  entry: E;
  /** Whether the reader wants it moving. */
  playing: boolean;
  /** Frames are moving. */
  onPlaying(): void;
  /** It stopped by itself (the browser paused it). */
  onPaused(): void;
  /** Back to the poster: the playhead reached the end of the window, or another replay took the page's one 3D stage. */
  onEnded(): void;
  /** The playhead, in ms into the window. */
  onTime(ms: number): void;
  onFailed(message: string): void;
}

/**
 * Stands in for the replay when its module fails to load (a deploy since the page opened, which
 * reloads the page once through src/lib/deploy.ts, or the network) or it fails to render.
 */
const LoadFailed = forwardRef<MediaHandle, MediaProps<ReplayEntry>>(function LoadFailed({ onFailed }, _ref) {
  useEffect(() => onFailed('The replay failed to load'), [onFailed]);
  return null;
});

/* The 3D engine is most of the site's weight; it loads the first time a replay is played. */
const ReplayMedia = lazy(() =>
  import('../replay/Replay').catch((e: unknown) => {
    console.error(e);
    return { default: LoadFailed };
  }),
);

/**
 * Starts the shared world's game-cache download, and the engine's code with it, when a replay first
 * comes within a viewport of the screen. Skipped when the reader's browser asks to save data.
 */
function useCacheNearView(entry: ClipEntry, el: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const node = el.current;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    if (entry.kind !== 'replay' || !node || saveData || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        performance.mark('replay:cache-near-view');
        // A dynamic import, so the page's own chunk stays free of the engine. A failure here is
        // reported by the replay itself if the reader plays it.
        import('../replay/world').then((m) => m.prefetch()).catch((e: unknown) => console.warn('Replay prefetch failed', e));
      },
      { rootMargin: CACHE_MARGIN },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [entry, el]);
}

/**
 * A 10-15 s piece of footage at the full width of its column, in one frame whether it is a video
 * file or a window of the 3D replay: the poster and one play mark at rest; on play, a hairline
 * progress rule in the accent that can be dragged to scrub, and the tick on screen where the
 * footage knows it. Click or Space plays and pauses, the arrows step a second, Home goes back to
 * the start. It never autoplays or loops, and it returns to the poster when it ends. A replay's
 * camera stays on the record account; the reader cannot move it. `zone` names the Pacific zone
 * after the recording time, where this clip's time is the first one on its page.
 */
export function Clip({ clip, className, zone }: { clip: ClipEntry; className?: string; zone?: boolean }) {
  const media = useRef<MediaHandle>(null);
  const figure = useRef<HTMLElement>(null);
  const rule = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>('rest');
  /** Whether the media has shown a frame since it last left the poster. */
  const [begun, setBegun] = useState(false);
  const [ms, setMs] = useState(0);
  const [error, setError] = useState<string>();
  const [scrubbing, setScrubbing] = useState(false);
  const captionId = useId();
  const total = clip.seconds * 1000;
  const playing = phase === 'loading' || phase === 'playing';
  // A video element is cheap and stays; a replay holds a WebGL context and workers, so it exists only off the poster.
  const mounted = clip.kind === 'video' || phase !== 'rest';

  useCacheNearView(clip, figure);

  const toggle = () => {
    if (playing) setPhase('paused');
    else {
      setError(undefined);
      setPhase(phase === 'rest' ? 'loading' : 'playing');
    }
  };

  const seek = (to: number) => {
    if (phase === 'rest') return;
    const t = Math.min(Math.max(to, 0), total);
    media.current?.seek(t);
    setMs(t);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') toggle();
    else if (e.key === 'ArrowLeft') seek(ms - SEEK_SECONDS * 1000);
    else if (e.key === 'ArrowRight') seek(ms + SEEK_SECONDS * 1000);
    else if (e.key === 'Home') seek(0);
    else return;
    e.preventDefault();
  };

  const toRest = () => {
    media.current?.seek(0);
    setMs(0);
    setBegun(false);
    setPhase('rest');
  };

  const msAt = (clientX: number) => {
    const box = rule.current!.getBoundingClientRect();
    return (Math.min(Math.max((clientX - box.left) / box.width, 0), 1)) * total;
  };
  const scrubDown = (e: PointerEvent<HTMLDivElement>) => {
    if (phase === 'rest') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setScrubbing(true);
    seek(msAt(e.clientX));
  };
  const scrubMove = (e: PointerEvent<HTMLDivElement>) => scrubbing && seek(msAt(e.clientX));
  const scrubUp = () => setScrubbing(false);

  const mediaProps = {
    playing,
    onPlaying: () => {
      setBegun(true);
      setPhase((p) => (p === 'loading' ? 'playing' : p));
    },
    onPaused: () => setPhase((p) => (p === 'rest' ? p : 'paused')),
    onEnded: toRest,
    onTime: setMs,
    onFailed: (message: string) => {
      setError(message);
      setMs(0);
      setBegun(false);
      setPhase('rest');
    },
  };

  const progress = Math.min(ms / total, 1);
  const tick = clipTickAt(clip, ms);

  return (
    <figure
      ref={figure}
      className={[styles.clip, className].filter(Boolean).join(' ')}
      data-phase={phase}
      data-embed={clip.id}
      data-kind={clip.kind}
    >
      <div
        className={styles.frame}
        style={{ aspectRatio: `${clip.width} / ${clip.height}` }}
        role="button"
        tabIndex={0}
        aria-label={phase === 'playing' ? 'Pause the clip' : 'Play the clip'}
        aria-describedby={captionId}
        aria-keyshortcuts="Space ArrowLeft ArrowRight Home"
        aria-busy={phase === 'loading'}
        onClick={toggle}
        onKeyDown={onKeyDown}
      >
        {mounted &&
          (clip.kind === 'video' ? (
            <VideoMedia ref={media} entry={clip} {...mediaProps} />
          ) : (
            <Contained fallback={<LoadFailed entry={clip} {...mediaProps} />}>
              <Suspense fallback={null}>
                <ReplayMedia ref={media} entry={clip} {...mediaProps} />
              </Suspense>
            </Contained>
          ))}
        {(phase === 'rest' || !begun) && (
          <img className={styles.poster} src={clip.poster} alt="" width={clip.width} height={clip.height} loading="lazy" />
        )}
        {phase !== 'playing' && <span className={styles.play} aria-hidden="true" />}
        {error && (
          <p role="alert" className={styles.message}>
            {error}
          </p>
        )}
      </div>
      <div
        ref={rule}
        className={styles.scrub}
        aria-hidden="true"
        onPointerDown={scrubDown}
        onPointerMove={scrubMove}
        onPointerUp={scrubUp}
        onPointerCancel={scrubUp}
      >
        <div className={styles.rule}>
          <div className={styles.fill} style={{ transform: `scaleX(${progress})` }} />
        </div>
      </div>
      <figcaption className={styles.caption} id={captionId}>
        <span className={styles.what}>{clip.caption}</span>
        <span className={styles.when}>
          {clipWhen(clip, zone)} · {clip.step} · {clipSource(clip)}
        </span>
        {tick !== undefined && (
          <span className={styles.tick} aria-hidden={phase === 'rest'}>
            tick <span className={styles.tickNum}>{fmtInt(tick)}</span>
          </span>
        )}
      </figcaption>
    </figure>
  );
}

/**
 * A video file, with the browser's own controls never shown. A file that fails to load (a 404, a
 * refused range) or stops arriving fails the frame visibly, never an indefinite dimmed mark.
 */
const VideoMedia = forwardRef<MediaHandle, MediaProps<VideoEntry>>(function VideoMedia(
  { entry, playing, onPlaying, onPaused, onEnded, onTime, onFailed },
  ref,
) {
  const video = useRef<HTMLVideoElement>(null);
  const watch = useRef(new ProgressWatch());
  const moved = () => watch.current.moved(performance.now());

  useImperativeHandle(ref, () => ({
    seek: (ms) => {
      if (video.current) video.current.currentTime = ms / 1000;
    },
  }));

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (!playing) {
      watch.current.rest();
      v.pause();
      return;
    }
    watch.current.watch(performance.now());
    v.play().catch((e: unknown) => {
      // A pause before the first frame interrupts play(); that is the reader's doing, not a failure.
      if (!(e instanceof DOMException && e.name === 'AbortError')) onFailed('The clip failed to play');
    });
    // Follow the playhead every frame while playing, so the rule and the tick move with the picture.
    let raf = requestAnimationFrame(function follow() {
      onTime(v.currentTime * 1000);
      raf = requestAnimationFrame(follow);
    });
    const stall = setInterval(() => {
      if (!watch.current.stalled(performance.now())) return;
      watch.current.rest();
      console.error(`Clip ${entry.id} stalled: no progress for ${STALL_MS / 1000} s`);
      onFailed('The clip stopped loading. Play it to try again.');
    }, 1000);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(stall);
    };
    // The callbacks only set the frame's state, so the ones from when play began serve throughout.
  }, [playing]);

  return (
    <video
      ref={video}
      src={clipSrc(entry)}
      poster={entry.poster}
      width={entry.width}
      height={entry.height}
      preload="none"
      muted
      playsInline
      disablePictureInPicture
      onPlaying={() => {
        moved();
        onPlaying();
      }}
      onProgress={moved}
      onTimeUpdate={moved}
      onLoadedData={moved}
      onPause={(e) => !e.currentTarget.ended && onPaused()}
      onEnded={onEnded}
      onSeeked={(e) => {
        moved();
        onTime(e.currentTarget.currentTime * 1000);
      }}
      onError={() => {
        watch.current.rest();
        onFailed('The clip failed to load');
      }}
    />
  );
});
