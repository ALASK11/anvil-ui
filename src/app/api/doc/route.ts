import { Storage } from '@google-cloud/storage'
import mammoth from 'mammoth'
import { parseGcsUrl } from '@/lib/gcs'
import { getDocumentForProxy } from '@/lib/db/queries/documents'

/**
 * GET /api/doc?id=<opportunity_document.id>
 *
 * Streams an opportunity document from GCS through the Next.js server back
 * to the browser. Used in place of V4 signed URLs so we don't need an
 * identity that can locally sign blobs — the Cloud Run / dev identity just
 * needs object-read on the bucket.
 *
 * Security: the only client input is a UUID. The proxy looks the doc up in
 * `opportunity_documents` (filtering recalled / superseded), then streams
 * the resolved gs:// URL. Clients can't request arbitrary GCS objects.
 *
 * Auth: relies on the IAP layer in front of Cloud Run for end-user auth.
 */

let storage: Storage | null = null
function getStorage(): Storage {
  if (!storage) storage = new Storage()
  return storage
}

function sanitizeFilename(name: string): string {
  return name.replace(/[\r\n"]/g, '').slice(0, 200) || 'file'
}

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  if (!id) return new Response('missing id', { status: 400 })

  const doc = await getDocumentForProxy(id)
  if (!doc || !doc.gcs_url) return new Response('not found', { status: 404 })

  const parsed = parseGcsUrl(doc.gcs_url)
  if (!parsed) {
    console.error('[api/doc] unparseable gs url for doc', id, doc.gcs_url)
    return new Response('document has invalid GCS URL', { status: 500 })
  }

  const file = getStorage().bucket(parsed.bucket).file(parsed.object)

  let contentType = 'application/octet-stream'
  let contentLength: string | null = null
  try {
    const [metadata] = await file.getMetadata()
    if (typeof metadata.contentType === 'string' && metadata.contentType) {
      contentType = metadata.contentType
    }
    if (metadata.size != null) contentLength = String(metadata.size)
  } catch (e) {
    console.error('[api/doc] metadata fetch failed for', doc.gcs_url, e)
    return new Response('not found or access denied', { status: 404 })
  }

  const filenameForType = (doc.filename ?? parsed.object).toLowerCase()

  // DOCX: browsers can't render Word inline, so convert to HTML on the fly
  // with mammoth and serve as text/html. The consumer iframe treats the URL
  // the same as any other doc.
  if (filenameForType.endsWith('.docx')) {
    let buf: Buffer
    try {
      const [downloaded] = await file.download()
      buf = downloaded
    } catch (e) {
      console.error('[api/doc] docx download failed for', doc.gcs_url, e)
      return new Response('failed to fetch document', { status: 502 })
    }
    let html: string
    try {
      const { value } = await mammoth.convertToHtml({ buffer: buf })
      html = value
    } catch (e) {
      console.error('[api/doc] docx conversion failed for', doc.gcs_url, e)
      return new Response('failed to convert document', { status: 500 })
    }
    const displayName = sanitizeFilename(doc.filename ?? fallbackNameFrom(parsed.object))
    const wrapped = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(displayName)}</title><style>body{margin:0;padding:1.25rem 1.5rem;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.55;color:#1a1a1a;background:#fff;}h1,h2,h3,h4{margin:1.4em 0 .5em;line-height:1.25}p{margin:.6em 0}table{border-collapse:collapse;margin:.75em 0;max-width:100%}td,th{border:1px solid #d0d0d0;padding:.35em .55em;vertical-align:top}img{max-width:100%;height:auto}ul,ol{padding-left:1.4em}code,pre{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px}</style></head><body>${html}</body></html>`
    return new Response(wrapped, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="${displayName}.html"`,
        'Cache-Control': 'private, max-age=300',
      },
    })
  }

  // Force application/pdf when the filename clearly is a PDF — some GCS uploads
  // land with content-type 'application/octet-stream' which makes browsers
  // download instead of render inline in iframes.
  if (filenameForType.endsWith('.pdf') && !contentType.includes('pdf')) {
    contentType = 'application/pdf'
  }

  const nodeStream = file.createReadStream()
  const webStream = new ReadableStream<Uint8Array>({
    start(controller) {
      nodeStream.on('data', (chunk: Buffer) => {
        controller.enqueue(new Uint8Array(chunk))
      })
      nodeStream.on('end', () => controller.close())
      nodeStream.on('error', (err) => {
        console.error('[api/doc] stream error for', doc.gcs_url, err)
        controller.error(err)
      })
    },
    cancel() {
      nodeStream.destroy()
    },
  })

  const fallbackName = fallbackNameFrom(parsed.object)
  const headers = new Headers({
    'Content-Type': contentType,
    'Content-Disposition': `inline; filename="${sanitizeFilename(doc.filename ?? fallbackName)}"`,
    'Cache-Control': 'private, max-age=300',
  })
  if (contentLength) headers.set('Content-Length', contentLength)

  return new Response(webStream, { headers })
}

function fallbackNameFrom(objectPath: string): string {
  return objectPath.split('/').pop() ?? 'file'
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
