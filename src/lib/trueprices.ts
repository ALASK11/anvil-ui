/**
 * Trueprices price-comparison API client (server-side only).
 *
 * A candidate URL is NEVER on the search response. Getting a real product
 * URL is a two-call sequence:
 *   1. GET /v4/shopping/search        -> list of product_ids
 *   2. GET /v4/shopping/product/offers -> async polling, each offer has `link`
 *
 * All requests are throttled to a 500ms floor and share one FIFO queue so a
 * fan-out over multiple polls still respects the upstream rate limit.
 *
 * Post-processing:
 *  - unwrapUrl(): strips SkimLinks affiliate redirects
 *  - isSafeHost(): rejects private/loopback/link-local hosts (SSRF guard)
 *
 * Env: TRUEPRICES_API_KEY (required). TRUEPRICES_BASE_URL optional override.
 */

import { type TruepricesCandidate } from './trueprices-parse'

export type { TruepricesCandidate } from './trueprices-parse'

const BASE_URL = process.env.TRUEPRICES_BASE_URL ?? 'https://compare.api.chaching.me'
const USER_AGENT = 'Anvil/1.0'
const REQ_TIMEOUT_MS = 15_000
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024
const THROTTLE_MS = 500
const OFFERS_POLL_INTERVAL_MS = 2000
const OFFERS_MAX_POLLS = 5
const DEFAULT_TOP_PRODUCTS = 5
const MAX_PRODUCT_ID_LEN = 2000

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

// One FIFO queue for the whole process. Every apiFetch chains after the
// previous request finishes AND waits out any remaining time in the 500ms
// window. This is what makes it safe to fan pollOffers() out in parallel.
let throttleTail: Promise<void> = Promise.resolve()
let lastCallEndedAt = 0

async function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const waitFor = throttleTail
  let release!: () => void
  throttleTail = new Promise<void>((res) => {
    release = res
  })
  try {
    await waitFor
    const gap = Date.now() - lastCallEndedAt
    if (gap < THROTTLE_MS) {
      await new Promise((r) => setTimeout(r, THROTTLE_MS - gap))
    }
    return await fn()
  } finally {
    lastCallEndedAt = Date.now()
    release()
  }
}

async function apiFetch(path: string, params: URLSearchParams): Promise<unknown> {
  const apiKey = process.env.TRUEPRICES_API_KEY
  if (!apiKey) throw new TruepricesError(500, null, 'TRUEPRICES_API_KEY not configured')

  return throttled(async () => {
    const url = `${BASE_URL}${path}?${params.toString()}`
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), REQ_TIMEOUT_MS)
    let res: Response
    try {
      res = await fetch(url, {
        method: 'GET',
        headers: { 'demo-key': apiKey, 'User-Agent': USER_AGENT },
        cache: 'no-store',
        signal: ac.signal,
      })
    } catch (e) {
      throw new TruepricesError(
        504,
        null,
        `Trueprices request failed: ${e instanceof Error ? e.message : 'unknown'}`,
      )
    } finally {
      clearTimeout(timer)
    }
    const text = await res.text()
    if (text.length > MAX_RESPONSE_BYTES) {
      throw new TruepricesError(
        502,
        null,
        `Trueprices response exceeded ${MAX_RESPONSE_BYTES} bytes`,
      )
    }
    const raw = tryParseJson(text)
    if (!res.ok) {
      throw new TruepricesError(res.status, raw ?? text, `Trueprices ${res.status}`)
    }
    return raw
  })
}

interface SearchProduct {
  product_id: string
  title: string | null
  price: number | null
}

interface Offer {
  link: string
  price: number
  total_price: number | null
  merchant_name: string
}

function normalizeProducts(raw: unknown): SearchProduct[] {
  if (!raw || typeof raw !== 'object') return []
  const arr = (raw as { results?: unknown }).results
  if (!Array.isArray(arr)) return []
  const out: SearchProduct[] = []
  for (const p of arr) {
    if (!p || typeof p !== 'object') continue
    const rec = p as Record<string, unknown>
    const id = typeof rec.product_id === 'string' ? rec.product_id.trim() : ''
    if (!id || id.length > MAX_PRODUCT_ID_LEN) continue
    out.push({
      product_id: id,
      title: typeof rec.title === 'string' ? rec.title : null,
      price:
        typeof rec.price === 'number' && Number.isFinite(rec.price) ? rec.price : null,
    })
  }
  return out
}

