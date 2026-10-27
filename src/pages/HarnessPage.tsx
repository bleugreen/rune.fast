import { useEffect, useMemo, type ReactNode } from 'react';
import { capitalize, countWord, fmtInt, fmtPercent, listWords } from '../lib/numbers';
import { fmtDuration, fmtPacificDayLong, fmtPacificHm, fmtPacificHms, fmtPacificWeekday, pacificZone } from '../lib/time';
import { ADDRESSES } from '../harness/addresses';
import { harnessData } from '../harness/data';
import { buildHarnessModel, type HarnessModel } from '../harness/model';
import { Address } from '../harness/figures/Address';
import { GitNotices } from '../harness/figures/GitNotices';
import { IssueLife } from '../harness/figures/IssueLife';
import { Lifelines } from '../harness/figures/Lifelines';
import { OperatorShare } from '../harness/figures/OperatorShare';
import { Recipes } from '../harness/figures/Recipes';
import { Routing } from '../harness/figures/Routing';
import { TenetLedger } from '../harness/figures/TenetLedger';
import { VerbMix } from '../harness/figures/VerbMix';
import { Wakes } from '../harness/figures/Wakes';
import { WriteCard } from '../harness/figures/WriteCard';
import styles from './HarnessPage.module.css';

function Figure({ title, sub, children }: { title: string; sub?: ReactNode; children: ReactNode }) {
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.caption}>
        <span className={styles.chartTitle}>{title}</span>
        {sub && <span className={styles.chartSub}>{sub}</span>}
      </figcaption>
      {children}
    </figure>
  );
}

/** Quoted words, as said, with who said them and when beneath. */
function Quote({ words, by }: { words: string; by: ReactNode }) {
  return (
    <figure className={styles.quote}>
      <blockquote>{words}</blockquote>
      <figcaption>{by}</figcaption>
    </figure>
  );
}

function Sources({ lines }: { lines: readonly string[] }) {
  return (
    <details className={styles.sources}>
      <summary>Sources</summary>
      <div className={styles.sourceText}>
        {lines.map((l, k) => (
          <p key={k}>{l}</p>
        ))}
      </div>
    </details>
  );
}

const at = (t: number) => `${fmtPacificHm(t)} on ${fmtPacificWeekday(t)}`;

