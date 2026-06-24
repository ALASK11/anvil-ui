import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { Storage } from '@google-cloud/storage'
import { PDFDocument } from 'pdf-lib'
import { getPool } from '@/lib/db/pool'
import { parseGcsUrl } from '@/lib/gcs'

/**
 * POST /api/parse-pdfs
 *
 * Slices the requested page ranges out of each opportunity_documents PDF,
 * sends them to Gemini with the user-supplied preamble, and returns the
 * model's JSON output (or the raw text + error if parsing fails).
 *
 * Required env vars:
 *   GEMINI_API_KEY — Google AI Studio key with Gemini access.
 * Optional env vars:
 *   GEMINI_MODEL   — default "gemini-2.5-flash". Override e.g. with
 *                    "gemini-2.5-pro" for higher-quality extraction.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DEFAULT_MODEL = 'gemini-2.5-flash'

interface Body {
  opportunity_id: string
  documents: Array<{ document_id: string; page_ranges: string }>
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

  const expanded: Array<{
    document_id: string
    page_ranges_raw: string
    page_ranges_expanded: number[]
  }> = []
  for (const d of body.documents) {
    if (!d.document_id || !UUID_RE.test(d.document_id)) {
      return NextResponse.json(
        { ok: false, message: `invalid document_id: ${d.document_id}` },
        { status: 400 },
      )
    }
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
    expanded.push({
      document_id: d.document_id,
      page_ranges_raw: d.page_ranges.trim(),
      page_ranges_expanded: pages,
    })
  }

  // Look up doc metadata to confirm they belong to this opp.
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
    [body.opportunity_id, expanded.map((e) => e.document_id)],
  )
  const docMap = new Map(docRows.map((r) => [r.id, r]))

  const docInputs = expanded.map((e) => {
    const meta = docMap.get(e.document_id)
    return {
      document_id: e.document_id,
      filename: meta?.filename ?? null,
      gcs_url: meta?.gcs_url ?? null,
      page_ranges_raw: e.page_ranges_raw,
      page_ranges_expanded: e.page_ranges_expanded,
    }
  })

  const missing = docInputs.filter((d) => d.gcs_url == null).map((d) => d.document_id)
  if (missing.length > 0) {
    return NextResponse.json(
      { ok: false, message: `documents not found for this opportunity: ${missing.join(', ')}` },
      { status: 400 },
    )
  }

  // Fetch + slice PDFs in parallel.
  let slices: SlicedPdf[]
  try {
    slices = await Promise.all(
      docInputs.map((d) => fetchAndSlicePdf(d.gcs_url!, d.page_ranges_expanded)),
    )
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : 'PDF slicing failed' },
      { status: 502 },
    )
  }

  const totalPagesKept = slices.reduce((sum, s) => sum + s.kept_pages.length, 0)
  const modelName = process.env.GEMINI_MODEL ?? DEFAULT_MODEL

  // Build the Gemini request: preamble first (instructions + schema), then
  // every sliced PDF as an inlineData part.
  const model = getGemini(apiKey).getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1,
    },
  })

  let responseText: string
  try {
    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            { text: body.preamble },
            ...slices.map((s) => ({
              inlineData: { mimeType: 'application/pdf', data: s.base64 },
            })),
          ],
        },
      ],
    })
    responseText = result.response.text()
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Gemini call failed'
    return NextResponse.json({ ok: false, message }, { status: 502 })
  }

  const { parsed, raw } = extractJson(responseText)

  return NextResponse.json({
    ok: true,
    message: `Parsed ${docInputs.length} document(s), ${totalPagesKept} page(s) with ${modelName}.`,
    model: modelName,
    result: parsed,
    raw_response: parsed == null ? raw : undefined,
    request_summary: {
      opportunity_id: body.opportunity_id,
      preamble_chars: body.preamble.length,
      documents: docInputs.map((d, i) => ({
        ...d,
        gcs_url: undefined,
        kept_pages: slices[i].kept_pages,
        skipped_pages: slices[i].skipped_pages,
        total_in_source: slices[i].total_in_source,
      })),
      total_pages_sent: totalPagesKept,
    },
  })
}