function normalizeOffers(raw: unknown): { completed: boolean; offers: Offer[] } {
  if (!raw || typeof raw !== 'object') return { completed: false, offers: [] }
  const r = raw as { completed?: unknown; offers?: { data?: unknown } }
  const completed = r.completed === true
  const data = r.offers?.data
  if (!Array.isArray(data)) return { completed, offers: [] }
  const out: Offer[] = []
  for (const o of data) {
    if (!o || typeof o !== 'object') continue
    const rec = o as Record<string, unknown>
    const link = typeof rec.link === 'string' ? rec.link : ''
    const price =
      typeof rec.price === 'number' && Number.isFinite(rec.price) ? rec.price : null
    const merchantRaw =
      rec.merchant && typeof rec.merchant === 'object'
        ? (rec.merchant as Record<string, unknown>)
        : {}
    const mName =
      typeof merchantRaw.name === 'string' && merchantRaw.name.trim().length > 0
        ? merchantRaw.name.trim()
        : null
    if (!link || !/^https?:\/\//i.test(link) || price == null || !mName) continue
    out.push({
      link,
      price,
      total_price:
        typeof rec.total_price === 'number' && Number.isFinite(rec.total_price)
          ? rec.total_price
          : null,
      merchant_name: mName,
    })
  }
  return { completed, offers: out }
}

async function pollOffers(
  productId: string,
  opts: { country?: string; locationCode?: string; newOnly?: boolean } = {},
): Promise<Offer[]> {
  const params = new URLSearchParams({
    product_id: productId,
    country: opts.country ?? 'us',
    page: '1',
  })
  if (opts.locationCode) params.set('locationCode', opts.locationCode)
  if (opts.newOnly) params.set('filters', 'new_only')

  let last: { completed: boolean; offers: Offer[] } = { completed: false, offers: [] }
  let firstError: unknown = null
  for (let attempt = 1; attempt <= OFFERS_MAX_POLLS; attempt++) {
    if (attempt > 1) {
      await new Promise((r) => setTimeout(r, OFFERS_POLL_INTERVAL_MS))
    }
    try {
      const raw = await apiFetch('/v4/shopping/product/offers', params)
      last = normalizeOffers(raw)
      firstError = null
    } catch (e) {
      firstError ??= e
      continue
    }
    if (last.completed) return last.offers
    if (attempt >= 2 && last.offers.length > 0) return last.offers
  }
  if (last.offers.length === 0 && firstError) throw firstError
  return last.offers
}

const SKIMLINKS_HOSTS = new Set([
  'go.skimresources.com',
  'redirect.skimresources.com',
])

export function unwrapUrl(raw: string): string {
  try {
    const u = new URL(raw)
    if (SKIMLINKS_HOSTS.has(u.hostname.toLowerCase())) {
      const inner = u.searchParams.get('url')
      if (inner && /^https?:\/\//i.test(inner) && isSafeHost(inner)) {
        return inner
      }
    }
    return raw
  } catch {
    return raw
  }
}

// SSRF guard. Blocks loopback, link-local, and RFC1918 ranges before we
// persist an unwrapped URL. IPv4 numeric hosts only — hostnames like
// "localhost" and rare IPv6 loopback are handled by the string prefix set.
export function isSafeHost(url: string): boolean {
  try {
    const u = new URL(url)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
    const host = u.hostname.toLowerCase()
    if (!host) return false
    if (host === 'localhost' || host === '0.0.0.0' || host === '::1') return false
    if (host.startsWith('127.')) return false
    if (host.startsWith('10.')) return false
    if (host.startsWith('192.168.')) return false
    if (host.startsWith('169.254.')) return false
    // IPv6 unique-local (fc00::/7) and link-local (fe80::/10).
    if (host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80:')) {
      return false
    }
    if (host.startsWith('172.')) {
      const second = Number(host.split('.')[1])
      if (Number.isInteger(second) && second >= 16 && second <= 31) return false
    }
    return true
  } catch {
    return false
  }
}

export async function searchTrueprices(
  query: string,
  opts: {
    country?: string
    page?: number
    limit?: number
    locationCode?: string
    topProducts?: number
    newOnly?: boolean
  } = {},
): Promise<TruepricesSearchResult> {
  const searchParams = new URLSearchParams({
    query,
    country: opts.country ?? 'us',
    page: String(opts.page ?? 1),
    limit: String(Math.min(40, Math.max(1, opts.limit ?? 40))),
  })
  if (opts.locationCode) searchParams.set('locationCode', opts.locationCode)

  const rawSearch = await apiFetch('/v4/shopping/search', searchParams)
  const products = normalizeProducts(rawSearch).slice(
    0,
    Math.max(1, opts.topProducts ?? DEFAULT_TOP_PRODUCTS),
  )
  if (products.length === 0) return { raw: rawSearch, candidates: [] }

  const offersPerProduct = await Promise.all(
    products.map((p) =>
      pollOffers(p.product_id, {
        country: opts.country,
        locationCode: opts.locationCode,
        newOnly: opts.newOnly,
      }).catch(() => [] as Offer[]),
    ),
  )

  const candidates: TruepricesCandidate[] = []
  const seen = new Set<string>()
  products.forEach((p, i) => {
    for (const o of offersPerProduct[i]) {
      const link = unwrapUrl(o.link)
      if (!isSafeHost(link)) continue
      const key = `${o.merchant_name.toLowerCase()}::${p.product_id}`
      if (seen.has(key)) continue
      seen.add(key)
      candidates.push({
        title: p.title,
        price_cents: Math.round(o.price * 100),
        landed_cents: o.total_price != null ? Math.round(o.total_price * 100) : null,
        seller: o.merchant_name,
        product_url: link,
        sku: p.product_id,
      })
    }
  })

  return { raw: rawSearch, candidates }
}

function tryParseJson(text: string): unknown | null {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}
