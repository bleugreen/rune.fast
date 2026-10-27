import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { NotFound } from '../pages/NotFound';
import { momentById } from './moments';
import { Replay } from './Replay';
import styles from './MomentPage.module.css';

/** /replay/:moment: one moment of the finish, replayed in the game world beside its code. */
export default function MomentPage() {
  const moment = momentById(useParams().moment);

  useEffect(() => {
    if (moment) document.title = `${moment.title} · Replays · rune.fast`;
  }, [moment]);

  if (!moment) return <NotFound />;
  return (
    <article className={styles.page}>
      <header className={styles.head}>
        <p className={styles.kicker}>
          <Link to="/replay">Replays</Link>
        </p>
        <h1 className={styles.title}>{moment.title}</h1>
        <p className={styles.dek}>{moment.caption}</p>
      </header>
      <Replay key={moment.id} moment={moment} />
      <p className={styles.note}>
        The world as the swarm's recorder saw it on 26 October, drawn by the rs-map-viewer engine from the game
        cache of the server the run played on. The camera follows the record account; no other player is named,
        and their names and chat were removed from the recording before it was published.
      </p>
    </article>
  );
}
