import { clipSource, clipWhen } from '../clips/registry';
import type { StillStrip as Strip } from './model';
import styles from './StillStrip.module.css';

/** A card's frames in place of a clip: two by two, in order, with the clip's caption line. */
export function StillStrip({ strip, zone }: { strip: Strip; zone?: boolean }) {
  return (
    <figure className={styles.strip}>
      <ol className={styles.frames}>
        {strip.frames.map((f) => (
          <li key={f.src}>
            <img src={f.src} alt={f.alt} width={strip.width} height={strip.height} loading="lazy" />
          </li>
        ))}
      </ol>
      <figcaption className={styles.caption}>
        <span>{strip.caption}</span>
        <span className={styles.when}>
          {clipWhen(strip, zone)} · {strip.step} · {clipSource(strip)}
        </span>
      </figcaption>
    </figure>
  );
}
