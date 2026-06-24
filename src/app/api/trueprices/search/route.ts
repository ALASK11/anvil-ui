import { NextResponse } from 'next/server'

/**
 * GET /api/trueprices/search?query=...&country=us&page=1&limit=40&locationCode=...
 *
 * Proxies a search request to the Trueprices price-comparison API
 * (compare.api.chaching.me) so the API key never reaches the browser.
 *
 * Required env var:
 *   TRUEPRICES_API_KEY — the demo-key header value (prod key).
 *
 * The route returns the upstream response body verbatim on 2xx, or a
 * { ok: false, message } envelope on failure.
 */

const BASE_URL = 'https://compare.api.chaching.me'

export async function GET(req: Request): Promise<NextResponse> {
  const apiKey = process.env.TRUEPRICES_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, message: 'TRUEPRICES_API_KEY not configured' },
      { status: 500 },
    )
  }

  const url = new URL(req.url)
  const query = url.searchParams.get('query')?.trim()
  if (!query) {
    return NextResponse.json({ ok: false, message: 'query required' }, { status: 400 })
  }

  const country = url.searchParams.get('country') ?? 'us'
  const page = url.searchParams.get('page') ?? '1'
  const limit = url.searchParams.get('limit') ?? '20'
  const locationCode = url.searchParams.get('locationCode') ?? ''

  const upstream = new URL(`${BASE_URL}/v4/shopping/search`)
  upstream.searchParams.set('query', query)
  upstream.searchParams.set('country', country)
  upstream.searchParams.set('page', page)
  upstream.searchParams.set('limit', limit)
  if (locationCode) upstream.searchParams.set('locationCode', locationCode)

  try {
    const res = await fetch(upstream.toString(), {
      method: 'GET',
      headers: { 'demo-key': apiKey },
      cache: 'no-store',
    })
    const text = await res.text()
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, message: `Upstream ${res.status}`, upstream_body: tryParseJson(text) ?? text },
        { status: 502 },
      )
    }
    const body = tryParseJson(text)
    return NextResponse.json(body ?? { raw: text })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Upstream call failed'
    return NextResponse.json({ ok: false, message }, { status: 502 })
  }
}

function tryParseJson(text: string): unknown | null {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}
