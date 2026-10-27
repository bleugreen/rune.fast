import { useEffect, useMemo } from 'react';
import { costInputs } from '../data/cost';
import type { StatusGroup } from '../data/costTypes';
import { timeline } from '../data/timeline';
import { buildCostModel, type DayCost, type StatusSegment } from '../cost/model';
import { ActivityChart, DayChart, DayLegend, SwarmChart } from '../cost/Charts';
import { capitalize, countWord, fmtInt, fmtPercent, fmtUsd, fmtUsdCents, listWords } from '../lib/numbers';
import { fmtPacificDayLong, fmtPacificDayMonth, fmtPacificHm, fmtPacificWeekday, MINUTE, pacificZone } from '../lib/time';
import styles from './CostPage.module.css';

const STATUS_LABEL: Readonly<Record<StatusGroup, (n: number) => string>> = {
  merged: (n) => `${fmtInt(n)} merged issues`,
  closed: (n) => `${fmtInt(n)} closed, landed by snapshot`,
  standing: (n) => `${fmtInt(n)} standing: coordinators and long-lived missions`,
  threads: (n) => `${countWord(n)} threads`,
};

/** 'five and a half days', to the nearest half day. */
function halfDays(days: number): string {
  const halves = Math.round(days * 2);
  return `${countWord(Math.floor(halves / 2))}${halves % 2 ? ' and a half' : ''} days`;
}

const planList = (plans: readonly { name: string; count: number }[]) =>
  listWords(plans.map((p) => `${countWord(p.count)} ${p.name} plan${p.count === 1 ? '' : 's'}`));

const weekday = (d: DayCost) => fmtPacificWeekday(d.t);
/** The day of the month alone, Pacific: the '21' of '21 and 22 October'. */
const pacificDate = (t: number) => fmtPacificDayMonth(t).split(' ')[0];

