import { NextResponse } from 'next/server'
import { getPool } from '@/lib/db/pool'
import { toRecord } from '@/lib/opportunity-links'
import {
  fetchSamDescriptionForOpportunity,
} from '@/lib/sam-fetch-description'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface RouteContext {
  params: Promise<{ id: string }>
}

interface OppRow {
  id: string
  source: string
  source_id: string | null
  extra: unknown
}

/**
 * POST /api/opportunity/:id/fetch-sam-description
 *
 * Fetches SAM.gov solicitation text for one opportunity (1–2 API calls)
 * and stores plain text in extra.description.
 *
 * Required env: SAM_GOV_API_KEY
 */
export async function POST(_req: Request, ctx: RouteContext): Promise<NextResponse> {
  const { id } = await ctx.params
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ ok: false, message: 'Invalid opportunity id' }, { status: 400 })
  }

  const apiKey = process.env.SAM_GOV_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, message: 'SAM_GOV_API_KEY is not configured on the server' },
      { status: 503 },
    )
  }

  const pool = await getPool()
  const { rows } = await pool.query<OppRow>(
    `SELECT id, source, source_id, extra FROM opportunities WHERE id = $1`,
    [id],
  )
  const opp = rows[0]
  if (!opp) {
    return NextResponse.json({ ok: false, message: 'Opportunity not found' }, { status: 404 })
  }
  if (opp.source !== 'sam_gov') {
    return NextResponse.json(
      { ok: false, message: 'Description fetch is only supported for SAM.gov opportunities' },
      { status: 400 },
    )
  }
  if (!opp.source_id) {
    return NextResponse.json(
      { ok: false, message: 'Opportunity has no SAM notice id' },
      { status: 400 },
    )
  }

  const extra = toRecord(opp.extra) ?? {}
  const existingDesc =
    typeof extra.description === 'string' ? extra.description.trim() : null

  if (existingDesc === 'not_available') {
    return NextResponse.json(
      { ok: false, message: 'SAM.gov has no description for this notice' },
      { status: 409 },
    )
  }

  // Always re-fetch from SAM (1–2 API calls). Skip only for not_available above.
  const result = await fetchSamDescriptionForOpportunity(opp.source_id, apiKey, existingDesc)

  if (!result.ok) {
    if (result.kind === 'rate_limited') {
      return NextResponse.json(
        { ok: false, message: 'SAM.gov rate limit — try again in a minute' },
        { status: 429 },
      )
    }
    if (result.kind === 'no_description') {
      return NextResponse.json(
        { ok: false, message: 'No description URL found for this notice' },
        { status: 404 },
      )
    }
    return NextResponse.json(
      { ok: false, message: result.error ?? 'Failed to fetch description' },
      { status: 502 },
    )
  }

  if (result.kind === 'not_available') {
    await pool.query(
      `UPDATE opportunities
       SET extra = jsonb_set(COALESCE(extra, '{}'::jsonb), '{description}', to_jsonb('not_available'::text)),
           parsed_at = NULL,
           parsing_model_version = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [id],
    )
    return NextResponse.json({ ok: true, not_available: true })
  }

  const { description } = result
  await pool.query(
    `UPDATE opportunities
     SET extra = jsonb_set(COALESCE(extra, '{}'::jsonb), '{description}', to_jsonb($1::text)),
         parsed_at = NULL,
         parsing_model_version = NULL,
         updated_at = NOW()
     WHERE id = $2`,
    [description, id],
  )

  return NextResponse.json({ ok: true, description })
}
