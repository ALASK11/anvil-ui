import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { Storage } from '@google-cloud/storage'
import mammoth from 'mammoth'
import { PDFDocument } from 'pdf-lib'
import { getPool } from '@/lib/db/pool'
import { parseGcsUrl } from '@/lib/gcs'

/**
 * POST /api/parse-pdfs
 *
 * Sends selected opportunity_documents attachments to Gemini with the
 * user-supplied preamble and returns the model's JSON output.
 *
 * PDFs: sliced to the requested page ranges via pdf-lib, sent as inlineData.
 * DOCX: converted to plain text with mammoth and sent as a text part
 *       (Gemini does not accept Word docs as inlineData).
 *
 * The route name is preserved for backwards compatibility with the existing
 * client; despite the "pdfs" in the path it accepts a mix of both formats
 * in a single request.
 *
 * Required env vars:
 *   GEMINI_API_KEY — Google AI Studio key with Gemini access.
 * Optional env vars:
 *   GEMINI_MODEL   — default "gemini-2.5-flash". Override e.g. with
 *                    "gemini-2.5-pro" for higher-quality extraction.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DEFAULT_MODEL = 'gemini-2.5-flash'
const DOCX_MAX_TEXT_CHARS = 200_000 // Guard against huge Word docs blowing the prompt.

interface Body {
  opportunity_id: string
  documents: Array<{ document_id: string; page_ranges?: string }>
  preamble: string
}

let storage: Storage | null = null
function getStorage(): Storage {
  if (!storage) storage = new Storage()
  return storage
}

let gemini: GoogleGenerativeAI | null = null
function getGemini(apiKey: string): GoogleGenerativeAI {
  if (!gemini) gemini = new GoogleGenerativeAI(apiKey)
  return gemini
}

function parsePageRanges(input: string): number[] {
  const pages = new Set<number>()
  for (const part of input.split(',')) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const rangeMatch = trimmed.match(/^(\d+)\s*-\s*(\d+)$/)
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1], 10)
      const end = parseInt(rangeMatch[2], 10)
      if (start < 1 || end < 1) throw new Error(`Page numbers must be >= 1: ${trimmed}`)
      if (start > end) throw new Error(`Invalid range (start > end): ${trimmed}`)
      for (let i = start; i <= end; i++) pages.add(i)
    } else if (/^\d+$/.test(trimmed)) {
      const n = parseInt(trimmed, 10)
      if (n < 1) throw new Error(`Page numbers must be >= 1: ${trimmed}`)
      pages.add(n)
    } else {
      throw new Error(`Invalid page spec: "${trimmed}". Use e.g. 1, 1-3, or 1-3, 5, 7-10.`)
    }
  }
  return Array.from(pages).sort((a, b) => a - b)
}

interface SlicedPdf {
  base64: string
  kept_pages: number[]
  skipped_pages: number[]
  total_in_source: number
}

async function fetchAndExtractDocx(gcsUrl: string): Promise<{ text: string; chars: number; truncated: boolean }> {
  const parsed = parseGcsUrl(gcsUrl)
  if (!parsed) throw new Error(`Invalid GCS URL: ${gcsUrl}`)
  const [buf] = await getStorage().bucket(parsed.bucket).file(parsed.object).download()
  const { value } = await mammoth.extractRawText({ buffer: buf })
  const trimmed = value.trim()
  if (trimmed.length === 0) throw new Error(`DOCX contained no extractable text: ${parsed.object}`)
  const truncated = trimmed.length > DOCX_MAX_TEXT_CHARS
  return {
    text: truncated ? trimmed.slice(0, DOCX_MAX_TEXT_CHARS) : trimmed,
    chars: trimmed.length,
    truncated,
  }
}

async function fetchAndSlicePdf(gcsUrl: string, requestedPages: number[]): Promise<SlicedPdf> {
  const parsed = parseGcsUrl(gcsUrl)
  if (!parsed) throw new Error(`Invalid GCS URL: ${gcsUrl}`)

  const [buf] = await getStorage().bucket(parsed.bucket).file(parsed.object).download()
  const src = await PDFDocument.load(new Uint8Array(buf), { ignoreEncryption: true })
  const total = src.getPageCount()

  const inRange = requestedPages.filter((p) => p >= 1 && p <= total)
  const skipped = requestedPages.filter((p) => p < 1 || p > total)
  if (inRange.length === 0) {
    throw new Error(
      `None of the requested pages exist in ${parsed.object} (has ${total} pages).`,
    )
  }

  const dst = await PDFDocument.create()
  const copied = await dst.copyPages(src, inRange.map((p) => p - 1))
  copied.forEach((p) => dst.addPage(p))
  const bytes = await dst.save()
  return {
    base64: Buffer.from(bytes).toString('base64'),
    kept_pages: inRange,
    skipped_pages: skipped,
    total_in_source: total,
  }
}

function extractJson(text: string): { parsed: unknown; raw: string } {
  const tryParse = (s: string): unknown | null => {
    try {
      return JSON.parse(s)
    } catch {
      return null
    }
  }
  const direct = tryParse(text)
  if (direct !== null) return { parsed: direct, raw: text }

  // Strip ```json ... ``` fences if Gemini added them despite the preamble.
  const stripped = text
    .replace(/^[\s\S]*?```(?:json)?\s*/i, '')
    .replace(/```[\s\S]*$/, '')
    .trim()
  const fenced = tryParse(stripped)
  return { parsed: fenced, raw: text }
}

export async function POST(req: Request): Promise<NextResponse> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, message: 'GEMINI_API_KEY not configured' },
      { status: 500 },
    )
  }

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ ok: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.opportunity_id || !UUID_RE.test(body.opportunity_id)) {
    return NextResponse.json(
      { ok: false, message: 'opportunity_id required (must be a UUID)' },
      { status: 400 },
    )
  }
  if (!Array.isArray(body.documents) || body.documents.length === 0) {
    return NextResponse.json(
      { ok: false, message: 'documents array required (at least one)' },
      { status: 400 },
    )
  }
  if (typeof body.preamble !== 'string') {
    return NextResponse.json({ ok: false, message: 'preamble required (string)' }, { status: 400 })
  }

  for (const d of body.documents) {
    if (!d.document_id || !UUID_RE.test(d.document_id)) {
      return NextResponse.json(
        { ok: false, message: `invalid document_id: ${d.document_id}` },
        { status: 400 },
      )
    }
  }

  // Look up doc metadata FIRST so we know each doc's format before validating
  // its page_ranges (DOCX docs don't have pages to slice).
  const pool = await getPool()
  const { rows: docRows } = await pool.query<{
    id: string
    filename: string | null
    gcs_url: string | null
  }>(
    `SELECT id, filename, gcs_url
     FROM opportunity_documents
     WHERE opportunity_id = $1
       AND id = ANY($2::uuid[])
       AND recalled_at IS NULL
       AND superseded_by IS NULL`,
    [body.opportunity_id, body.documents.map((d) => d.document_id)],
  )
  const docMap = new Map(docRows.map((r) => [r.id, r]))

  interface PdfInput {
    kind: 'pdf'
    document_id: string
    filename: string | null
    gcs_url: string
    page_ranges_raw: string
    page_ranges_expanded: number[]
  }
  interface DocxInput {
    kind: 'docx'
    document_id: string
    filename: string | null
    gcs_url: string
  }
  type DocInput = PdfInput | DocxInput

  const inputs: DocInput[] = []
  for (const d of body.documents) {
    const meta = docMap.get(d.document_id)
    if (!meta || !meta.gcs_url) {
      return NextResponse.json(
        { ok: false, message: `document not found for this opportunity: ${d.document_id}` },
        { status: 400 },
      )
    }
    const filenameLower = (meta.filename ?? '').toLowerCase()
    const isDocx = filenameLower.endsWith('.docx')
    if (isDocx) {
      inputs.push({
        kind: 'docx',
        document_id: d.document_id,
        filename: meta.filename,
        gcs_url: meta.gcs_url,
      })
      continue
    }
    // PDF (or unknown-type — fall through to PDF slicer for parity with the
    // pre-DOCX behavior).
    if (typeof d.page_ranges !== 'string' || !d.page_ranges.trim()) {
      return NextResponse.json(
        { ok: false, message: `page_ranges required for document ${d.document_id}` },
        { status: 400 },
      )
    }
    let pages: number[]
    try {
      pages = parsePageRanges(d.page_ranges)
    } catch (e) {
      return NextResponse.json(
        { ok: false, message: e instanceof Error ? e.message : 'invalid page range' },
        { status: 400 },
      )
    }
    if (pages.length === 0) {
      return NextResponse.json(
        { ok: false, message: `no pages parsed for document ${d.document_id}` },
        { status: 400 },
      )
    }
    inputs.push({
      kind: 'pdf',
      document_id: d.document_id,
      filename: meta.filename,
      gcs_url: meta.gcs_url,
      page_ranges_raw: d.page_ranges.trim(),
      page_ranges_expanded: pages,
    })
  }

  interface Processed {
    input: DocInput
    slice?: SlicedPdf
    docx_text?: string
    docx_chars?: number
    docx_truncated?: boolean
  }

  let processed: Processed[]
  try {
    processed = await Promise.all(
      inputs.map(async (input): Promise<Processed> => {
        if (input.kind === 'pdf') {
          const slice = await fetchAndSlicePdf(input.gcs_url, input.page_ranges_expanded)
          return { input, slice }
        }
        const extracted = await fetchAndExtractDocx(input.gcs_url)
        return {
          input,
          docx_text: extracted.text,
          docx_chars: extracted.chars,
          docx_truncated: extracted.truncated,
        }
      }),
    )
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : 'Document processing failed' },
      { status: 502 },
    )
  }

  const modelName = process.env.GEMINI_MODEL ?? DEFAULT_MODEL

  const model = getGemini(apiKey).getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1,
    },
  })

  // Build the Gemini request: preamble first (instructions + schema), then
  // one part per doc — PDFs as inlineData, DOCX text inlined as text parts
  // with a header line so the model can attribute content back to a file.
  type DocPart =
    | { inlineData: { mimeType: string; data: string } }
    | { text: string }
  const docParts: DocPart[] = []
  for (const p of processed) {
    if (p.input.kind === 'pdf' && p.slice) {
      docParts.push({ inlineData: { mimeType: 'application/pdf', data: p.slice.base64 } })
    } else if (p.input.kind === 'docx' && p.docx_text != null) {
      const label = p.input.filename ?? 'document.docx'
      const truncationNote = p.docx_truncated
        ? `\n[NOTE: content truncated to ${DOCX_MAX_TEXT_CHARS} characters]`
        : ''
      docParts.push({
        text: `\n\n--- BEGIN DOCX: ${label} ---${truncationNote}\n${p.docx_text}\n--- END DOCX: ${label} ---\n`,
      })
    }
  }

  let responseText: string
  try {
    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [{ text: body.preamble }, ...docParts],
        },
      ],
    })
    responseText = result.response.text()
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Gemini call failed'
    return NextResponse.json({ ok: false, message }, { status: 502 })
  }

  const { parsed, raw } = extractJson(responseText)

  const totalPagesKept = processed.reduce(
    (sum, p) => sum + (p.slice?.kept_pages.length ?? 0),
    0,
  )
  const totalDocxChars = processed.reduce((sum, p) => sum + (p.docx_chars ?? 0), 0)

  return NextResponse.json({
    ok: true,
    message: `Parsed ${processed.length} document(s) with ${modelName} (${totalPagesKept} PDF page(s), ${totalDocxChars} DOCX char(s)).`,
    model: modelName,
    result: parsed,
    raw_response: parsed == null ? raw : undefined,
    request_summary: {
      opportunity_id: body.opportunity_id,
      preamble_chars: body.preamble.length,
      documents: processed.map((p) => {
        const base = {
          document_id: p.input.document_id,
          filename: p.input.filename,
          kind: p.input.kind,
        }
        if (p.input.kind === 'pdf' && p.slice) {
          return {
            ...base,
            page_ranges_raw: p.input.page_ranges_raw,
            page_ranges_expanded: p.input.page_ranges_expanded,
            kept_pages: p.slice.kept_pages,
            skipped_pages: p.slice.skipped_pages,
            total_in_source: p.slice.total_in_source,
          }
        }
        return {
          ...base,
          docx_chars: p.docx_chars ?? 0,
          docx_truncated: p.docx_truncated ?? false,
        }
      }),
      total_pages_sent: totalPagesKept,
      total_docx_chars_sent: totalDocxChars,
    },
  })
}
