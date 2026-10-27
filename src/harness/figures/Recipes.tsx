import { fmtInt, listWords } from '../../lib/numbers';
import type { HarnessModel } from '../model';
import styles from './Figures.module.css';

/** The three recipes most executions ran, drawn from their stored snapshots, with the count of each. */
export function Recipes({ m }: { m: HarnessModel }) {
  const shown = m.recipes.filter((r) => ['build', 'coordinator', 'planbuild'].includes(r.id));
  const rest = m.recipes.filter((r) => !shown.includes(r));
  return (
    <div>
      <ol className={styles.recipes}>
        {shown.map((r) => (
          <li key={r.id} className={styles.recipe}>
            <span className={styles.recipeName}>{r.id}</span>
            <span className={styles.chain}>
              {r.nodes.map((n, k) => (
                <span key={k} className={styles.step} data-waits={n.waits}>
                  <span className={styles.node} data-type={n.type} data-waits={n.waits} />
                  {n.waits ? `${n.name.toLowerCase()} you confirm` : n.type === 'pr' ? 'pull request' : n.name.toLowerCase()}
                </span>
              ))}
            </span>
            <span className={styles.recipeCount}>×{fmtInt(r.executions)}</span>
          </li>
        ))}
      </ol>
      <p className={styles.footnote}>
        Circles are agents, squares are artifacts and pull requests. Also {listWords(rest.map((r) => `${r.id} ×${fmtInt(r.executions)}`))}:{' '}
        {fmtInt(m.recipeTotal)} executions in all.
      </p>
    </div>
  );
}
