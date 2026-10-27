import { useEffect, useState } from 'react';
import { timeline } from '../data/timeline';
import { buildChartModel, recordFacts } from '../attempts/model';
import { TimelineChart } from '../attempts/TimelineChart';
import { Clip } from '../clips/Clip';
import { clipById } from '../clips/registry';
import styles from './Tokens.module.css';

/**
 * Footage shown here in the shared frame: two 3D replay windows no page places yet, which share the
 * page's one world and take its stage in turn, and a video clip the story places.
 */
export const TOKENS_CLIPS = ['agility-lap', 'agility-rocks', 'finish-rekit'] as const;

const COLOURS = ['--paper', '--paper-shade', '--ink', '--ink-muted', '--ink-faint', '--accent', '--hairline', '--rule'] as const;

const SERIF_STEPS = [
  ['--text-title', 'Title', 600],
  ['--text-section', 'Section heading', 600],
  ['--text-dek', 'Dek and operator quotes', 400],
  ['--text-body', 'Body text', 400],
  ['--text-small', 'Small text and asides', 400],
] as const;

const SANS_STEPS = [
  ['--label-lg', 'Chart titles'],
  ['--label', 'Kickers, captions, legends'],
  ['--label-sm', 'Small caps labels'],
] as const;

const SAMPLE = 'The hiscore ranks accounts by the in-world tick of their last level-up.';

/** Development-only screen for judging the look: palette, type scale, figures, hairlines, one real chart. */
export default function Tokens() {
  const [values, setValues] = useState<Record<string, string>>({});
  useEffect(() => {
    document.title = 'Tokens · rune.fast';
    const cs = getComputedStyle(document.documentElement);
    setValues(Object.fromEntries([...COLOURS, ...SERIF_STEPS.map((s) => s[0]), ...SANS_STEPS.map((s) => s[0])].map((k) => [k, cs.getPropertyValue(k).trim()])));
  }, []);

  const model = buildChartModel(timeline);

  return (
    <article className={styles.page}>
      <h1 className={styles.h1}>Tokens</h1>

      <section className={styles.block}>
        <h2 className={styles.h2}>Palette</h2>
        <div className={styles.swatches}>
          {COLOURS.map((c) => (
            <div key={c} className={styles.swatch}>
              <div className={styles.chip} style={{ background: `var(${c})` }} />
              <code>{c}</code>
              <span className={styles.value}>{values[c]}</span>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.block}>
        <h2 className={styles.h2}>Serif: Rune Serif (Source Serif 4)</h2>
        {SERIF_STEPS.map(([v, label, weight]) => (
          <div key={v} className={styles.step}>
            <span className={styles.stepMeta}>
              <code>{v}</code> {label}
            </span>
            <p style={{ fontSize: `var(${v})`, fontWeight: weight, lineHeight: 1.25 }}>{SAMPLE}</p>
          </div>
        ))}
        <div className={styles.step}>
          <span className={styles.stepMeta}>Italic</span>
          <p className={styles.italic}>we’re not done until #1</p>
        </div>
        <div className={styles.step}>
          <span className={styles.stepMeta}>Figures</span>
          <p className={styles.figures}>
            <span>Old-style 35,787 · 35,916 · 129</span>
            <span className={styles.tabular}>Tabular 35,787 · 35,916 · 129</span>
            <span className={styles.smallCaps}>Small caps for Attempt Five</span>
          </p>
        </div>
      </section>

      <section className={styles.block}>
        <h2 className={styles.h2}>Sans: IBM Plex Sans</h2>
        {SANS_STEPS.map(([v, label]) => (
          <div key={v} className={styles.step}>
            <span className={styles.stepMeta}>
              <code>{v}</code>
            </span>
            <p className={styles.sans} style={{ fontSize: `var(${v})` }}>
              {label}: 11:00 AM · logged out 9 h 08 min
            </p>
          </div>
        ))}
        <div className={styles.step}>
          <span className={styles.stepMeta}>Caps</span>
          <p className={styles.caps}>The attempts · Saturday 24 October</p>
        </div>
      </section>

      <section className={styles.block}>
        <h2 className={styles.h2}>Strokes</h2>
        <svg width="100%" height="64" className={styles.strokes} aria-hidden="true">
          {(['--stroke-hair', '--stroke-thin', '--stroke-rule'] as const).map((s, i) => (
            <g key={s}>
              <line x1="0" x2="60%" y1={12 + i * 20} y2={12 + i * 20} style={{ stroke: 'var(--ink)', strokeWidth: `var(${s})` }} />
              <text x="62%" y={16 + i * 20}>{s}</text>
            </g>
          ))}
        </svg>
      </section>

      <section className={`${styles.block} ${styles.full}`}>
        <h2 className={styles.h2}>Footage: two 3D replays and a video clip, in the one frame</h2>
        {TOKENS_CLIPS.map((id) => (
          <div key={id} className={styles.footage}>
            <Clip clip={clipById(id)} />
          </div>
        ))}
      </section>

      <section className={styles.block}>
        <h2 className={styles.h2}>A hairline chart</h2>
        <TimelineChart model={model} finishTicks={recordFacts(timeline).final} />
      </section>
    </article>
  );
}
