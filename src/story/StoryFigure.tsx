import { Link } from 'react-router-dom';
import type { ChartAnchors, ChartModel, RecordFacts } from '../attempts/model';
import { Legend, TimelineChart } from '../attempts/TimelineChart';
import { fmtUtcDate, fmtUtcDateRange, parseUtc } from '../lib/time';
import { TicksLadder } from './TicksLadder';
import type { StoryFigure as Figure } from './sections';
import styles from './StoryFigure.module.css';

/** Named for the public leaderboard fact only (the operator's ruling on rival players). */
const PREVIOUS_HOLDER = 'stunbaron';

interface Props {
  figure: Figure;
  model: ChartModel;
  anchors: ChartAnchors;
  record: RecordFacts;
  className?: string;
}

export function StoryFigure({ figure, model, anchors, record, className }: Props) {
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
      return (
        <figure className={cls(styles.slot, className)}>
          <Link to="/tricks" className={styles.slotLink}>
            The tricks, measured →
          </Link>
        </figure>
      );
    case 'cost':
      return (
        <figure className={cls(styles.slot, className)}>
          <Link to="/cost" className={styles.slotLink}>
            What each day cost →
          </Link>
        </figure>
      );
    case 'timeline': {
      const crop = [parseUtc(figure.crop[0]), parseUtc(figure.crop[1])] as const;
      const sameDay = figure.crop[0].slice(0, 10) === figure.crop[1].slice(0, 10);
      return (
        <figure className={cls(styles.figure, className)}>
          <figcaption className={styles.caption}>
            <span className={styles.chartTitle}>Logged-in time, {sameDay ? fmtUtcDate(crop[0]) : fmtUtcDateRange(...crop)}</span>
            <Legend />
          </figcaption>
          <TimelineChart model={model} anchors={anchors} finishTicks={record.final} crop={crop} />
          <Link to="/attempts" className={styles.more}>
            The full timeline →
          </Link>
        </figure>
      );
    }
  }
}
