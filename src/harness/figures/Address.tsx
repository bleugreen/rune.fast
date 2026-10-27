import { countWord, fmtInt } from '../../lib/numbers';
import { fmtPacificClockRange, fmtPacificDayShort, fmtPacificHm } from '../../lib/time';
import { ADDRESSES } from '../addresses';
import type { HarnessModel } from '../model';
import styles from './Figures.module.css';

/**
 * Issue rs/843's pull request address, typeset, with each segment bracketed and named. The
 * segments are cut from the taught address itself, so the page cannot print one that differs.
 */
export function Address({ m }: { m: HarnessModel }) {
  const a = m.address;
  const full = ADDRESSES.pr;
  const cut = full.indexOf('/rs/') + 1;
  const [project, issue, execution, node, artifact] = full.slice(cut).split('/') as [string, string, string, string, string];
  if (issue !== String(a.issue) || execution !== String(a.execution) || node !== a.node || artifact !== a.artifact) {
    throw new Error('The taught address and the extracted issue disagree');
  }
  const segments: { code: string; concept?: string; meaning?: string; lit?: boolean }[] = [
    { code: full.slice(0, cut) },
    { code: project, concept: 'project', meaning: `the speedrun: ${fmtInt(m.totals.issues)} issues, ${countWord(m.totals.threads)} threads` },
    { code: '/' },
    { code: issue, concept: 'issue', meaning: `${a.title}, filed ${fmtPacificHm(a.filed)} ${fmtPacificDayShort(a.filed)}`, lit: true },
    { code: '/' },
    { code: execution, concept: 'execution', meaning: `its only run of a recipe: ${a.recipe}` },
    { code: '/' },
    { code: node, concept: 'node', meaning: `one agent, ${countWord(a.turns)} turns, ${fmtPacificClockRange(a.start, a.end)}` },
    { code: '/' },
    { code: artifact, concept: 'artifact', meaning: `PR #${a.pr}, ${countWord(a.versions)} versions, merged ${fmtPacificHm(a.merged)}` },
  ];
  return (
    <div>
      <p className={styles.address} aria-label={full}>
        {segments.map((s, k) => (
          <span key={k} className={[styles.seg, s.concept ? '' : styles.sep, s.lit ? styles.lit : ''].join(' ')} aria-hidden="true">
            <code className={styles.code}>{s.code}</code>
            {s.concept && <span className={styles.bracket} />}
            {s.concept && <span className={styles.concept}>{s.concept}</span>}
            {s.meaning && <span className={styles.meaning}>{s.meaning}</span>}
          </span>
        ))}
      </p>
      <dl className={styles.shapes}>
        <dt>{ADDRESSES.thread}</dt>
        <dd>a thread: a name where an issue has a number, and no end. The operator talks to it.</dd>
        <dt>{ADDRESSES.wakes}</dt>
        <dd>the same grammar, relative to the agent writing it: here, its own wake subscriptions.</dd>
      </dl>
    </div>
  );
}
