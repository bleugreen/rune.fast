import { useEffect, useMemo, useState } from 'react';
import { timeline } from '../data/timeline';
import { capitalize, countWord, fmtInt, ordinalWord, timesWord } from '../lib/numbers';
import { fmtUtcDateRange } from '../lib/time';
import {
  buildChartModel,
  chartAnchors,
  deaths,
  headlineFacts,
  ladderEntry,
  recordFacts,
  type LadderEntry,
  type Mark,
} from '../attempts/model';
import { Legend, TimelineChart } from '../attempts/TimelineChart';
import { ReadingPane } from '../attempts/ReadingPane';
import { TicksLadder } from '../attempts/TicksLadder';
import styles from './AttemptsPage.module.css';

export function AttemptsPage() {
  const model = useMemo(() => buildChartModel(timeline), []);
  const anchors = useMemo(() => chartAnchors(model), [model]);
  const facts = headlineFacts(model);
  const record = recordFacts(timeline);
  const ladder = model.scored.map((am) => ladderEntry(am.attempt)).filter((e): e is LadderEntry => e !== null);
  const [pinned, setPinned] = useState<Mark | null>(() => deaths(model.last)[0] ?? anchors.list[0] ?? null);
  const [preview, setPreview] = useState<Mark | null>(null);
  const shown = preview ?? pinned;

  useEffect(() => {
    document.title = 'Attempts · rune.fast';
  }, []);

  return (
    <article className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>
          {capitalize(countWord(facts.scoredCount))} scored attempts in {facts.hours} hours. Only the last one finished.
        </h1>
        <p className={styles.dek}>
          It stopped {timesWord(facts.lastStops)} and died {timesWord(facts.lastDeaths)} on the way to{' '}
          {fmtInt(record.final)} ticks.
        </p>
      </header>

      <figure className={styles.wide}>
        <figcaption className={styles.caption}>
          <span className={styles.chartTitle}>Logged-in time, {fmtUtcDateRange(...model.domain)}</span>
          <Legend />
        </figcaption>
        <TimelineChart
          model={model}
          anchors={anchors}
          finishTicks={record.final}
          shown={shown}
          onPreview={setPreview}
          onSelect={setPinned}
        />
      </figure>

      <div className={styles.wide}>
        <ReadingPane model={model} anchors={anchors} shown={shown} pinned={pinned} onSelect={setPinned} />
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
