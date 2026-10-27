import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { timeline } from '../data/timeline';
import { buildChartModel, recordFacts } from '../attempts/model';
import { Threaded } from '../components/Coded';
import { registerItalic } from '../lib/fonts';
import { fmtInt } from '../lib/numbers';
import { inlineTokens } from '../story/draft';
import { story } from '../story/story';
import { storySections } from '../story/sections';
import { StoryFigure } from '../story/StoryFigure';
import { RunTree } from '../tree/RunTree';
import styles from './StoryPage.module.css';

/** The band near the top of the viewport whose section counts as the one being read. */
const READING_BAND = '0px 0px -65% 0px';

interface Needle {
  text: string;
  wrap: (text: string, key: number) => ReactNode;
}

/** The text with each occurrence of a needle wrapped; every character of the text is kept, in order. */
function mark(text: string, needles: readonly Needle[]): ReactNode[] {
  const out: ReactNode[] = [];
  let rest = text;
  for (let k = 0; ; k++) {
    let best: { at: number; n: Needle } | null = null;
    for (const n of needles) {
      const at = rest.indexOf(n.text);
      if (at >= 0 && (!best || at < best.at)) best = { at, n };
    }
    if (!best) {
      if (rest) out.push(rest);
      return out;
    }
    if (best.at) out.push(rest.slice(0, best.at));
    out.push(best.n.wrap(best.n.text, k));
    rest = rest.slice(best.at + best.n.text.length);
  }
}

/** A prose string with its `code` and *emphasis* set, and the needles marked in its plain runs. */
function prose(text: string, needles: readonly Needle[] = []): ReactNode[] {
  return inlineTokens(text).map((t, i) =>
    t.kind === 'code' ? (
      <code key={i}>{t.text}</code>
    ) : t.kind === 'em' ? (
      <em key={i}>{t.text}</em>
    ) : (
      <Fragment key={i}>{mark(t.text, needles)}</Fragment>
    ),
  );
}

export function StoryPage() {
  const record = recordFacts(timeline);
  const model = useMemo(() => buildChartModel(timeline), []);
  const sections = useMemo(() => storySections(story), []);
  const headRef = useRef<HTMLElement>(null);
  const sectionRefs = useRef(new Map<string, HTMLElement>());
  const [active, setActive] = useState<string | null>(null);
  const [headInView, setHeadInView] = useState(true);

  /** The record numbers carry the accent where a heading names them. */
  const accents: Needle[] = [fmtInt(record.final), `${fmtInt(record.margin)} ticks`].map((text) => ({
    text,
    wrap: (t, k) => (
      <span key={k} className={styles.number}>
        {t}
      </span>
    ),
  }));

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

  const pinned = headInView ? null : (sections.find((s) => s.id === active) ?? null);

  return (
    <article className={styles.page}>
      <div className={styles.pinned} data-visible={pinned ? true : undefined} aria-hidden="true">
        {pinned && (
          <div className={styles.pinnedInner}>
            <span className={styles.pinnedNum}>{pinned.number}</span>
            <span className={styles.pinnedTitle}>{pinned.title}</span>
            <span className={styles.pinnedDate}>{pinned.dates}</span>
          </div>
        )}
      </div>

      <div className={styles.opening}>
        <RunTree className={styles.tree} onSettled={registerItalic} />
        <header ref={headRef} className={styles.head}>
          <h1 className={styles.title}>{prose(story.title)}</h1>
          <p className={styles.byline}>{prose(story.byline)}</p>
        </header>
      </div>

      {sections.map((s) => {
        const links: Needle[] = s.links.map((l) => ({
          text: l.text,
          wrap: (t, k) => (
            <a key={k} href={l.href} target="_blank" rel="noreferrer">
              {t}
            </a>
          ),
        }));
        return (
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
              <span className={styles.sectionNum}>{s.number}</span>
              <h2 className={styles.sectionTitle}>{prose(s.title, accents)}</h2>
              <time className={styles.sectionDate}>{s.dates}</time>
            </header>

            {s.blocks.map((b, j) => {
              const pulled = s.pulledAt.get(j);
              const figures = s.figuresAt.get(j) ?? [];
              return (
                <Fragment key={j}>
                  {b.kind === 'p' ? (
                    <p className={styles.prose}>{prose(b.text, links)}</p>
                  ) : (
                    <blockquote className={styles.quotation}>
                      {b.paragraphs.map((p, k) => (
                        <p key={k}>{prose(p, links)}</p>
                      ))}
                    </blockquote>
                  )}
                  {/* The same words are in the paragraph; the margin repeats them for the eye only. */}
                  {pulled && (
                    <aside className={styles.margin} aria-hidden="true">
                      {pulled.map((q) => (
                        <blockquote key={q} className={styles.pulled}>
                          {q}
                        </blockquote>
                      ))}
                    </aside>
                  )}
                  {figures.map((f, k) => (
                    <StoryFigure key={k} figure={f} model={model} record={record} />
                  ))}
                </Fragment>
              );
            })}

            <details className={styles.sources}>
              <summary>Sources</summary>
              <div className={styles.sourceText}>
                {s.sources.map((line, k) => (
                  <p key={k}>
                    <Threaded text={line} />
                  </p>
                ))}
              </div>
            </details>
          </section>
        );
      })}
    </article>
  );
}
