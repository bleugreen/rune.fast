import { useContext, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clip } from '../clips/Clip';
import { clipById } from '../clips/registry';
import { TRICKS } from '../tricks/model';
import { Break } from './Break';
import type { Route, Step } from './model';
import { PlanBars } from './PlanBars';
import type { StepWords } from './prose';
import { Spine } from './Spine';
import { ClockContext, type Points } from './useReadingTick';
import styles from './Route.module.css';

interface Props {
  step: Step;
  route: Route;
  words: StepWords;
  storyTitles: ReadonlyMap<string, string>;
  /** Breaks that are planned logouts, by their index in the route. */
  planned: ReadonlySet<number>;
  /** The clip whose caption names the page's zone, when this step holds it. */
  zoneClip?: string;
}

const trickName = (id: string) => TRICKS.find((t) => t.id === id)?.name ?? id;

/** The skills the step trains, as their levels from its start to its end: 'Thieving 57–99 · Magic 81–99'. */
export function trainsLine(step: Step): string {
  return step.spec.trains
    .filter((k) => step.levelsTo[k] !== step.levelsFrom[k])
    .map((k) => `${k} ${step.levelsFrom[k]}–${step.levelsTo[k]}`)
    .join(' · ');
}

/**
 * One step: its head (stretch, title, the skills it trains, planned against took), its prose with
 * its clips and breaks, the tricks it used and its sources; and down its left, the spine. The
 * section measures itself so the spine and the rail read the same map: its top is the step's first
 * tick, its bottom the next step's, and each break line holds or moves the clock by its own ticks.
 */
export function StepSection({ step, route, words, storyTitles, planned, zoneClip }: Props) {
  const ref = useRef<HTMLElement>(null);
  const clock = useContext(ClockContext);
  const [geo, setGeo] = useState<{ points: Points; height: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const box = el.getBoundingClientRect();
      const points: [number, number][] = [[0, step.start]];
      for (const h of el.querySelectorAll<HTMLElement>('[data-from]')) {
        const b = h.getBoundingClientRect();
        points.push([b.top - box.top, Number(h.dataset.from)], [b.bottom - box.top, Number(h.dataset.to)]);
      }
      points.push([box.height, step.end]);
      setGeo({ points, height: box.height });
      clock?.set(el, points);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      ro.disconnect();
      clock?.remove(el);
    };
  }, [step, clock]);

  const blocks = words.body(step, route);
  const placed = new Set(blocks.flatMap((b) => ('brk' in b ? [b.brk] : [])));
  const unplaced = step.breaks.map((_, i) => i).filter((i) => !placed.has(i));
  const firstOfStretch = route.steps[step.index - 1]?.stretch.id !== step.stretch.id;
  const headingId = `${step.spec.id}-title`;

  const renderBreak = (i: number) => {
    const b = step.breaks[i]!;
    return <Break key={`brk-${i}`} brk={b} route={route} story={{ id: b.story, title: storyTitles.get(b.story) ?? '' }} planned={planned.has(b.index)} />;
  };

  return (
    <section
      ref={ref}
      id={step.spec.id}
      className={firstOfStretch ? `${styles.step} ${styles.stretchStart}` : styles.step}
      aria-labelledby={headingId}
      data-step={step.index}
    >
      <Spine step={step} route={route} points={geo?.points ?? null} height={geo?.height ?? 0} />
      <div className={styles.body}>
        <p className={styles.kicker}>
          {step.stretch.numeral} · {step.stretch.title}
        </p>
        <h2 id={headingId} className={styles.title}>
          {step.spec.title}
        </h2>
        {trainsLine(step) && <p className={styles.trains}>{trainsLine(step)}</p>}
        <PlanBars step={step} />
        {blocks.map((b, i) => {
          if ('p' in b)
            return (
              <p key={i} className={styles.prose}>
                {b.p}
              </p>
            );
          if ('clip' in b) return <Clip key={i} clip={clipById(b.clip)} className={styles.clip} zone={b.clip === zoneClip} />;
          return renderBreak(b.brk);
        })}
        {unplaced.map(renderBreak)}
        {step.spec.tricks.length > 0 && (
          <p className={styles.tricks}>
            Tricks:{' '}
            {step.spec.tricks.map((id, i) => (
              <span key={id}>
                {i > 0 && ' · '}
                <Link to={`/tricks#${id}`}>{trickName(id)}</Link>
              </span>
            ))}
          </p>
        )}
        <details className={styles.sources}>
          <summary>Sources</summary>
          <ul>
            {words.sources(step, route).map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </details>
      </div>
    </section>
  );
}
