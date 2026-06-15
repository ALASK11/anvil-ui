/**
 * Parse a GCS reference into { bucket, object }. Accepts:
 *   - gs://bucket/path/to/object
 *   - https://storage.googleapis.com/bucket/path/to/object
 *   - https://storage.cloud.google.com/bucket/path/to/object
 *   - https://bucket.storage.googleapis.com/path/to/object
 *
 * Used by the /api/doc proxy route to translate a database-stored URL into
 * a (bucket, object) pair for the Storage client.
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
