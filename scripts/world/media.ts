import { createHash } from 'node:crypto';

/** An MP4's first video track: its frame size from tkhd and the movie's length from mvhd. */
export function mp4Facts(buf: Buffer): { width: number; height: number; seconds: number } {
  let width = 0;
  let height = 0;
  let seconds = 0;
  const walk = (from: number, to: number) => {
    for (let at = from; at + 8 <= to; ) {
      let size = buf.readUInt32BE(at);
      const type = buf.toString('latin1', at + 4, at + 8);
      let body = at + 8;
      if (size === 1) {
        size = Number(buf.readBigUInt64BE(at + 8));
        body = at + 16;
      } else if (size === 0) size = to - at;
      if (type === 'moov' || type === 'trak') walk(body, at + size);
      if (type === 'mvhd') {
        const v1 = buf[body] === 1;
        const scale = buf.readUInt32BE(body + (v1 ? 20 : 12));
        const length = v1 ? Number(buf.readBigUInt64BE(body + 24)) : buf.readUInt32BE(body + 16);
        seconds = length / scale;
      }
      if (type === 'tkhd' && !width) {
        const end = at + size;
        // Width and height close the box, as 16.16 fixed point; an audio track's are zero.
        width = buf.readUInt32BE(end - 8) / 65536;
        height = buf.readUInt32BE(end - 4) / 65536;
      }
      at += size;
    }
  };
  walk(0, buf.length);
  return { width, height, seconds };
}

/** A baseline or progressive JPEG's frame size, from its start-of-frame marker. */
export function jpegSize(buf: Buffer): { width: number; height: number } {
  for (let at = 2; at + 9 < buf.length; ) {
    const marker = buf[at + 1]!;
    const len = buf.readUInt16BE(at + 2);
    if (marker >= 0xc0 && marker <= 0xc3) return { height: buf.readUInt16BE(at + 5), width: buf.readUInt16BE(at + 7) };
    at += 2 + len;
  }
  throw new Error('no start-of-frame marker');
}

/** The eight hex digits of a file's SHA-256 that its published name carries. */
export function contentTag(buf: Uint8Array): string {
  return createHash('sha256').update(buf).digest('hex').slice(0, 8);
}
