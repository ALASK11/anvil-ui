import { Storage } from '@google-cloud/storage'

// Single Storage client reused across requests. Uses Application Default
// Credentials — the compute service account on Cloud Run, or your gcloud ADC
// locally (see `gcloud auth application-default login`).
let storage: Storage | null = null

function getStorage(): Storage {
  if (!storage) storage = new Storage()
  return storage
}

// How long a generated signed URL stays valid.
const SIGNED_URL_TTL_MS = 60 * 60 * 1000 // 1 hour

/**
 * Parse a GCS reference into { bucket, object }. Accepts:
 *   - gs://bucket/path/to/object
 *   - https://storage.googleapis.com/bucket/path/to/object
 *   - https://storage.cloud.google.com/bucket/path/to/object
 *   - https://bucket.storage.googleapis.com/path/to/object
 */
export function parseGcsUrl(url: string | null): { bucket: string; object: string } | null {
  if (!url) return null

  if (url.startsWith('gs://')) {
    const rest = url.slice('gs://'.length)
    const slash = rest.indexOf('/')
    if (slash === -1) return null
    const bucket = rest.slice(0, slash)
    const object = rest.slice(slash + 1)
    return bucket && object ? { bucket, object } : null
  }

  try {
    const u = new URL(url)
    if (u.hostname === 'storage.googleapis.com' || u.hostname === 'storage.cloud.google.com') {
      const parts = u.pathname.replace(/^\/+/, '').split('/')
      const bucket = parts.shift()
      const object = decodeURIComponent(parts.join('/'))
      return bucket && object ? { bucket, object } : null
    }
    if (u.hostname.endsWith('.storage.googleapis.com')) {
      const bucket = u.hostname.slice(0, -'.storage.googleapis.com'.length)
      const object = decodeURIComponent(u.pathname.replace(/^\/+/, ''))
      return bucket && object ? { bucket, object } : null
    }
  } catch {
    return null
  }

  return null
}

/**
 * Generate a V4 read-only signed URL for a GCS object so it can be opened
 * directly in the browser. Returns null (rather than throwing) on any failure,
 * so a single un-signable document never breaks page rendering.
 *
 * Signing requires an identity that can sign: a service account key, or — when
 * running on ADC without a private key — the IAM `signBlob` permission
 * (roles/iam.serviceAccountTokenCreator) on the active service account.
 */
export async function signGcsUrl(gcsUrl: string | null): Promise<string | null> {
  const parsed = parseGcsUrl(gcsUrl)
  if (!parsed) return null

  try {
    const [signed] = await getStorage()
      .bucket(parsed.bucket)
      .file(parsed.object)
      .getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + SIGNED_URL_TTL_MS,
      })
    return signed
  } catch (err) {
    console.error(`[gcs] failed to sign URL for ${gcsUrl}:`, err)
    return null
  }
}
