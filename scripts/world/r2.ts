/**
 * The R2 bucket behind assets.mage.md (README, "Hosting"): a client from the environment, and the
 * one PUT every publishing script uses, which sets the headers the bucket then serves.
 */

/** The token's four variables; load them into the one process that uploads (bun --env-file). */
export const R2_ENV = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'] as const;

/** For objects whose key names their content: chunks, the cache store, videos. */
export const IMMUTABLE = 'public, max-age=31536000, immutable';

export function r2Client(): Bun.S3Client {
  const missing = R2_ENV.filter((k) => !process.env[k]);
  if (missing.length) throw new Error(`uploading to R2 needs ${missing.join(', ')}`);
  return new Bun.S3Client({
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucket: process.env.R2_BUCKET,
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  });
}

export async function putObject(
  s3: Bun.S3Client,
  key: string,
  body: Uint8Array<ArrayBuffer> | Blob,
  size: number,
  meta: { type: string; cacheControl: string; contentEncoding?: string },
): Promise<void> {
  // Bun's S3 writer sets Content-Type; Cache-Control and Content-Encoding go through a presigned PUT.
  const url = s3.presign(key, { method: 'PUT', expiresIn: 600 });
  const headers: Record<string, string> = { 'Content-Type': meta.type, 'Cache-Control': meta.cacheControl };
  if (meta.contentEncoding) headers['Content-Encoding'] = meta.contentEncoding;
  const resp = await fetch(url, { method: 'PUT', body, headers });
  if (!resp.ok) throw new Error(`upload of ${key} failed: HTTP ${resp.status}`);
  console.log(`uploaded ${key} (${size} bytes)`);
}
