import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * File storage sits on Supabase Storage (same project as the Postgres DB), not
 * Cloudflare R2 — there are no R2 credentials and adding a second vendor buys
 * nothing here. The public surface below is deliberately storage-agnostic
 * (`uploadFile` / `getPresignedUpload` / `getPresignedDownload` / `deleteFile`)
 * so a future move to R2 or S3 is a single-file swap.
 *
 * Writes use the service-role key and therefore bypass RLS. Every caller MUST
 * have already authorised the request — the bucket is private and the only way
 * out is a short-lived signed URL.
 */

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? "stackfox-files";
const WORM_BUCKET = process.env.SUPABASE_WORM_BUCKET ?? "stackfox-worm";

let client: SupabaseClient | null = null;

function supabase(): SupabaseClient {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error(
      "Storage is not configured: SUPABASE_URL and SUPABASE_SECRET_KEY must be set.",
    );
  }

  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

/** True when storage credentials are present — lets routes fail with 503 rather than 500. */
export function isStorageConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
}

export async function uploadFile(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string,
  worm = false,
): Promise<string> {
  const bucket = worm ? WORM_BUCKET : BUCKET;
  const { error } = await supabase()
    .storage.from(bucket)
    .upload(key, body, { contentType, upsert: !worm });

  if (error) throw new Error(`Storage upload failed for ${key}: ${error.message}`);
  return key;
}

export async function getPresignedDownload(
  key: string,
  expiresIn = 3600,
): Promise<string> {
  // `download: true` forces Content-Disposition: attachment on the signed
  // response. Content-Type at upload time is browser-controlled (Supabase
  // binds it at PUT, not at signing — see getPresignedUpload below), so an
  // uploaded HTML/SVG file opened directly would otherwise render inline
  // instead of downloading — a stored-XSS path through file sharing.
  const { data, error } = await supabase()
    .storage.from(BUCKET)
    .createSignedUrl(key, expiresIn, { download: true });

  if (error || !data) {
    throw new Error(`Could not sign download for ${key}: ${error?.message ?? "no url returned"}`);
  }
  return data.signedUrl;
}

/**
 * Returns a URL the browser can PUT straight to, so large files never transit
 * the API process. `contentType` is accepted for parity with the S3 signer but
 * Supabase binds the type at upload time, not at signing time.
 */
export async function getPresignedUpload(
  key: string,
  _contentType: string,
  _expiresIn = 600,
): Promise<{ url: string; token: string }> {
  const { data, error } = await supabase()
    .storage.from(BUCKET)
    .createSignedUploadUrl(key);

  if (error || !data) {
    throw new Error(`Could not sign upload for ${key}: ${error?.message ?? "no url returned"}`);
  }
  return { url: data.signedUrl, token: data.token };
}

export async function deleteFile(key: string): Promise<void> {
  const { error } = await supabase().storage.from(BUCKET).remove([key]);
  if (error) throw new Error(`Storage delete failed for ${key}: ${error.message}`);
}

/** Copies a generated document into the write-once bucket (invoices, signed contracts). */
export async function copyToWorm(key: string, body: Buffer): Promise<string> {
  const wormKey = `worm/${key}`;
  await uploadFile(wormKey, body, "application/pdf", true);
  return wormKey;
}

/** Streams an object back into the API process (PDF regeneration, WORM copies). */
export async function downloadFile(key: string): Promise<Buffer> {
  const { data, error } = await supabase().storage.from(BUCKET).download(key);
  if (error || !data) {
    throw new Error(`Storage download failed for ${key}: ${error?.message ?? "no data"}`);
  }
  return Buffer.from(await data.arrayBuffer());
}
