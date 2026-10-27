import type { ReactNode } from 'react';
import { figureById, figureSrc, rendition } from '../../figures/registry';
import { countWord } from '../../lib/numbers';
import { fmtPacificDayLong, fmtPacificHm, pacificZone } from '../../lib/time';
import type { HarnessModel } from '../model';
import styles from './Figures.module.css';

export const SCREEN_FIGURE = 'operator-screen';

const ROLES = ['planner', 'builder', 'coordinator'] as const;

const orWords = (xs: readonly string[]) => (xs.length < 2 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} or ${xs.at(-1)}`);

/**
 * The operator's own screen during the run, ahead of every diagram: a reader who pictures one agent
 * in one terminal sees the panes side by side. At column width the panes' text cannot be read, so
 * the image opens the full-size rendition. Its caption is the page's first clock time, so it names
 * the zone.
 */
export function OperatorScreen({ m, className, children }: { m: HarnessModel; className?: string; children?: ReactNode }) {
  const f = figureById(SCREEN_FIGURE);
  const avif = rendition(f, 'column', 'image/avif');
  const jpeg = rendition(f, 'column', 'image/jpeg');
  const full = figureSrc(rendition(f, 'full'));
  const { t, panes } = m.screen;
  const roles = ROLES.filter((r) => panes.some((p) => p.role === r));
  const threads = panes.filter((p) => p.role === 'thread');
  return (
    <figure className={[styles.screen, className].filter(Boolean).join(' ')}>
      <a className={styles.screenLink} href={full} target="_blank" rel="noopener">
        <picture>
          <source type="image/avif" srcSet={figureSrc(avif)} />
          <img src={figureSrc(jpeg)} width={jpeg.width} height={jpeg.height} alt={f.alt} decoding="async" />
        </picture>
      </a>
      <figcaption className={styles.screenCaption}>
        <span>
          The operator’s screen at {fmtPacificHm(t)} {pacificZone(t)} on {fmtPacificDayLong(t)}:{' '}
          {countWord(panes.length)} of the swarm’s agents side by side. Each pane is one issue’s {orWords(roles)}
          {threads.length === 1 && (
            <>
              , and one is the <code>{threads[0]!.pane}</code> thread
            </>
          )}
          .
        </span>
        <span className={styles.screenNote}>
          <a href={full} target="_blank" rel="noopener">
            Open the screen full size
          </a>{' '}
          to read the panes.
        </span>
      </figcaption>
      {children}
    </figure>
  );
}
