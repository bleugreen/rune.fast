import type { EventType } from '../data/types';
import { fmtUtcDayShort, fmtUtcHm, parseUtc } from '../lib/time';
import { plainFor } from '../data/plain';
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

/**
 * One timeline event: what kind, when, what happened in plain words, and (in the
 * full card) the swarm's own words as the receipt.
 */
export function EventCard({ mark, attemptName, compact = false }: Props) {
  const e = mark.event;
  const t = parseUtc(e.utc);
  const plain = plainFor(mark.attemptId, e.utc);
  const said = e.type === 'operator' && e.quote;
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
      {plain && <p className={styles.title}>{plain}</p>}
      {said && <blockquote className={styles.said}>{e.quote}</blockquote>}
      {!compact && !said && (e.quote ?? e.cause_verbatim) && (
        <blockquote className={styles.verbatim}>{e.quote ?? e.cause_verbatim}</blockquote>
      )}
    </div>
  );
}
