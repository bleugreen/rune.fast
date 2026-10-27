import { Fragment, type ReactNode } from 'react';
import type { HarnessModel } from '../model';
import type { WriteItem } from '../types';
import styles from './Figures.module.css';

/** A value as an agent writes it in a call: bare keys, quoted strings. */
function literal(v: unknown): string {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    return `{${Object.entries(v)
      .map(([k, x]) => `${k}:${literal(x)}`)
      .join(', ')}}`;
  }
  return JSON.stringify(v);
}

/** The issue's title before its description, as a reader would look for it. */
const ORDER = ['title', 'execution', 'command', 'subscribe', 'description'];
const ordered = (p: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(p).sort(([a], [b]) => (ORDER.indexOf(a) + 99) % 99 - (ORDER.indexOf(b) + 99) % 99));

function itemText(it: WriteItem): string {
  const head = `  {mode:${JSON.stringify(it.mode)}, target:${JSON.stringify(it.target)}`;
  return it.payload ? `${head},\n   payload:${literal(ordered(it.payload))}},` : `${head}},`;
}

/** main's four-item write on the first afternoon, as sent, with what each item did in the margin. */
export function WriteCard({ m, glosses }: { m: HarnessModel; glosses: readonly ReactNode[] }) {
  const items = m.write.items;
  if (glosses.length !== items.length) throw new Error('One gloss per item of the write');
  return (
    <div className={styles.card}>
      <pre>
        <span className={styles.verb}>write</span>({'{'}changes:[
      </pre>
      <div className={styles.gloss}>
        <b>the verb</b>one call, its items applied in order
      </div>
      {items.map((it, k) => (
        <Fragment key={k}>
          <pre>{itemText(it)}</pre>
          <div className={styles.gloss}>{glosses[k]}</div>
        </Fragment>
      ))}
      <pre>]{'}'})</pre>
      <div className={styles.gloss} />
    </div>
  );
}
