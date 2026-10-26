import { useEffect, useState } from 'react';
import type { LiveController, MapViewer } from '@rune/world';
import { canonicalAccountName } from '@rune/world/live/accountName';
import type { LivePlayer } from '@rune/world/live/LiveEntity';
import styles from './Replay.module.css';

type Row = { player: LivePlayer; distance: number; record: boolean };

const MAX_ROWS = 12;

/**
 * Who the camera follows: the record account first, then the players drawn near the camera,
 * nearest first. Everyone but the record account is shown by slot.
 */
export function RosterPicker({ viewer, controller, recordName }: { viewer: MapViewer; controller: LiveController; recordName: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [followed, setFollowed] = useState<number>();
  const record = canonicalAccountName(recordName);

  useEffect(() => {
    const refresh = () => {
      const cx = viewer.camera.getPosX();
      const cz = viewer.camera.getPosZ();
      const near: Row[] = [];
      for (const player of controller.world.players.values()) {
        if (!player.name) continue;
        const distance = Math.hypot(player.x / 128 - cx, player.z / 128 - cz);
        const isRecord = canonicalAccountName(player.name) === record;
        if (isRecord || distance <= viewer.renderDistance) near.push({ player, distance, record: isRecord });
      }
      near.sort((a, b) => Number(b.record) - Number(a.record) || a.distance - b.distance);
      setRows(near.slice(0, MAX_ROWS));
      setFollowed(controller.getFollowed()?.id);
    };
    refresh();
    const timer = setInterval(refresh, 1000);
    return () => clearInterval(timer);
  }, [viewer, controller, record]);

  const followingRecord = controller.followName !== undefined && canonicalAccountName(controller.followName) === record;

  return (
    <aside className={styles.picker} aria-label="Follow a player">
      <h2 className={styles.pickerTitle}>Following</h2>
      <ul className={styles.rows}>
        {rows.map(({ player, distance, record: isRecord }) => (
          <li key={player.id}>
            <button
              type="button"
              className={player.id === followed ? styles.rowOn : styles.row}
              onClick={() => controller.follow(player)}
              aria-pressed={player.id === followed}
            >
              <span>{isRecord ? `${player.name}, the record account` : player.name}</span>
              <span className={styles.distance}>{isRecord ? '' : `${Math.round(distance)} tiles`}</span>
            </button>
          </li>
        ))}
      </ul>
      {!followingRecord && (
        <button type="button" className={styles.back} onClick={() => controller.goToPlayer(recordName, viewer.camera)}>
          Back to the record account
        </button>
      )}
    </aside>
  );
}
