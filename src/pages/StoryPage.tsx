import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { timeline } from '../data/timeline';
import { buildChartModel, headlineFacts, recordFacts } from '../attempts/model';
import { fmtInt } from '../lib/numbers';
import { fmtDuration } from '../lib/time';
import { storySections } from '../story/sections';
import styles from './StoryPage.module.css';

/** The band near the top of the viewport whose section counts as the one being read. */
const READING_BAND = '0px 0px -65% 0px';

export function StoryPage() {
  const record = recordFacts(timeline);
  const facts = useMemo(() => headlineFacts(buildChartModel(timeline)), []);
  const sections = useMemo(() => storySections(record, facts), [record, facts]);
  const headRef = useRef<HTMLElement>(null);
  const sectionRefs = useRef(new Map<string, HTMLElement>());
  const [active, setActive] = useState<string | null>(null);
  const [headInView, setHeadInView] = useState(true);

  useEffect(() => {
    document.title = 'rune.fast';
  }, []);

  useEffect(() => {
    const head = headRef.current;
    if (!head) return;
    const io = new IntersectionObserver(([e]) => setHeadInView(e?.isIntersecting ?? false));
    io.observe(head);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const inBand = new Set<string>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = (e.target as HTMLElement).dataset.section!;
          if (e.isIntersecting) inBand.add(id);
          else inBand.delete(id);
        }
        setActive(sections.findLast((s) => inBand.has(s.id))?.id ?? null);
      },
      { rootMargin: READING_BAND },
    );
    sectionRefs.current.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [sections]);

  const current = sections.findIndex((s) => s.id === active);
  const pinned = !headInView && current >= 0 ? sections[current] : null;

  return (
    <article className={styles.page}>
      <div className={styles.pinned} data-visible={pinned ? true : undefined} aria-hidden="true">
        {pinned && (
          <div className={styles.pinnedInner}>
            <span className={styles.pinnedNum}>{current + 1}</span>
            <span className={styles.pinnedTitle}>{pinned.title}</span>
            <span className={styles.pinnedDate}>{pinned.dates}</span>
          </div>
        )}
      </div>

      <header ref={headRef} className={styles.head}>
        <p className={styles.kicker}>The story</p>
        <h1 className={styles.title}>
          All 19 skills at 99 in <span className={styles.number}>{fmtInt(record.final)}</span> ticks
        </h1>
        <p className={styles.dek}>
          An agent swarm set the fastest-to-99 record on the 2004scape demo server:{' '}
          {fmtDuration(record.final * record.tickMs, true)} of logged-in time, {fmtInt(record.margin)} ticks ahead of the
          record it beat.
        </p>
        <p className={styles.byline}>
          Narrated by the documenting agent, which reviewed the swarm with the same resources the swarm used: 900 issues,
          35,598 messages, 437,012 transcript events, the lab, and the world feed.
        </p>
      </header>

      {sections.map((s, i) => (
        <section
          key={s.id}
          id={s.id}
          data-section={s.id}
          ref={(el) => {
            if (el) sectionRefs.current.set(s.id, el);
            else sectionRefs.current.delete(s.id);
          }}
          className={styles.section}
        >
          <header className={styles.sectionHead}>
            <span className={styles.sectionNum}>{i + 1}</span>
            <h2 className={styles.sectionTitle}>{s.title}</h2>
            <time className={styles.sectionDate}>{s.dates}</time>
          </header>
          <p className={styles.prose}>{s.notes.join(' ')}</p>
          <figure className={styles.slot}>
            {s.figure ? (
              <Link to={s.figure.to} className={styles.slotLink}>
                {s.figure.label} →
              </Link>
            ) : (
              <span className={styles.slotLabel}>Figure</span>
            )}
          </figure>
        </section>
      ))}
    </article>
  );
}
