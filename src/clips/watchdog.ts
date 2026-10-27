/**
 * Footage asked to play that has not moved on for this long has stalled: its frame goes back to the
 * poster with a message, and playing it again starts over. The one bound for videos and replays.
 */
export const STALL_MS = 30_000;

/**
 * Watches footage the reader has asked to play. `moved` is called whenever it shows that it is
 * getting somewhere (bytes arriving, a frame shown, the playhead advancing), `stalled` asks whether
 * it has gone `ms` without doing so. Paused footage is not watched: `rest` stops the watch and
 * `watch` starts it again from that moment.
 */
export class ProgressWatch {
  private last: number | null = null;
  constructor(private readonly ms = STALL_MS) {}
  watch(now: number) {
    this.last = now;
  }
  moved(now: number) {
    if (this.last !== null) this.last = now;
  }
  rest() {
    this.last = null;
  }
  stalled(now: number): boolean {
    return this.last !== null && now - this.last >= this.ms;
  }
}
