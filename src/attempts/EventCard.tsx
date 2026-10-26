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

/** What a mark says in plain words: the plain line, or for an operator message, the message itself. */
export function plainLine(m: Mark): string {
  const said = m.event.type === 'operator' ? m.event.quote : undefined;
  return plainFor(m.attemptId, m.event.utc) ?? said ?? m.event.title;
}

/**
 * A drawn mark in full: what kind, when, what happened in plain words, and the
 * swarm's own words beneath as the receipt.
 */
export function EventCard({ mark, attemptName }: { mark: Mark; attemptName: string }) {
  const e = mark.event;
  const t = parseUtc(e.utc);
  const said = e.type === 'operator' ? e.quote : undefined;
  const receipt = said ? undefined : (e.quote ?? e.cause_verbatim);
  return (
    <div className={styles.card}>
      <p className={styles.meta}>
        <span className={styles.type} data-type={e.type}>
          {TYPE_LABEL[e.type]}
        </span>
        <span>{attemptName}</span>
        <time dateTime={e.utc}>
          {fmtUtcDayShort(t)}, {fmtUtcHm(t)} UTC
        </time>
      </p>
      {said ? <blockquote className={styles.said}>{said}</blockquote> : <p className={styles.title}>{plainLine(mark)}</p>}
      {receipt && <blockquote className={styles.verbatim}>{receipt}</blockquote>}
    </div>
  );
}

/** The undrawn events around a mark, one dated line each. */
export function EventList({ marks }: { marks: Mark[] }) {
  if (!marks.length) return null;
  return (
    <ol className={styles.list}>
      {marks.map((m) => (
        <li key={m.key}>
          <time className={styles.listTime} dateTime={m.event.utc}>
            {fmtUtcHm(m.t)}
          </time>
          <span className={m.event.type === 'operator' ? styles.listSaid : undefined}>{plainLine(m)}</span>
        </li>
      ))}
    </ol>
  );
}
