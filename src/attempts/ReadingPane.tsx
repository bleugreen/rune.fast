import type { ChartModel, Mark } from './model';
import { EventCard } from './EventCard';
import styles from './ReadingPane.module.css';

interface Props {
  model: ChartModel;
  mark: Mark | null;
  onSelect: (m: Mark) => void;
}

/** The selected event in full, with its neighbours in the same attempt one step away. */
export function ReadingPane({ model, mark, onSelect }: Props) {
  if (!mark) return null;
  const am = model.byId.get(mark.attemptId);
  if (!am) return null;
  const i = am.marks.findIndex((m) => m.key === mark.key);
  const prev = am.marks[i - 1];
  const next = am.marks[i + 1];
  return (
    <section className={styles.pane} aria-live="polite" aria-label="Selected event">
      <EventCard mark={mark} attemptName={am.attempt.name} />
      <nav className={styles.nav} aria-label="Events in this attempt">
        <button type="button" disabled={!prev} onClick={() => prev && onSelect(prev)}>
          ← Earlier
        </button>
        <span className={styles.position}>
          {i + 1} of {am.marks.length} in {am.shortName}
        </span>
        <button type="button" disabled={!next} onClick={() => next && onSelect(next)}>
          Later →
        </button>
      </nav>
    </section>
  );
}