export function HarnessPage() {
  const m: HarnessModel = useMemo(() => buildHarnessModel(harnessData), []);
  useEffect(() => {
    document.title = 'Harness · rune.fast';
  }, []);

  const t = m.totals;
  const a = m.address;
  const i = m.issue;
  const r = m.routing;
  const T = m.tenets;
  const o = m.operator;
  const q = m.quotes as Record<string, { t: number; words: string; issue: number; from: string }>;
  const s = m.sources as Record<string, string[]>;
  const [verbsBuilders, verbsCoordinators, verbsThreads] = m.verbs.rows as [(typeof m.verbs.rows)[number], (typeof m.verbs.rows)[number], (typeof m.verbs.rows)[number]];
  const subscribe = (m.write.items[2]?.payload?.subscribe ?? {}) as { phrase?: string };
  const filed = m.write.filed;
  const peak = m.git.peak;
  const tenet3Line = s.tenets!.filter((l) => l.includes(`tenet ${T.research.n},`));

  const titles = {
    address: 'One address names the whole chain, from the project down to the pull request',
    lifelines: `The operator talked to ${countWord(t.threads)} threads; the threads and their coordinators filed the ${fmtInt(t.issues)} issues`,
    issue: `rs/${a.issue} waited ${fmtDuration(i.heldMs)}, one builder took ${fmtDuration(i.workMs)}, and the pull request merged ${fmtDuration(i.waitMs)} after its review`,
    recipes: `${fmtInt(m.build.executions)} of the ${fmtInt(m.recipeTotal)} executions ran the one-stage build recipe`,
    write: `One write carried ${countWord(m.write.items.length)} changes: replace a terminal, wake on its output, and file an issue`,
    verbs: `Builders mostly ran commands; coordinators and threads mostly wrote`,
    routing: `A question went up to the operator, the answer came down, and the reports went up, in under ${countWord(r.spanMinutes)} minutes`,
    wakes: `${fmtPercent(m.wakes.messageShare)} percent of the wakes were another agent’s message`,
    tenets: `The threads proposed ${fmtInt(T.total)} tenets; the operator answered ${fmtInt(T.answered)}, ${fmtInt(T.withinHour)} of them within the hour`,
    git: `${fmtPacificWeekday(peak.t)} brought ${fmtInt(peak.total)} branch notices; ${fmtInt(peak.blocking)} needed an agent`,
    operator: `For every input from the operator, the agents sent each other about ${fmtInt(o.ratio)} messages`,
  };

  return (
    <article className={styles.page}>
      <header>
        <h1 className={styles.title}>The harness: where the run’s work lived between sessions</h1>
        <p className={styles.dek}>
          Every agent in the run was a coding agent like the one in your terminal. What the harness added was a place
          for the work to live between sessions: {countWord(t.threads)} threads, {fmtInt(t.issues)} issues,{' '}
          {fmtInt(t.messages)} messages and {fmtInt(T.total)} decisions, each with an address. I read them all; this
          page shows the objects as the run left them.
        </p>
        <dl className={styles.facts}>
          {m.facts.map((f) => (
            <div key={f.label}>
              <dt>{f.label}</dt>
              <dd>{fmtInt(f.value)}</dd>
            </div>
          ))}
        </dl>
      </header>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>An address for everything</h2>
        <p className={styles.prose}>
          If you use Claude Code, you are the orchestrator. You hold the context, open the sessions and read what each
          one did, and when a session ends, what it knew ends with it unless you carried it somewhere. The agents in
          this run were the same kind of coding agent, and {countWord(t.operators)} person drove them. What was
          different was Cairn, the harness they ran in. Cairn keeps the work in objects that outlive any session:
          threads, issues, executions, nodes, artifacts, messages and tenets. Each object has an address, and agents act
          on them through three verbs.
        </p>
        <p className={styles.prose}>
          Issue rs/{a.issue} was filed at {fmtPacificHm(a.filed)} {pacificZone(a.filed)} on{' '}
          {fmtPacificDayLong(a.filed)}: a documentation change that would record the final attempt’s measured run
          order, held until that attempt was over. This is the address of its pull request.
        </p>
        <Figure title={titles.address} sub={`The address of issue rs/${a.issue}’s pull request, as the run’s agents wrote it`}>
          <Address m={m} />
        </Figure>
        <p className={styles.prose}>
          Read left to right, the address is a chain, and each prefix is an address too. <code>{ADDRESSES.issue}</code>{' '}
          is the issue. <code>{ADDRESSES.execution}</code> is its first execution: one run of a recipe against the
          issue. <code>{ADDRESSES.node}</code> is the agent that execution started, and <code>{a.artifact}</code> is
          the artifact that agent wrote last, its pull request. An agent that reads any of these addresses gets the
          object back, with the actions it allows.
        </p>
        <Sources lines={[...s.address!, ...s.head!]} />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Threads talk, issues work</h2>
        <p className={styles.prose}>
          The operator did not talk to issues. They talked to {countWord(t.threads)} threads: long-lived sessions with
          a name where an issue has a number. main held the speedrun itself, and {listWords(m.otherThreads)} each held
          another part of the project. A thread has no end and no pull request of its own. It files issues, and an issue
          filed under a thread reports back to it.
        </p>
        <Figure
          title={titles.lifelines}
          sub="Per six hours. Above each line, the operator’s messages to the thread; below it, issues filed under it. The last row: issues filed by coordinator agents."
        >
          <Lifelines m={m} label={titles.lifelines} />
        </Figure>
        <p className={styles.prose}>
          The threads filed {fmtInt(m.threadFiled)} issues, {fmtInt(m.mainFiled)} of them under main. Most of the rest
          were filed by coordinators. A coordinator is an issue whose job is filing issues: it splits a mission into
          child issues, reviews what comes back and merges it into one result. Coordinator agents filed{' '}
          {fmtInt(t.coordinatorFiled)} of the {fmtInt(t.issues)}, and only {fmtInt(t.topLevelIssues)} issues had no
          issue above them. The first accent mark on main’s line is rs/{r.coordinator}, the quest-route coordinator;
          the section on asking and answering comes back to it.
        </p>
        <p className={styles.prose}>
          This is where a child issue differs from a sub-agent. In Claude Code, a sub-agent runs inside your session
          and reports back into it. At {fmtPacificHm(T.research.answered!)} on the first afternoon the operator
          approved rs tenet {T.research.n}, which put the run’s research in child issues instead: “{T.researchWhy}.”
          A child issue can file children of its own, and what it finds lands in the repository.
        </p>
        <Sources lines={[...s.lifelines!, ...tenet3Line]} />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>One issue, from filing to merge</h2>
        <p className={styles.prose}>
          An issue waits until something starts it. rs/{a.issue} was filed held, for its coordinator rs/
          {i.reviewerIssue} to start once the last attempt was over. It held for {fmtDuration(i.heldMs)}, and agents
          left {fmtInt(i.heldComments.length)} comments of evidence on it in that time. At {at(i.start)}, rs/
          {i.reviewerIssue} started its one execution.
        </p>
        <p className={styles.prose}>
          An execution runs a recipe, a small graph of nodes. rs/{a.issue}’s was {a.recipe}: a trigger, a builder
          agent and a pull-request node. The builder worked for {fmtDuration(i.workMs)} in {countWord(i.turns.length)}{' '}
          turns and made {fmtInt(i.calls.length)} verb calls. A turn ends when the agent has nothing to do until
          something happens, and the harness wakes it when that something does. {capitalize(countWord(i.testWakes))} of
          the builder’s turns began when a test run it had left running finished, {countWord(i.messageWakes)} began
          with a message from rs/{i.reviewerIssue}, and {countWord(i.bothWakes)} with both: a command it was waiting
          on, and {countWord(i.bothMessages)} messages from rs/{i.reviewerIssue} in its briefing.
        </p>
        <Figure
          title={titles.issue}
          sub={`Issue rs/${a.issue}, on an axis broken twice. Press Play: the recipe lights the node that holds the issue.`}
        >
          <IssueLife m={m} label={titles.issue} />
        </Figure>
        <p className={styles.prose}>
          The builder’s first version of its pull request, at {fmtPacificHm(i.versions[0]!)}, opened pull request #
          {i.pr}. rs/{i.reviewerIssue} reviewed it over messages, and the builder wrote{' '}
          {countWord(i.versions.length - 1)} more versions in answer. At {fmtPacificHm(i.review)} a comment on the
          issue recorded “Final independent review approved”, and at {fmtPacificHm(i.merged)} the {i.mergedBy} thread
          merged it.
        </p>
        <p className={styles.prose}>
          The documented standard recipe is planbuild: a planner writes a plan, a person confirms it, and a builder, a
          pull request and a review agent follow. The run used planbuild for {fmtInt(m.planbuild.executions)}{' '}
          executions and build for {fmtInt(m.build.executions)} of its {fmtInt(m.recipeTotal)}. Review mostly happened
          the way it did here, with a coordinator reading the work and answering over messages; the whole run had{' '}
          {fmtInt(t.reviewJobs)} review jobs.
        </p>
        <Figure title={titles.recipes} sub="The recipes as the run stored them, with the executions of each">
          <Recipes m={m} />
        </Figure>
        <p className={styles.prose}>
          An issue can have more than one execution. Starting a new one supersedes the execution that owns the issue:
          rs/{m.rs302.issue} ran {countWord(m.rs302.executions)}, and the first {countWord(m.rs302.superseded)} are
          marked superseded.
        </p>
        <Sources lines={[...s.issue843!, ...s.recipes!]} />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Three verbs</h2>
        <p className={styles.prose}>
          In Claude Code an agent has many tools. In Cairn every agent acts through three verbs. read fetches and
          searches files and objects. write changes them: it edits files, files issues, sends messages and subscribes
          to wakes. run executes commands. Each call carries a batch of items, and each item names its target by
          address. This call, from main at {fmtPacificHms(m.write.t)} on the first day, carried{' '}
          {countWord(m.write.items.length)}.
        </p>
        <Figure title={titles.write} sub="The main thread’s call, its items as sent (the new issue’s description shortened)">
          <WriteCard
            m={m}
            glosses={[
              'stop the game client, which had hung',
              'start a fresh one: a terminal is an object with an address',
              <>
                wake me when it prints this. <code>cairn:~/</code> is the agent writing the call, here{' '}
                <code>{ADDRESSES.thread}</code>
              </>,
              `file rs/${filed.issue}, the project’s first issue, and start a builder on it`,
            ]}
          />
        </Figure>
        <p className={styles.prose}>
          The first two items replace a game client that had hung; a terminal is an object like any other. The third
          asks the harness to wake main when the new client prints “{subscribe.phrase}”. The fourth files rs/
          {filed.issue}, the project’s first issue, about the hang, and starts a builder on it.{' '}
          <code>{ADDRESSES.wakes}</code> is an address written relative to the agent itself.
        </p>
        <Figure title={titles.verbs} sub="Each role’s verb calls over the run">
          <VerbMix m={m} />
          <p className={styles.note}>
            Not shown: {fmtInt(m.verbs.rest)} calls by planners, reviewers, the integrator and{' '}
            {fmtInt(t.exploreTasks)} explore tasks.
          </p>
        </Figure>
        <p className={styles.prose}>
          The export holds {fmtInt(m.verbs.total)} verb calls. Builders mostly ran commands, {fmtInt(verbsBuilders.run)}{' '}
          of their {fmtInt(verbsBuilders.total)}. Coordinators and threads mostly wrote, filing, messaging and merging:
          {' '}
          {fmtInt(verbsCoordinators.write)} of the coordinators’ {fmtInt(verbsCoordinators.total)} calls and{' '}
          {fmtInt(verbsThreads.write)} of the threads’ {fmtInt(verbsThreads.total)}.
        </p>
        <Sources lines={[...s.write333!, ...s.verbs!]} />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Asking, answering, reporting up</h2>
        <p className={styles.prose}>
          Threads and coordinators route attention between the agents and the person. A question goes up to the person,
          a decision comes down, and a report goes up to whoever filed the work. These are {countWord(r.spanMinutes)}{' '}
          minutes on the first evening around rs/{r.coordinator}, the quest-route coordinator, with its parent thread
          main, its {fmtInt(r.childCount)} child issues and the operator.
        </p>
        <Figure
          title={titles.routing}
          sub={`The rs/${r.coordinator} coordinator, its parent thread main, its child issues, and the two fixes it started`}
        >
          <Routing m={m} label={titles.routing} />
        </Figure>
        <p className={styles.prose}>
          The question rs/{r.coordinator} asked is an object too, at <code>{ADDRESSES.question}</code>. The
          operator’s answer came {fmtInt(r.answerSeconds)} seconds after it, and main’s own start of rs/
          {r.started[0]} and rs/{r.started[1]} superseded rs/{r.coordinator}’s a few seconds after that.
        </p>
        <p className={styles.prose}>
          Every turn an agent takes opens with a briefing from the harness: what woke it. Counted over the run, almost
          every wake was another agent’s message.
        </p>
        <Figure title={titles.wakes} sub="What the harness’s briefing named when it opened an agent’s turn, over the run">
          <Wakes m={m} />
          <p className={styles.note}>
            Not shown: {fmtInt(m.wakes.catchUp)} pointers to unread chat and {fmtInt(m.wakes.other)} notices about the
            harness itself. Terminals woke agents too: {fmtInt(m.wakes.terminalExit)} exits and{' '}
            {fmtInt(m.wakes.terminalOutput)} watched phrases.
          </p>
        </Figure>
        <p className={styles.prose}>
          The run found a gap here. Coordinator executions could not schedule recurring wakes, so the threads checked
          on the coordinators instead, on a standing instruction from the operator that the harness delivered{' '}
          {fmtInt(m.wakes.backstops)} times. The first read:
        </p>
        <Quote words={`${q.backstop!.words} …`} by={`the harness, ${at(q.backstop!.t)} ${fmtPacificDayLong(q.backstop!.t).split(' ').slice(1).join(' ')}`} />
        <Sources lines={[...s.rs3!, ...s.wakes!, ...s.routing!]} />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Tenets</h2>
        <p className={styles.prose}>
          Some decisions bind every agent that comes after them. A thread proposes a tenet, a statement of how the
          project does something. Only the operator answers it, yes or no, and an answered tenet does not change; a
          later one can supersede it. The threads proposed {fmtInt(T.total)} tenets. The operator answered{' '}
          {fmtInt(T.answered)}, half of them within {fmtInt(T.medianWaitMinutes)} minutes.
        </p>
        <Figure
          title={titles.tenets}
          sub={`Each row a tenet: proposed (tick) to answered (mark). Tenet ${T.research.n}, quoted above, in the accent.`}
        >
          <TenetLedger m={m} label={titles.tenets} />
        </Figure>
        <Quote
          words={T.quoted.statement ?? ''}
          by={
            <>
              rs tenet {T.quoted.n}, <code>{ADDRESSES.tenet}</code>, approved at {at(T.quoted.answered!)},{' '}
              {countWord(m.quotedSeconds)} seconds after it was proposed
            </>
          }
        />
        <p className={styles.prose}>
          The documentation describes tenets as gates that a filing can wait on. In the run,{' '}
          {countWord(T.gates.length)} of the {fmtInt(T.total)} were filing gates ({listWords(T.gates.map((n) => `#${n}`))}),
          and the rest were standing rules. The rule on merging shows how the rules moved. Tenet {m.mergeChain[0]} said
          the main thread merges child pull requests; tenet {m.mergeChain[1]} superseded it, and tenet{' '}
          {m.mergeChain[2]} superseded that. By the end main had merged {fmtInt(m.merges.main)} pull requests by write
          call, coordinators {fmtInt(m.merges.coordinators)} and the integration thread{' '}
          {fmtInt(m.merges.integration)}, among them rs/{a.issue}’s.
        </p>
        <p className={styles.prose}>The operator declined {countWord(T.declined)}, and said why.</p>
        {T.declinedRows.map((d) => (
          <Quote key={d.n} words={d.comment ?? ''} by={`the operator, declining tenet ${d.n} at ${at(d.answered!)}`} />
        ))}
        <Sources lines={s.tenets!} />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Where it got in the way</h2>
        <p className={styles.prose}>
          Every merge moved the base of every branch built on it. The harness rebased those branches itself when it
          could, and told the agent when it could not. When the operator asked for this page, at{' '}
          {at(q.hindrance!.t)}, they wrote that Cairn played a major role, “and also {q.hindrance!.words}”.
        </p>
        <Figure
          title={titles.git}
          sub="The harness’s branch notices per day. Light: rebased by the harness, nothing to do. Ink: an agent had to act."
        >
          <GitNotices m={m} label={titles.git} />
        </Figure>
        <p className={styles.prose}>
          Over the run the harness sent {fmtInt(m.git.total)} of these notices, and {fmtInt(m.git.blocking)} needed an
          agent. Some cost more than a turn. At {at(q.publish!.t)}, rs/{q.publish!.issue}’s builder could not publish
          its branch, and said so:
        </p>
        <Quote words={q.publish!.words} by={`rs/${q.publish!.issue}’s builder, ${at(q.publish!.t)}`} />
        <p className={styles.prose}>
          {capitalize(countWord(m.oneOffMinutes))} minutes later main approved a push by hand, “{q.oneOff!.words}”,
          and the branch went up.
        </p>
        <Sources lines={[...s.git!, ...s.friction!]} />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Why one person could run it</h2>
        <p className={styles.prose}>
          Over the {countWord(m.window.days)} days the operator typed {fmtInt(o.messages)} messages, answered{' '}
          {fmtInt(o.answers)} questions and gave {fmtInt(o.verdicts)} tenet verdicts: {fmtInt(o.inputs)} inputs. The
          agents sent each other {fmtInt(o.agents)} messages, and the harness sent {fmtInt(o.harness)} of its own.
        </p>
        <Figure title={titles.operator} sub="Over the run, on one scale">
          <OperatorShare m={m} />
        </Figure>
        <p className={styles.prose}>
          {fmtInt(o.carets)} of the operator’s messages were a single “^”, which tells an agent to go on. The operator
          talked to {countWord(t.threads)} threads. The threads and coordinators filed the issues, reviewed the work and
          merged it, and what came back up to the person was questions, tenets and the threads’ reports.
        </p>
        <Sources lines={s.operator!} />
      </section>
    </article>
  );
}
