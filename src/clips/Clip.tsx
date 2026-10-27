import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { clipWhen, tickAt, type ClipEntry } from './registry';
import styles from './Clip.module.css';

/** rest: the poster; loading: asked to play, no frame yet; then playing or paused. */
type Phase = 'rest' | 'loading' | 'playing' | 'paused';

const SEEK_SECONDS = 1;

/**
 * A short silent game clip at the full width of its column, with the site's own
 * controls: the poster and one play mark at rest; on play, a hairline progress rule
 * in the accent and, for a lab clip, the server tick. Click or Space plays and pauses,
 * the arrows step a second. It never autoplays or loops, and it returns to the poster
 * when it ends. `zone` names the Pacific zone after the recording time, where this
 * clip's time is the first one on its page.
 */
export function Clip({ clip, className, zone }: { clip: ClipEntry; className?: string; zone?: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const [phase, setPhase] = useState<Phase>('rest');
  const [ms, setMs] = useState(0);
  const captionId = useId();

  // Follow the playhead every frame while playing, so the rule and the tick move with the picture.
  useEffect(() => {
    if (phase !== 'playing') return;
    let raf = 0;
    const follow = () => {
      if (video.current) setMs(video.current.currentTime * 1000);
      raf = requestAnimationFrame(follow);
    };
    raf = requestAnimationFrame(follow);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  const toggle = () => {
    const v = video.current;
    if (!v) return;
    if (phase === 'playing' || phase === 'loading') {
      v.pause();
      return;
    }
    if (phase === 'rest') setPhase('loading');
    v.play().catch(() => setPhase('rest'));
  };

  const seek = (by: number) => {
    const v = video.current;
    if (!v || phase === 'rest') return;
    v.currentTime = Math.min(Math.max(v.currentTime + by, 0), clip.seconds);
    setMs(v.currentTime * 1000);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') toggle();
    else if (e.key === 'ArrowLeft') seek(-SEEK_SECONDS);
    else if (e.key === 'ArrowRight') seek(SEEK_SECONDS);
    else return;
    e.preventDefault();
  };

  const toRest = () => {
    const v = video.current;
    if (v) v.currentTime = 0;
    setMs(0);
    setPhase('rest');
  };

  const progress = Math.min(ms / (clip.seconds * 1000), 1);
  const started = phase !== 'rest';

  return (
    <figure className={[styles.clip, className].filter(Boolean).join(' ')} data-phase={phase}>
      <div
        className={styles.frame}
        style={{ aspectRatio: `${clip.width} / ${clip.height}` }}
        role="button"
        tabIndex={0}
        aria-label={phase === 'playing' ? 'Pause the clip' : 'Play the clip'}
        aria-describedby={captionId}
        aria-keyshortcuts="Space ArrowLeft ArrowRight"
        onClick={toggle}
        onKeyDown={onKeyDown}
      >
        <video
          ref={video}
          src={clip.src}
          poster={clip.poster}
          width={clip.width}
          height={clip.height}
          preload="none"
          muted
          playsInline
          disablePictureInPicture
          onPlaying={() => setPhase('playing')}
          onPause={(e) => !e.currentTarget.ended && setPhase('paused')}
          onEnded={toRest}
          onSeeked={(e) => setMs(e.currentTarget.currentTime * 1000)}
        />
        {(phase === 'rest' || phase === 'loading') && (
          <img className={styles.poster} src={clip.poster} alt="" width={clip.width} height={clip.height} loading="lazy" />
        )}
        {phase !== 'playing' && <span className={styles.play} aria-hidden="true" />}
      </div>
      <div className={styles.rule} aria-hidden="true">
        <div className={styles.fill} style={{ transform: `scaleX(${progress})` }} />
      </div>
      <figcaption className={styles.caption} id={captionId}>
        <span className={styles.what}>{clip.caption}</span>
        <span className={styles.when}>
          {clipWhen(clip, zone)} · {clip.step}
        </span>
        {clip.ticks && (
          <span className={styles.tick} aria-hidden={!started}>
            tick <span className={styles.tickNum}>{tickAt(clip.ticks, ms)}</span>
          </span>
        )}
      </figcaption>
    </figure>
  );
}
