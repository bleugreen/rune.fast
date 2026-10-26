import type { EventType } from '../data/types';
import { fmtPacific, fmtUtcDayShort, parseUtc, storedClock } from '../lib/time';
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

/** One timeline event, exactly as the JSON records it. */
export function EventCard({ mark, attemptName, compact = false }: Props) {
  const e = mark.event;
  const t = parseUtc(e.utc);
  return (
    <div className={compact ? styles.compact : styles.card}>
      <div className={styles.meta}>
        <span className={styles.type} data-type={e.type}>
          {TYPE_LABEL[e.type]}
        </span>
        <time className={styles.time} dateTime={e.utc}>
          {fmtUtcDayShort(t)} <span className={styles.clock}>{storedClock(e.utc)}</span> UTC
        </time>
        <span className={styles.pacific}>{fmtPacific(t)}</span>
        <span className={styles.attempt}>{attemptName}</span>
      </div>
      <div className={styles.body}>
        <p className={styles.title}>{e.title}</p>
        {e.quote && <blockquote className={e.type === 'operator' ? styles.said : styles.verbatim}>{e.quote}</blockquote>}
        {e.cause_verbatim && <blockquote className={styles.verbatim}>{e.cause_verbatim}</blockquote>}
        {e.detail && <p className={styles.aside}>{e.detail}</p>}
        {e.offline_note && <p className={styles.aside}>{e.offline_note}</p>}
        {e.note && <p className={styles.aside}>{e.note}</p>}
        {e.uncertain_why && (
          <p className={styles.aside}>
            <span className={styles.flag}>Uncertain</span> {e.uncertain_why}
          </p>
        )}
        <ul className={styles.sources}>
          {e.sources.map((s, i) => (
            <li key={i}>
              <code>
                {s.uri}
                {s.comment !== undefined && ` #${s.comment}`}
              </code>
              {s.ts && <span className={styles.sourceTs}> {s.ts}</span>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
