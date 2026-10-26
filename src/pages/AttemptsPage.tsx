import { useEffect, useMemo, useState } from 'react';
import { timeline } from '../data/timeline';
import { capitalize, countWord, fmtInt, ordinalWord, timesWord } from '../lib/numbers';
import { fmtUtcDateRange } from '../lib/time';
import { buildChartModel, deaths, headlineFacts, ladderEntry, recordFacts, type LadderEntry, type Mark } from '../attempts/model';
import { Legend, TimelineChart } from '../attempts/TimelineChart';
import { ReadingPane } from '../attempts/ReadingPane';
import { TicksLadder } from '../attempts/TicksLadder';
import styles from './AttemptsPage.module.css';

export function AttemptsPage() {
  const model = useMemo(() => buildChartModel(timeline), []);
  const facts = headlineFacts(model);
  const record = recordFacts(timeline);
  const ladder = model.scored.map((am) => ladderEntry(am.attempt)).filter((e): e is LadderEntry => e !== null);
  const [selected, setSelected] = useState<Mark | null>(() => deaths(model.last)[0] ?? model.last.marks[0] ?? null);

  useEffect(() => {
    document.title = 'Attempts · rune.fast';
  }, []);

  const title =
    `${capitalize(countWord(facts.scoredCount))} scored attempts in ${facts.hours} hours. ` +
    `Only the last, which stopped ${timesWord(facts.lastStops)} and died ${timesWord(facts.lastDeaths)}, reached the finish.`;

  return (
    <article className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>{title}</h1>
      </header>

      <figure className={styles.wide}>
        <figcaption className={styles.caption}>
          <span className={styles.chartTitle}>
            Logged-in time, {fmtUtcDateRange(...model.domain)}
          </span>
          <Legend />
        </figcaption>
        <TimelineChart model={model} finishTicks={record.final} selected={selected} onSelect={setSelected} />
      </figure>

      <div className={styles.wide}>
        <ReadingPane model={model} mark={selected} onSelect={setSelected} />
      </div>

      <figure className={styles.measure} id="ticks">
        <figcaption className={styles.caption}>
          <span className={styles.chartTitle}>
            The {ordinalWord(model.scored.length)} attempt finished {fmtInt(record.margin)} ticks under the record
          </span>
          <span className={styles.chartSub}>Ticks per scored attempt; ~ estimated</span>
        </figcaption>
        <TicksLadder entries={ladder} record={record} />
      </figure>
    </article>
  );
}
