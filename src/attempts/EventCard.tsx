import type { EventType } from '../data/types';
import { fmtUtcDayShort, fmtUtcHm, parseUtc } from '../lib/time';
import type { Mark } from './model';
import styles from './EventCard.module.css';

export const TYPE_LABEL: Record<EventType, string> = {
  start: 'Start',
  stop: 'Stop',
  ruling: 'Ruling',
  operator: 'Operator',
  recovery: 'Recovery',
  death: 'Death',
  note: 'Note',
  logout: 'Logout',
  result: 'Result',
};

interface Props {
  mark: Mark;
  attemptName: string;
  compact?: boolean;
}

/** One timeline event: what kind, when, and the JSON's own words for it. */
export function EventCard({ mark, attemptName, compact = false }: Props) {
  const e = mark.event;
  const t = parseUtc(e.utc);
  return (
    <div className={compact ? styles.compact : styles.card}>
      <p className={styles.meta}>
        <span className={styles.type} data-type={e.type}>
          {TYPE_LABEL[e.type]}
        </span>
        <span>{attemptName}</span>
        <time dateTime={e.utc}>
          {fmtUtcDayShort(t)}, {fmtUtcHm(t)} UTC
        </time>
      </p>
      <p className={styles.title}>{e.title}</p>
      {e.quote && <blockquote className={e.type === 'operator' ? styles.said : styles.verbatim}>{e.quote}</blockquote>}
      {e.cause_verbatim && <blockquote className={styles.verbatim}>{e.cause_verbatim}</blockquote>}
    </div>
  );
}
