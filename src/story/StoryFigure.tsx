import { Link } from 'react-router-dom';
import type { ChartModel, RecordFacts } from '../attempts/model';
import { Legend, TimelineChart } from '../attempts/TimelineChart';
import { Clip } from '../clips/Clip';
import { clipById } from '../clips/registry';
import { fmtPacificDateRange, fmtPacificDayMonYear, fmtPacificHm, parseUtc } from '../lib/time';
import { TicksLadder } from './TicksLadder';
import type { StoryFigure as Figure } from './sections';
import styles from './StoryFigure.module.css';

/** Named for the public leaderboard fact only (the operator's ruling on rival players). */
const PREVIOUS_HOLDER = 'stunbaron';

interface Props {
  figure: Figure;
  model: ChartModel;
  record: RecordFacts;
  className?: string;
}

export function StoryFigure({ figure, model, record, className }: Props) {
  const cls = (...c: (string | undefined)[]) => c.filter(Boolean).join(' ');
  switch (figure.kind) {
    case 'ladder':
      return (
        <figure className={cls(styles.figure, className)}>
          <TicksLadder
            record={{ label: `Previous record, ${PREVIOUS_HOLDER}`, ticks: record.previous }}
            run={{ label: 'This run', ticks: record.final }}
          />
        </figure>
      );
    case 'clip':
      return <Clip clip={clipById(figure.id)} className={cls(styles.figure, className)} />;
    case 'link':
      return (
        <figure className={cls(styles.slot, className)}>
          <Link to={figure.to} className={styles.slotLink}>
            {figure.text} →
          </Link>
        </figure>
      );
    case 'timeline': {
      const crop = [parseUtc(figure.crop[0]), parseUtc(figure.crop[1])] as const;
      return (
        <figure className={cls(styles.figure, className)}>
          <figcaption className={styles.caption}>
            <span className={styles.chartTitle}>Logged-in time, {fmtPacificDateRange(...crop)}</span>
            <Legend />
          </figcaption>
          <TimelineChart model={model} finishTicks={record.final} crop={crop} />
        </figure>
      );
    }
    case 'image': {
      const taken = parseUtc(figure.takenBefore);
      return (
        <figure className={cls(styles.figure, className)}>
          <picture>
            <source type="image/webp" srcSet={`${figure.src}.webp`} />
            <img
              className={styles.image}
              src={`${figure.src}.png`}
              width={figure.width}
              height={figure.height}
              alt={figure.alt}
              loading="lazy"
              decoding="async"
            />
          </picture>
          <figcaption className={styles.imageCaption}>
            <span>{figure.caption}</span>
            <span className={styles.when}>
              {figure.source}, {fmtPacificDayMonYear(taken)}, before {fmtPacificHm(taken)}
            </span>
          </figcaption>
        </figure>
      );
    }
  }
}
