import { useMemo } from 'react';
import { timeline } from '../data/timeline';
import { parseUtc } from '../lib/time';
import { route } from '../route/data';
import { MAX_LEVEL } from '../route/log';
import { finishWords, opening, WORDS, type OpeningFacts } from '../route/prose';
import { Rail, Strip } from '../route/Rail';
import { StepSection } from '../route/StepSection';
import { ClockContext, ReadingClock } from '../route/useReadingTick';
import { story } from '../story/story';
import { storySections } from '../story/sections';
import { TicksLadder } from '../story/TicksLadder';
import type { Timeline } from '../data/types';
import styles from './RoutePage.module.css';

/** The operator's line the opening quotes, as the timeline keeps it. */
const QUOTED = 'wall clock is free, ticks are not';

/** The planned logout between the altar and the river: the one break with no stop behind it. */
const PLANNED_BREAKS: ReadonlySet<number> = new Set([5]);

export function openingFacts(t: Timeline): OpeningFacts {
  const a5 = t.attempts.find((a) => a.id === 'A5')!;
  const quote = a5.events.find((e) => e.quote?.includes(QUOTED));
  const last99 = a5.events.find((e) => e.type === 'result' && e.title.includes('all 19 skills 99'));
  if (!quote || !last99) throw new Error('The timeline no longer holds the opening’s quote or the last 99');
  return { name: a5.name, start: parseUtc(a5.start.utc), last99: parseUtc(last99.utc), quote: QUOTED };
}

/**
 * The page's first clip, as its step and id. The opening prints no clock time and no break comes
 * before it, so its caption is the first clock time on the open page (source lines wait behind
 * their disclosures), and it names the zone.
 */
function firstClip(): { step: string; clip: string } | undefined {
  for (const s of route.steps) {
    const b = WORDS[s.spec.id]!.body(s, route).find((x) => 'clip' in x);
    if (b && 'clip' in b) return { step: s.spec.id, clip: b.clip };
  }
}

export function RoutePage() {
  const clock = useMemo(() => new ReadingClock(route.finish), []);
  const facts = useMemo(() => openingFacts(timeline), []);
  const zoned = useMemo(firstClip, []);
  const storyTitles = useMemo(() => new Map(storySections(story).map((s) => [s.id, s.title])), []);
  const finish = finishWords(route);

  return (
    <ClockContext.Provider value={clock}>
      <article className={styles.page}>
        <div className={styles.stripCol}>
          <Strip route={route} />
        </div>
        <div className={styles.grid}>
          <div className={styles.flow}>
            <header className={styles.head}>
              <h1 className={styles.title}>The route</h1>
              <p className={styles.dek}>{facts.name} step by step, on the clock the hiscore keeps.</p>
              {opening(route, facts).map((text, i) => (
                <p key={i} className={styles.prose}>
                  {text}
                </p>
              ))}
            </header>

            {route.steps.map((s) => (
              <StepSection
                key={s.spec.id}
                step={s}
                route={route}
                words={WORDS[s.spec.id]!}
                storyTitles={storyTitles}
                planned={PLANNED_BREAKS}
                zoneClip={zoned?.step === s.spec.id ? zoned.clip : undefined}
              />
            ))}

            <section className={styles.finish} aria-labelledby="finish-title">
              <p className={styles.kicker}>The finish</p>
              <h2 id="finish-title" className={styles.finishTitle}>
                {`${route.stamps.at(-1)!.skill} ${MAX_LEVEL}, and the record`}
              </h2>
              <p className={styles.prose}>{finish}</p>
              <figure className={styles.record}>
                <TicksLadder record={{ label: 'The previous record', ticks: route.record }} run={{ label: facts.name, ticks: route.finish }} />
              </figure>
            </section>
          </div>
          <aside className={styles.railCol} aria-label="Where the run is">
            <Rail route={route} />
          </aside>
        </div>
      </article>
    </ClockContext.Provider>
  );
}
