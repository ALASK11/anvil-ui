import { NextResponse } from 'next/server'
import { searchTrueprices, TruepricesError } from '@/lib/trueprices'

/**
 * GET /api/trueprices/search?query=...&country=us&limit=40&locationCode=...
 *
 * Runs the two-step Trueprices flow server-side (search -> poll offers) and
 * returns candidate rows already enriched with a real product URL. Response:
 *
 *   { candidates: TruepricesCandidate[] }
 *
 * The upstream API key never reaches the browser. See `src/lib/trueprices.ts`
 * for throttling / SkimLinks unwrap / SSRF guard details.
 */

export const dynamic = 'force-dynamic'
// Offer polling can take up to ~30s under worst-case backoff.
export const maxDuration = 60

export async function GET(req: Request): Promise<NextResponse> {
  const url = new URL(req.url)
  const query = url.searchParams.get('query')?.trim()
  if (!query) {
    return NextResponse.json({ ok: false, message: 'query required' }, { status: 400 })
  }

  const country = url.searchParams.get('country') ?? 'us'
  const limitParam = Number(url.searchParams.get('limit') ?? '40')
  const limit = Number.isFinite(limitParam) ? limitParam : 40
  const topParam = Number(url.searchParams.get('top') ?? '5')
  const topProducts = Number.isFinite(topParam) ? topParam : 5
  const locationCode = url.searchParams.get('locationCode') ?? undefined
  const newOnly = url.searchParams.get('new_only') === 'true'

  try {
    const { candidates } = await searchTrueprices(query, {
      country,
      limit,
      topProducts,
      locationCode,
      newOnly,
    })
    return NextResponse.json({ candidates })
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
