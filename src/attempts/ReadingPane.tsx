import type { ChartAnchors, ChartModel, Mark } from './model';
import { EventCard, EventList } from './EventCard';
import styles from './ReadingPane.module.css';

interface Props {
  model: ChartModel;
  anchors: ChartAnchors;
  /** The mark shown: the previewed one while scrubbing, else the pinned one. */
  shown: Mark | null;
  /** The pinned mark, which Earlier and Later step from. */
  pinned: Mark | null;
  onSelect: (m: Mark) => void;
}

/** The shown mark in full, with the undrawn events that led up to it and followed it. */
export function ReadingPane({ model, anchors, shown, pinned, onSelect }: Props) {
  const list = anchors.list;
  const i = pinned ? list.findIndex((m) => m.key === pinned.key) : -1;
  const prev = list[i - 1];
  const next = list[i + 1];
  const am = shown ? model.byId.get(shown.attemptId) : undefined;
  const group = shown ? anchors.groups.get(shown.key) : undefined;
  return (
    <section className={styles.pane} aria-label="Selected event">
      <nav className={styles.nav} aria-label="Marked events">
        <button type="button" disabled={!prev} onClick={() => prev && onSelect(prev)}>
          ← Earlier
        </button>
        <span className={styles.position}>
          {i + 1} of {list.length}
        </span>
        <button type="button" disabled={!next} onClick={() => next && onSelect(next)}>
          Later →
        </button>
      </nav>
      <div className={styles.body} aria-live="polite">
        {shown && am && (
          <>
            <EventCard mark={shown} attemptName={am.attempt.name} />
            <div className={styles.context}>
              <EventList marks={[...(group?.before ?? []), ...(group?.after ?? [])]} />
            </div>
          </>
        )}
      </div>
    </section>
  );
}
