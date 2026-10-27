import { useEffect, useMemo } from 'react';
import { timeline } from '../data/timeline';
import { fmtInt } from '../lib/numbers';
import { fmtPacificDayLong, pacificZone, parseUtc } from '../lib/time';
import { route } from '../route/data';
import { DriftChart } from '../route/DriftChart';
import type { Route } from '../route/model';
import { finishWords, LEDGER_WORDS, opening, WORDS, type OpeningFacts } from '../route/prose';
import { Rail, Strip } from '../route/Rail';
import { StepSection } from '../route/StepSection';
import { ClockContext, ReadingClock } from '../route/useReadingTick';
import { story } from '../story/story';
import { storySections } from '../story/sections';
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
  return { start: parseUtc(a5.start.utc), last99: parseUtc(last99.utc), quote: QUOTED };
}

/** 'Saturday 24 October', 'Monday': the second date drops what the first already said. */
function days(f: OpeningFacts): { start: string; end: string } {
  const start = fmtPacificDayLong(f.start);
  return { start, end: fmtPacificDayLong(f.last99).split(' ')[0]! };
}

function Ledger({ r }: { r: Route }) {
  const rows: [string, number][] = [
    [LEDGER_WORDS.swarm!, r.ledger.swarm],
    ...r.ledger.terms.map((t) => [LEDGER_WORDS[t.id]!, t.ticks] as [string, number]),
    [LEDGER_WORDS.hiscore!, r.ledger.hiscore],
  ];
  return (
    <table className={styles.ledger}>
      <tbody>
        {rows.map(([label, ticks]) => (
          <tr key={label}>
            <td>{label}</td>
            <td>{ticks < 0 ? `−${fmtInt(-ticks)}` : fmtInt(ticks)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function RoutePage() {
  const clock = useMemo(() => new ReadingClock(route.finish), []);
  const facts = useMemo(() => openingFacts(timeline), []);
  const storyTitles = useMemo(() => new Map(storySections(story).map((s) => [s.id, s.title])), []);
  const finish = finishWords(route);

  useEffect(() => {
    document.title = 'Route · rune.fast';
  }, []);

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
              <p className={styles.dek}>Attempt 5 step by step, on the clock the hiscore keeps.</p>
              {opening(route, facts, days(facts), pacificZone(facts.start)).map((text, i) => (
                <p key={i} className={styles.prose}>
                  {text}
                </p>
              ))}
            </header>

            {route.steps.map((s) => (
              <StepSection key={s.spec.id} step={s} route={route} words={WORDS[s.spec.id]!} storyTitles={storyTitles} planned={PLANNED_BREAKS} />
            ))}

            <section className={styles.finish} aria-labelledby="finish-title">
              <p className={styles.kicker}>The finish</p>
              <h2 id="finish-title" className={styles.finishTitle}>
                Agility 99, and the two clocks
              </h2>
              {finish.before.map((text, i) => (
                <p key={i} className={styles.prose}>
                  {text}
                </p>
              ))}
              <DriftChart route={route} />
              {finish.middle.map((text, i) => (
                <p key={i} className={styles.prose}>
                  {text}
                </p>
              ))}
              <Ledger r={route} />
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
