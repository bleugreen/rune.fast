import { Link } from 'react-router-dom';
import { fmtDuration } from '../lib/time';
import type { Break as BreakModel, Route } from './model';
import { clockTime, groupWords, loginWords } from './prose';
import styles from './Route.module.css';

interface Props {
  brk: BreakModel;
  route: Route;
  /** The story section it links to: its anchor and its heading. */
  story: { id: string; title: string };
  /** A logout the plan made, which has no stop for the story to tell. */
  planned?: boolean;
}

/**
 * A logged-out break, one line for each logged-out stretch and each short login inside it. Every
 * line carries the ticks it covers (data-from, data-to): a logged-out line holds the clock, so the
 * spine breaks there, and a login line moves it on by the ticks the hiscore counted for it.
 */
export function Break({ brk, route, story, planned }: Props) {
  let cursor = brk.tick;
  const lines = brk.parts.flatMap((part, i) => {
    if (part.kind === 'in') {
      const from = cursor;
      cursor += part.login.ticks + part.login.unassigned;
      return [
        <p key={i} className={styles.breakIn} data-from={from} data-to={cursor}>
          Logged in at {clockTime(part.login.at)}: {loginWords(part.login, route)}.
        </p>,
      ];
    }
    const out = (
      <p key={i} className={styles.breakOut} data-from={cursor} data-to={cursor}>
        <b>Logged out {fmtDuration(part.to - part.from)}</b>, {clockTime(part.from)} to {clockTime(part.to)}
        {planned ? ', a planned logout between steps' : ''}
      </p>
    );
    if (!part.logins.length) return [out];
    const from = cursor;
    cursor += part.logins.reduce((s, l) => s + l.ticks + l.unassigned, 0);
    return [
      out,
      <p key={`${i}-in`} className={styles.breakIn} data-from={from} data-to={cursor}>
        Inside it, {groupWords(part.logins, route)}.
      </p>,
    ];
  });

  return (
    <aside className={styles.break} aria-label="Logged out">
      {lines}
      {!planned && (
        <p className={styles.breakLink}>
          <Link to={`/#${story.id}`}>What happened: the story, {story.title} →</Link>
        </p>
      )}
    </aside>
  );
}
