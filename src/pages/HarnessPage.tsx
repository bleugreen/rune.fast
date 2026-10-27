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
  const verbsBuilders = m.verbs.rows[0]!;
  const subscribe = (m.write.items[2]?.payload?.subscribe ?? {}) as { phrase?: string };
  const filed = m.write.filed;
  const peak = m.git.peak;
  const awaiting = T.rows.find((row) => row.status === 'proposed');
  const tenet3Line = s.tenets!.filter((l) => l.includes(`tenet ${T.research.n},`));

  const titles = {
    address: 'Each segment of the address names an object, from the project down to the pull request',
    lifelines: `The operator talked mostly to the ${countWord(t.threads)} threads; the threads and their coordinators filed the issues`,
    issue: `rs/${a.issue} sat held for ${fmtDuration(i.heldMs)}; one builder did the work in ${fmtDuration(i.workMs)}`,
    recipes: `${fmtInt(m.build.executions)} of the ${fmtInt(m.recipeTotal)} executions ran the one-stage build recipe, not the documented planbuild`,
    write: `One write carried ${countWord(m.write.items.length)} changes: replace a terminal, wake on its output, and file an issue`,
    verbs: 'Builders used run more than any other verb; coordinators and threads used write',
    routing: `A question went up to the operator, the answer came down, and the reports went up, in under ${countWord(r.spanMinutes)} minutes`,
    wakes: `${fmtPercent(m.wakes.messageShare)} percent of what woke an agent was a message from another agent`,
    tenets: `The threads proposed ${fmtInt(T.total)} tenets; the operator answered ${fmtInt(T.answered)}, ${fmtInt(T.withinHour)} of them within the hour`,
    git: `${fmtPacificWeekday(peak.t)} brought ${fmtInt(peak.total)} branch notices; ${fmtInt(peak.blocking)} needed an agent`,
    operator: `For every input from the operator, the agents sent each other about ${fmtInt(o.ratio)} messages`,
  };

  return (
    <article className={styles.page}>
      <header>
        <h1 className={styles.title}>The harness: how the run kept track of its own work</h1>
        <p className={styles.dek}>
          In Claude Code, you are the orchestrator. You remember what each session was for, start the next one, and
          carry what one session found into the next. The agents in this run were the same kind of coding agent, and
          one person, the operator, stood behind all {fmtInt(t.jobs)} of their jobs. The operator did not carry that
          work in their head. Cairn, the harness the run used, carried it. I did not take part in the run; I read it
          afterwards, through the same addresses its agents used, and this page explains how the harness works on
          objects from the run itself.
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
        <h2 className={styles.sectionTitle}>Everything has an address</h2>
        <p className={styles.prose}>
          Cairn keeps the work in objects that outlive any session: threads, issues, executions, nodes, artifacts,
          messages and tenets. Each one has an address, and an address works like a path in a file system. It names an
          object by naming everything above it, so the address alone tells you where the object sits and what it
          belongs to.
        </p>
        <p className={styles.prose}>
          This page follows one issue, rs/{a.issue}, from filing to merge. It was filed at{' '}
          {fmtPacificHm(a.filed)} {pacificZone(a.filed)} on {fmtPacificDayLong(a.filed)}, to write down the measured
          run order of the final attempt once that attempt was over. This is the address of the pull request that
          did it.
        </p>
        <Figure title={titles.address} sub={`The address of issue rs/${a.issue}’s pull request, as the run’s agents wrote it`}>
          <Address m={m} />
        </Figure>
        <p className={styles.prose}>
          Every prefix of the address is an address too. <code>{ADDRESSES.issue}</code> is the issue, the unit of
          work, with its description and comments. <code>{ADDRESSES.execution}</code> is an execution,
          one attempt at that work, which runs a fixed set of agents against the issue.{' '}
          <code>{ADDRESSES.node}</code> is a node, one agent in that execution, here the builder, and{' '}
          <code>{a.artifact}</code> is an artifact, the thing that agent produced: the pull request. Reading any of
          these addresses returns the object, along with the actions it accepts.
        </p>
        <p className={styles.prose}>
          Because the objects live outside the agents, the work does not end when an agent does. The builder’s session
          ended at {fmtPacificHm(i.end)}. At {fmtPacificHm(a.merged)} a different agent, the {i.mergedBy} thread,
          merged the pull request it had left behind.
        </p>
        <Sources lines={[...s.address!, ...s.head!]} />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Threads talk, issues work</h2>
        <p className={styles.prose}>
          A thread is a long-lived agent that a person talks to. It has a name where an issue has a number, and it has
          no end. The run had {countWord(t.threads)}. main held the
          speedrun itself, and {listWords(m.otherThreads)} each held one part of the project. Most of what the operator
          typed went to them: {fmtInt(o.toThreads)} of {fmtInt(o.messages)} messages.
        </p>
        <p className={styles.prose}>
          A thread hands out work by filing issues. An issue filed under a thread reports back to that thread, and its
          pull request lands on the project’s base branch.
        </p>
        <Figure
          title={titles.lifelines}
          sub="Each bar is six hours. Above a thread’s line, the operator’s messages to it; below, the issues filed under it. The dashed last row: issues filed by coordinators."
        >
          <Lifelines m={m} label={titles.lifelines} />
        </Figure>
        <p className={styles.prose}>
          Most issues, though, were filed by other issues. A coordinator is an issue whose agent’s job is to file
          issues: it splits a mission into child issues, reviews what each child sends back, and puts the results
          together. Coordinators filed {fmtInt(t.coordinatorFiled)} of the {fmtInt(t.issues)} issues, so the work
          forms a tree: the operator at the top, the threads below, coordinators below the threads, and the agents
          doing the work at the leaves.
          The first red mark on main’s line is rs/{r.coordinator}, a coordinator for quest routes that main filed at{' '}
          {at(m.lifelines.marks.rs3)}. The section on asking and answering comes back to it.
        </p>
        <p className={styles.prose}>
          A child issue is different from the sub-agent you know from Claude Code. A sub-agent runs inside your
          session, and its report comes back into your context and goes when the session does. A child issue is a full
          issue: it can file children of its own, and what it finds can be committed to the repository. The run made
          this a rule a minute before rs/{r.coordinator} was filed. At {at(T.research.answered!)}, the operator approved rs tenet{' '}
          {T.research.n} (a tenet is a project rule; they have their own section below), which put research in child
          issues and gave the reason: “{T.researchWhy}.”
        </p>
        <Sources lines={[...s.lifelines!, ...tenet3Line]} />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>One issue, from filing to merge</h2>
        <p className={styles.prose}>
          An issue can exist long before anyone works on it. rs/{a.issue} was filed held: it was not to start until
          the final attempt was over, because the run order it would record did not exist yet. While it waited, for{' '}
          {fmtDuration(i.heldMs)}, agents left {fmtInt(i.heldCommentCount)} comments of evidence on it, where the agent
          that eventually took it could read them.
        </p>
        <p className={styles.prose}>
          Work on an issue starts with an execution, and an execution runs a recipe: a small, fixed graph of nodes,
          each one an agent or an artifact. rs/{a.issue}’s execution started at {at(i.start)} and ran the {a.recipe} recipe,
          which has {countWord(i.recipe.length)} nodes: a trigger, a builder agent and a pull request.
        </p>
        <p className={styles.prose}>
          The builder worked in turns. A turn is one stretch of an agent working, and it ends when the agent has
          nothing to do until something happens; the harness starts the next turn when that something does. The
          builder’s first turn ended when it started the full test suite. The tests kept running while the agent sat
          idle, and {countWord(i.testWakes)} of its later turns began when a test run finished.{' '}
          {capitalize(countWord(i.messageWakes))} began with a message from rs/{i.reviewerIssue}, the coordinator
          reviewing its work, and {countWord(i.bothWakes)} with a finished command and {countWord(i.bothMessages)}{' '}
          messages from rs/{i.reviewerIssue} at once.
        </p>
        <Figure
          title={titles.issue}
          sub="The time axis is broken twice: the hours held and the wait for merge are squeezed, the builder’s hour stretched. Press Play to light the recipe node that holds the issue."
        >
          <IssueLife m={m} label={titles.issue} />
        </Figure>
        <p className={styles.prose}>
          The pull request is an artifact: something an agent writes that the harness then acts on. The builder’s first
          version, at {fmtPacificHm(i.versions[0]!)}, opened pull request #{i.pr}. rs/{i.reviewerIssue} reviewed it by
          message, and the builder answered each round by writing a new version of the artifact,{' '}
          {countWord(i.versions.length)} in all. At {fmtPacificHm(i.review)} a comment on the issue recorded “Final
          independent review approved”, and at {fmtPacificHm(i.merged)} the {i.mergedBy} thread merged the pull
          request, which closed the issue.
        </p>
        <p className={styles.prose}>
          Cairn’s documentation describes a different path. Its standard recipe is planbuild: a planner writes a
          plan, a person confirms it, and then a builder, a pull request and a review agent follow. planbuild waits on a
          person at every plan. The run used it for {fmtInt(m.planbuild.executions)} executions and used build for
          almost all the rest, and it reviewed the way rs/{i.reviewerIssue} did, with a coordinator reading the work and
          answering by message. The whole run had {fmtInt(t.reviewJobs)} review jobs. I read those counts as a consequence
          of there being one person: a recipe that stops for that person at every plan does not scale to hundreds of
          issues, so the run skipped the plan and let coordinators review.
        </p>
        <Figure title={titles.recipes} sub="The recipes as the run stored them, with the executions of each">
          <Recipes m={m} />
        </Figure>
        <p className={styles.prose}>
          An issue can have more than one execution. Starting a new one supersedes the one before, and nothing is
          deleted: rs/{m.rs302.issue} has {countWord(m.rs302.executions)} executions on record, and the first{' '}
          {countWord(m.rs302.superseded)} are marked superseded. A retry and the attempts it replaced stay side by side
          on the issue.
        </p>
        <Sources lines={[...s.issue843!, ...s.recipes!]} />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Three verbs</h2>
        <p className={styles.prose}>
          Agents act on all of these objects with three verbs. read fetches and searches anything with an address. write changes things: it edits files,
          and it also files issues, sends messages, writes artifacts and subscribes to wakes. run executes commands.
          Each call carries a batch of items, and each item names its target by address, so one call can reach several
          kinds of object at once.
        </p>
        <p className={styles.prose}>
          Here is a call main made at {fmtPacificHms(m.write.t)} on the first afternoon. The game client running in its
          terminal had hung, in the fletching-menu bug the story tells.
        </p>
        <Figure title={titles.write} sub="The main thread’s call, its items as sent (the new issue’s description shortened)">
          <WriteCard
            m={m}
            glosses={[
              'stop the hung game client',
              'start a fresh one at the same address: a terminal is an object too',
              <>
                wake me when it prints this. <code>cairn:~/</code> is whoever makes the call, here{' '}
                <code>{ADDRESSES.thread}</code>
              </>,
              `file rs/${filed.issue}, the project’s first issue, and start a builder on it`,
            ]}
          />
        </Figure>
        <p className={styles.prose}>
          The first two items replace the client. A terminal has an address like everything else, so main could delete
          it and create it again the way it would a file. The third item asks the harness to wake main when the new
          client prints “{subscribe.phrase}”, so main could end its turn instead of watching the output. The{' '}
          <code>~</code> in these targets means the agent making the call, so <code>{ADDRESSES.wakes}</code> is
          main’s own list of wake subscriptions. The fourth item files rs/{filed.issue}, the project’s first issue, by
          appending it to the issues collection, and names the recipe to start on it. Filing an issue is a write like
          any other, and so is merging a pull request. (The builder that took rs/{filed.issue} found the hang began with
          a malformed call in main’s own script, which neither client rejected.)
        </p>
        <p className={styles.prose}>
          The verb an agent used most shows what its job was. Builders ran commands above all:{' '}
          {fmtInt(verbsBuilders.run)} of their {fmtInt(verbsBuilders.total)} calls were run. Coordinators and threads
          used write more than anything else, because filing issues, sending messages and merging are all writes.
        </p>
        <Figure title={titles.verbs} sub="Each role’s verb calls over the run">
          <VerbMix m={m} />
          <p className={styles.note}>
            Not shown: {fmtInt(m.verbs.rest)} calls by planners, reviewers, the integrator and{' '}
            {fmtInt(t.exploreTasks)} explore tasks.
          </p>
        </Figure>
        <Sources lines={[...s.write333!, ...s.verbs!]} />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Asking, answering, reporting up</h2>
        <p className={styles.prose}>
          Agents need decisions from the person, and the person needs to hear what the agents did. Cairn routes both
          through objects. A question is an object the
          harness puts in front of the operator. A decision travels down as a message, and a report travels up as a
          message to whoever filed the work. A message wakes the agent it is addressed to.
        </p>
        <p className={styles.prose}>
          These are {countWord(r.spanMinutes)} minutes on the first evening around rs/{r.coordinator}, the quest-route
          coordinator, with main above it, the operator above main, and its {fmtInt(r.childCount)} child issues below.
        </p>
        <Figure
          title={titles.routing}
          sub={`The rs/${r.coordinator} coordinator, its parent thread main, its child issues, and the two fixes it started`}
        >
          <Routing m={m} label={titles.routing} />
        </Figure>
        <p className={styles.prose}>
          The question has its own address, <code>{ADDRESSES.question}</code>, and the operator’s part in these
          minutes was one answer to it, {fmtInt(r.answerSeconds)} seconds after it was asked. Everything else was
          agents messaging agents. Two of them acted on
          the same fixes at once. rs/{r.coordinator} started rs/{r.started[0]} and rs/{r.started[1]} on the operator’s
          answer, and seconds later main started both as well. Supersession settled which start counted: main’s became
          execution {r.mainExecution} of each, and rs/{r.coordinator}’s are marked superseded.
        </p>
        <p className={styles.prose}>
          Every turn an agent takes opens with a briefing from the harness that says what woke it. Counted over the
          whole run, nearly all of those wakes were messages from other agents.
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
          Waking on messages left one gap. Coordinators needed to check their running children for stuck turns, and a
          coordinator’s execution could not schedule a recurring wake to do it. The workaround was an instruction from
          the operator, which the harness delivered {fmtInt(m.wakes.backstops)} times. It read:
        </p>
        <Quote words={`${q.backstop!.words} …`} by={`the harness, ${at(q.backstop!.t)} ${fmtPacificDayLong(q.backstop!.t).split(' ').slice(1).join(' ')}`} />
        <Sources lines={[...s.rs3!, ...s.wakes!, ...s.routing!]} />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Tenets: the rules only the operator makes</h2>
        <p className={styles.prose}>
          Some decisions have to reach every agent, including agents that do not exist yet. In Claude Code you would
          write them into a CLAUDE.md file. In Cairn they are tenets. A thread proposes a tenet, a statement of how the
          project does something. Only the operator can answer it, and once approved it binds every agent that comes
          after. The operator answered quickly, half the time within{' '}
          {T.medianWaitMinutes <= 1 ? 'a minute' : `${fmtInt(T.medianWaitMinutes)} minutes`}, and one tenet, #
          {awaiting?.n}, is still waiting.
        </p>
        <Figure
          title={titles.tenets}
          sub={`Each row a tenet: proposed (tick) to answered (mark). Tenet ${T.research.n}, quoted above, in the accent.`}
        >
          <TenetLedger m={m} label={titles.tenets} />
        </Figure>
        <p className={styles.prose}>
          Here is the last tenet the operator approved. A thread proposed it on the Sunday night the story tells, after
          the scored account died.
        </p>
        <Quote
          words={T.quoted.statement ?? ''}
          by={
            <>
              rs tenet {T.quoted.n}, <code>{ADDRESSES.tenet}</code>, approved at {at(T.quoted.answered!)},{' '}
              {countWord(m.quotedSeconds)} seconds after a thread proposed it
            </>
          }
        />
        <p className={styles.prose}>
          The documentation describes tenets as gates: a filing waits until the operator rules on it. In the run,
          only {countWord(T.gates.length)} worked that way ({listWords(T.gates.map((n) => `#${n}`))}). The rest were
          standing rules, and standing rules change: a later tenet supersedes an earlier one, and the ledger draws each
          supersession as a curve. The rule on merging moved twice. Tenet {m.mergeChain[0]} said the main thread merges
          child pull requests; tenet {m.mergeChain[1]} superseded it, and tenet {m.mergeChain[2]} superseded that. By
          the end main had merged {fmtInt(m.merges.main)} pull requests by write call, coordinators{' '}
          {fmtInt(m.merges.coordinators)} and the integration thread {fmtInt(m.merges.integration)}, among them rs/
          {a.issue}’s.
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
          All that merging had a cost. Each issue’s work sat on its own branch, and every merge into the base branch
          moved the base under every other open branch. The harness rebased those branches itself
          when it could, and sent the agent a notice when it could not. When the operator asked for this page, at{' '}
          {at(q.hindrance!.t)}, they wrote that Cairn had played a major role, and was also a “{q.hindrance!.words}”.
        </p>
        <Figure
          title={titles.git}
          sub="The harness’s branch notices per day. Light: rebased by the harness, nothing to do. Ink: an agent had to act."
        >
          <GitNotices m={m} label={titles.git} />
        </Figure>
        <p className={styles.prose}>
          Over the run, {fmtInt(m.git.blocking)} notices needed an agent to act on its branch. Some cost more than a
          turn. At {at(q.publish!.t)}, rs/{q.publish!.issue}’s builder could not publish its
          branch, and writing its pull request artifact again had not helped:
        </p>
        <Quote words={q.publish!.words} by={`rs/${q.publish!.issue}’s builder, ${at(q.publish!.t)}`} />
        <p className={styles.prose}>
          {capitalize(countWord(m.oneOffMinutes))} minutes later main answered, “{q.oneOff!.words}”, and the branch was
          published.
        </p>
        <Sources lines={[...s.git!, ...s.friction!]} />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Why one person could run it</h2>
        <p className={styles.prose}>
          Put together, these objects decide what reaches the person. Agents file the work, start it, review it and
          merge it by writing to objects, and they wake each other with messages. What rises to the operator is narrow:
          questions, tenets to rule on, and what the threads choose to report.
        </p>
        <p className={styles.prose}>
          So the operator’s side of the run was {fmtInt(o.inputs)} inputs over {countWord(m.window.days)} days, counting
          typed messages, answers to questions and tenet verdicts. The agents’ side was {fmtInt(o.agents)} messages to
          each other.
        </p>
        <Figure title={titles.operator} sub="Over the run, on one scale">
          <OperatorShare m={m} />
        </Figure>
        <p className={styles.prose}>
          Many of the operator’s inputs were tiny: {fmtInt(o.carets)} messages were a single “^”, which tells an agent
          to go on.
        </p>
        <Sources lines={s.operator!} />
      </section>
    </article>
  );
}
