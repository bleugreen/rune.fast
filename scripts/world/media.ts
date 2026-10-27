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

/** A WebP's canvas size, from its VP8X, lossless (VP8L) or lossy (VP8) header. */
export function webpSize(buf: Buffer): { width: number; height: number } {
  if (buf.toString('latin1', 0, 4) !== 'RIFF' || buf.toString('latin1', 8, 12) !== 'WEBP') throw new Error('not a WebP');
  const chunk = buf.toString('latin1', 12, 16);
  if (chunk === 'VP8X') return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
  if (chunk === 'VP8L') {
    const bits = buf.readUInt32LE(21);
    return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >>> 14) & 0x3fff) };
  }
  if (chunk === 'VP8 ') return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
  throw new Error(`unknown WebP chunk ${chunk}`);
}

/** An AVIF's image size, from its image spatial extents property (`ispe`). */
export function avifSize(buf: Buffer): { width: number; height: number } {
  const at = buf.indexOf('ispe', 0, 'latin1');
  if (at < 0) throw new Error('no ispe property');
  return { width: buf.readUInt32BE(at + 8), height: buf.readUInt32BE(at + 12) };
}

/**
 * Writes a clip poster's AVIF beside its JPEG (x.jpg to x.avif), at the quality the figures'
 * column AVIFs use: about half the JPEG's bytes and, at the column's size, the same picture.
 * Needs ImageMagick with AVIF.
 */
export function encodePosterAvif(jpg: string): string {
  if (!jpg.endsWith('.jpg')) throw new Error(`${jpg}: a poster is a .jpg`);
  const avif = jpg.replace(/\.jpg$/, '.avif');
  const p = Bun.spawnSync(['magick', jpg, '-strip', '-quality', '60', avif], { stdout: 'pipe', stderr: 'pipe' });
  if (p.exitCode !== 0) throw new Error(`magick ${jpg}: ${p.stderr.toString()}`);
  return avif;
}

/** The eight hex digits of a file's SHA-256 that its published name carries. */
export function contentTag(buf: Uint8Array): string {
  return createHash('sha256').update(buf).digest('hex').slice(0, 8);
}
