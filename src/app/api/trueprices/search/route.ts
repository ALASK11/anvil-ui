import { NextResponse } from 'next/server'
import { searchTrueprices, TruepricesError } from '@/lib/trueprices'

/**
 * GET /api/trueprices/search?query=...&country=us&page=1&limit=20&locationCode=...
 *
 * Proxies a search request to the Trueprices price-comparison API so the
 * API key never reaches the browser. Returns the upstream JSON body
 * verbatim on success.
 *
 * Required env var: TRUEPRICES_API_KEY
 */

export async function GET(req: Request): Promise<NextResponse> {
  const url = new URL(req.url)
  const query = url.searchParams.get('query')?.trim()
  if (!query) {
    return NextResponse.json({ ok: false, message: 'query required' }, { status: 400 })
  }

  const country = url.searchParams.get('country') ?? 'us'
  const page = Number(url.searchParams.get('page') ?? '1')
  const limit = Number(url.searchParams.get('limit') ?? '20')
  const locationCode = url.searchParams.get('locationCode') ?? undefined

  try {
    const { raw } = await searchTrueprices(query, { country, page, limit, locationCode })
    return NextResponse.json(raw ?? {})
  } catch (e) {
    if (e instanceof TruepricesError) {
      return NextResponse.json(
        { ok: false, message: e.message, upstream_body: e.upstreamBody },
        { status: e.status === 500 ? 500 : 502 },
      )
    }
    const message = e instanceof Error ? e.message : 'Upstream call failed'
    return NextResponse.json({ ok: false, message }, { status: 502 })
  }
}