function StatusBar({ segments }: { segments: readonly StatusSegment[] }) {
  const columns = segments.map((s) => `${s.usd}fr`).join(' ');
  return (
    <div className={styles.status}>
      <div className={styles.statusBar} style={{ gridTemplateColumns: columns }} aria-hidden="true">
        {segments.map((s) => (
          <span key={s.key} className={styles[s.key]} />
        ))}
      </div>
      <ol className={styles.statusLabels} style={{ gridTemplateColumns: columns }}>
        {segments.map((s) => (
          <li key={s.key} data-segment={s.key}>
            <span className={styles.statusValue}>{fmtUsd(s.usd)}</span>
            <span>{STATUS_LABEL[s.key](s.count)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function CostPage() {
  const m = useMemo(() => buildCostModel(costInputs, timeline), []);
  useEffect(() => {
    document.title = 'Cost · rune.fast';
  }, []);

  const { window: w, subscription: sub, swing, gptDay, swarm } = m;
  const span = halfDays(w.days);
  const seg = Object.fromEntries(m.status.segments.map((s) => [s.key, s])) as Record<StatusGroup, StatusSegment>;
  const lead = m.models[0]!;
  const { peak, peakOnCostliest } = m.activity;
  const bucketMinutes = m.activity.step / MINUTE;
  const [g0, g1] = swarm.growth;

  const dayTitle = `${weekday(m.peakDay)} cost the most; managers outspent workers on ${listWords(m.managerDays.map(weekday))}`;
  const statusTitle = `${fmtInt(seg.standing.count)} standing issues cost more than the ${fmtInt(seg.merged.count)} that merged`;
  const modelTitle = `${lead.name} carried ${fmtPercent(lead.share)} percent of the list value`;
  const activityTitle = `At the peak, ${fmtInt(peak.v)} agents produced output in the same ${countWord(bucketMinutes)} minutes`;
  const swarmTitle = `Spawning and merging both peaked on ${fmtPacificDayLong(swarm.spawnPeak.t)}`;

  return (
    <article className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>
          <span className={styles.number}>{fmtUsd(m.total)}</span> of tokens at list price, on {fmtUsd(sub.prorated)} of
          subscriptions
        </h1>
        <p className={styles.dek}>
          {capitalize(span)} of an agent swarm, from {fmtPacificHm(w.from)} {pacificZone(w.from)} on{' '}
          {fmtPacificDayLong(w.from)} to {fmtPacificHm(w.to)} on {fmtPacificDayLong(w.to)}.
        </p>
      </header>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>What it cost</h2>
        <p className={styles.prose}>
          The large number is list-price value: what the model providers’ APIs would have charged for the tokens the
          swarm used. The swarm ran on {planList(sub.plans)}, {fmtUsd(sub.monthly)} a month and shared with other
          projects; these {span} are {fmtUsd(sub.prorated)} of that. List value is {fmtInt(Math.round(sub.ratio))} times
          what was paid.
        </p>

        <figure className={styles.figure}>
          <figcaption className={styles.caption}>
            <span className={styles.chartTitle}>{dayTitle}</span>
            <span className={styles.chartSub}>List value per day</span>
            <DayLegend />
          </figcaption>
          <DayChart days={m.days} firstLead={swing.first} label={dayTitle} />
        </figure>
        <p className={styles.prose}>
          {fmtPacificDayLong(swing.peak.t)} was the costliest day at {fmtUsd(swing.peak.total)}, and workers led it,{' '}
          {fmtUsd(swing.peak.stacks.work)} to the managers’ {fmtUsd(swing.peak.stacks.coord)}. Managers are coordinator
          issues: agents that split a mission into child issues and review what comes back. On {weekday(swing.first)}{' '}
          they pulled ahead, {fmtUsd(swing.first.stacks.coord)} to {fmtUsd(swing.first.stacks.work)}.{' '}
          {weekday(swing.back)} went back to the workers, {fmtUsd(swing.back.stacks.work)} to{' '}
          {fmtUsd(swing.back.stacks.coord)}, and {weekday(swing.again)} to the managers,{' '}
          {fmtUsd(swing.again.stacks.coord)} to {fmtUsd(swing.again.stacks.work)}.
        </p>

        <figure className={styles.figure}>
          <figcaption className={styles.caption}>
            <span className={styles.chartTitle}>{statusTitle}</span>
            <span className={styles.chartSub}>List value by issue status at the finish</span>
          </figcaption>
          <StatusBar segments={m.status.segments} />
          <p className={styles.unit}>
            <span className={styles.unitValue}>{fmtUsdCents(m.status.median)}</span>
            <span className={styles.unitLabel}>the median merged issue</span>
          </p>
          <p className={styles.note}>Runs tied to no listed issue make up the remaining {fmtUsd(m.status.unattributed)}.</p>
        </figure>

        <figure className={styles.figure}>
          <figcaption className={styles.caption}>
            <span className={styles.chartTitle}>{modelTitle}</span>
          </figcaption>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Model</th>
                <th scope="col">List value</th>
              </tr>
            </thead>
            <tbody>
              {m.models.map((r) => (
                <tr key={r.key}>
                  <td>{r.name}</td>
                  <td>{fmtUsd(r.usd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </figure>
        <p className={styles.prose}>
          {fmtPacificDayLong(gptDay.day.t)} was the GPT day. {m.models.find((r) => r.key === gptDay.model)?.name} took{' '}
          {fmtUsd(gptDay.usd)} of the day’s {fmtUsd(gptDay.day.total)}, {fmtPercent(gptDay.share)} percent, against{' '}
          {fmtUsd(gptDay.opus)} for Opus.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>What the swarm looked like</h2>
        <p className={styles.prose}>
          The swarm was {fmtInt(swarm.units)} units of work: {fmtInt(swarm.issues)} issues and {countWord(swarm.threads)}{' '}
          long-running threads.
        </p>
        <dl className={styles.facts}>
          <div>
            <dt>agent runs</dt>
            <dd>{fmtInt(swarm.runs)}</dd>
          </div>
          <div>
            <dt>turns</dt>
            <dd>{fmtInt(swarm.turns)}</dd>
          </div>
          <div>
            <dt>messages between units</dt>
            <dd>{fmtInt(swarm.messages)}</dd>
          </div>
          <div>
            <dt>forced swaps, Claude to GPT and back</dt>
            <dd>{fmtInt(swarm.swaps)}</dd>
          </div>
        </dl>

        <figure className={styles.figure}>
          <figcaption className={styles.caption}>
            <span className={styles.chartTitle}>{activityTitle}</span>
            <span className={styles.chartSub}>
              Agents producing output, per {countWord(bucketMinutes)} minutes, counted as runs that wrote at least one
              model response in the bucket, so idle sessions do not count. Shaded and numbered: the{' '}
              {countWord(m.attempts.length)} scored attempts.
            </span>
          </figcaption>
          <ActivityChart model={m} label={activityTitle} />
        </figure>
        <p className={styles.prose}>
          The peak came at {fmtPacificHm(peak.t)} on {fmtPacificDayLong(peak.t)}. On {weekday(m.peakDay)}, the costliest
          day, the busiest {countWord(bucketMinutes)} minutes had {fmtInt(peakOnCostliest.v)}.
        </p>

        <figure className={styles.figure}>
          <figcaption className={styles.caption}>
            <span className={styles.chartTitle}>{swarmTitle}</span>
            <span className={styles.chartSub}>Issues spawned and merged per day</span>
          </figcaption>
          <SwarmChart model={m} label={swarmTitle} />
        </figure>
        <p className={styles.prose}>
          The swarm spawned {fmtInt(swarm.growthSpawns)} issues on {pacificDate(g0.t)} and {fmtPacificDayMonth(g1.t)}{' '}
          and merged {fmtInt(swarm.growthMerges)}; every later day spawned fewer than either. Messages between units
          peaked on {fmtPacificDayMonth(swarm.messagePeak.t)} too, at{' '}
          {fmtInt(swarm.messagePeak.messages)}.
        </p>
      </section>
    </article>
  );
}
