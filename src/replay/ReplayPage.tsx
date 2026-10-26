import { useEffect } from 'react';
import { FINISH } from './clips';
import { Replay } from './Replay';
import styles from './ReplayPage.module.css';

/** /replay/finish: the last 41 minutes of the record, replayed in the game world. */
export default function ReplayPage() {
  useEffect(() => {
    document.title = 'The finish, replayed · rune.fast';
  }, []);

  return (
    <article className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>{FINISH.title}</h1>
        <p className={styles.dek}>
          The world as the swarm's recorder saw it on 26 October, from the recovery login at Lumbridge to the last
          Agility level on the Wilderness course. The camera follows the record account; drag the timeline to move
          through it.
        </p>
      </header>
      <Replay clip={FINISH} />
      <p className={styles.note}>
        Every other player is shown by slot number. Their names and chat were removed before the recording was
        published; the record account's name is kept. The world is drawn by the rs-map-viewer engine from the game
        cache of the server the run played on.
      </p>
    </article>
  );
}
