/**
 * Trueprices price-comparison API client.
 *
 * Hits compare.api.chaching.me with the demo-key header. Returns the raw
 * response plus a best-effort flattened list of candidates so callers don't
 * have to know the upstream shape.
 *
 * Required env var: TRUEPRICES_API_KEY
 */

const BASE_URL = 'https://compare.api.chaching.me'

export interface TruepricesCandidate {
  title: string | null
  price_cents: number | null
  seller: string | null
  link: string | null
  sku: string | null
}

export interface TruepricesSearchResult {
  raw: unknown
  candidates: TruepricesCandidate[]
}

export class TruepricesError extends Error {
  status: number
  upstreamBody: unknown
  constructor(status: number, upstreamBody: unknown, message: string) {
    super(message)
    this.status = status
    this.upstreamBody = upstreamBody
    this.name = 'TruepricesError'
  }
}

export async function searchTrueprices(
  query: string,
  opts: { country?: string; page?: number; limit?: number; locationCode?: string } = {},
): Promise<TruepricesSearchResult> {
  const apiKey = process.env.TRUEPRICES_API_KEY
  if (!apiKey) throw new TruepricesError(500, null, 'TRUEPRICES_API_KEY not configured')

  const url = new URL(`${BASE_URL}/v4/shopping/search`)
  url.searchParams.set('query', query)
  url.searchParams.set('country', opts.country ?? 'us')
  url.searchParams.set('page', String(opts.page ?? 1))
  url.searchParams.set('limit', String(opts.limit ?? 20))
  if (opts.locationCode) url.searchParams.set('locationCode', opts.locationCode)

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: { 'demo-key': apiKey },
    cache: 'no-store',
  })

  const text = await res.text()
  const raw = tryParseJson(text)
  if (!res.ok) {
    throw new TruepricesError(res.status, raw ?? text, `Trueprices ${res.status}`)
  }

  return { raw, candidates: extractCandidates(raw) }
}

function tryParseJson(text: string): unknown | null {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

/**
 * Best-effort extraction. Trueprices' response key has shifted between
 * versions; try common ones in order. If nothing matches we just return [].
 * Callers that need the literal shape should use `raw` instead.
 */
function extractCandidates(response: unknown): TruepricesCandidate[] {
  if (!response || typeof response !== 'object') return []
  const r = response as Record<string, unknown>
  const list =
    (r.products as unknown) ??
    (r.results as unknown) ??
    (r.hits as unknown) ??
    (r.data as unknown) ??
    (r.items as unknown)
  if (!Array.isArray(list)) return []

  const out: TruepricesCandidate[] = []
  for (const item of list) {
    if (!item || typeof item !== 'object') continue
    const i = item as Record<string, unknown>
    const merchant = (i.merchant ?? i.seller ?? i.retailer) as
      | Record<string, unknown>
      | string
      | undefined

    const title = pickString(i, ['title', 'name', 'productName'])
    const price = pickNumber(i, ['price', 'priceUsd', 'minPrice'])
    const seller =
      pickString(typeof merchant === 'object' ? merchant : undefined, ['name', 'sellerName']) ??
      (typeof merchant === 'string' ? merchant : null)
    const link = pickString(i, ['link', 'url', 'productUrl'])
    const sku = pickString(i, ['sku', 'id', 'productId'])

    if (price == null) continue
    out.push({
      title,
      price_cents: Math.round(price * 100),
      seller,
      link,
      sku,
    })
  }
  return out
}

function pickString(obj: Record<string, unknown> | undefined, keys: string[]): string | null {
  if (!obj) return null
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === 'string' && v.length > 0) return v
  }
  return null
}

function pickNumber(obj: Record<string, unknown> | undefined, keys: string[]): number | null {
  if (!obj) return null
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === 'number' && Number.isFinite(v)) return v
  }
  return null
}
