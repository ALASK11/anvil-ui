/**
 * Trueprices price-comparison API client (server-side only).
 *
 * Hits compare.api.chaching.me with the demo-key header. Returns the raw
 * response plus the shared `extractCandidates` parse so callers don't have
 * to know the upstream shape. The candidate type + parser live in
 * `trueprices-parse.ts` so the client bundle can share them without
 * pulling in this server module.
 *
 * Required env var: TRUEPRICES_API_KEY
 */

import { extractCandidates, type TruepricesCandidate } from './trueprices-parse'

export type { TruepricesCandidate } from './trueprices-parse'

const BASE_URL = 'https://compare.api.chaching.me'

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
