import { NextResponse } from 'next/server'
import { getPool } from '@/lib/db/pool'
import { searchTrueprices, TruepricesError } from '@/lib/trueprices'

/**
 * POST /api/clins/source-human
 *
 * For each human-reviewed CLIN attached to the opportunity, calls Trueprices
 * to find supplier candidates and inserts the results into
 * `sourcing_results_human` linked to the originating `human_clin_item_id`.
 *
 * Required env var:
 *   TRUEPRICES_API_KEY
 *
 * Required SQL grant:
 *   GRANT INSERT ON sourcing_results_human TO "169801273048-compute@developer";
 *
 * Per-CLIN errors do not abort the batch: each CLIN's result entry carries
 * its own ok / error / inserted_count so partial successes are visible.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface Body {
  opportunity_id: string
  human_clin_item_ids?: string[]
}

interface HumanClinRow {
  id: string
  clin_number: string | null
  product_name: string | null
  specs: string | null
}

interface PerClinResult {
  human_clin_item_id: string
  clin_number: string | null
  product_name: string | null
  query: string | null
  ok: boolean
  candidates_found: number
  inserted_count: number
  error: string | null
}

function extractIapUserEmail(req: Request): string | null {
  const raw = req.headers.get('x-goog-authenticated-user-email')
  if (!raw) return null
  const colonIdx = raw.indexOf(':')
  const email = colonIdx >= 0 ? raw.slice(colonIdx + 1) : raw
  return email.trim() || null
}

export async function POST(req: Request): Promise<NextResponse> {
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

  const idFilter = Array.isArray(body.human_clin_item_ids)
    ? body.human_clin_item_ids.filter((s) => UUID_RE.test(s))
    : null

  const pool = await getPool()
  const { rows: clins } = await pool.query<HumanClinRow>(
    `SELECT id, clin_number, product_name, specs
     FROM clin_items_human
     WHERE opportunity_id = $1
       ${idFilter && idFilter.length > 0 ? `AND id = ANY($2::uuid[])` : ''}
     ORDER BY clin_number ASC NULLS LAST, created_at ASC`,
    idFilter && idFilter.length > 0
      ? [body.opportunity_id, idFilter]
      : [body.opportunity_id],
  )

  if (clins.length === 0) {
    return NextResponse.json({
      ok: true,
      message: 'No human CLINs found for this opportunity (nothing to source).',
      results: [],
      total_inserted: 0,
    })
  }

  const sourcedBy = extractIapUserEmail(req)

  const results: PerClinResult[] = await Promise.all(
    clins.map(async (clin): Promise<PerClinResult> => {
      const query = (clin.product_name ?? clin.specs ?? '').trim() || null
      if (!query) {
        return {
          human_clin_item_id: clin.id,
          clin_number: clin.clin_number,
          product_name: clin.product_name,
          query: null,
          ok: false,
          candidates_found: 0,
          inserted_count: 0,
          error: 'No product_name or specs to query',
        }
      }

      try {
        const { candidates } = await searchTrueprices(query, { limit: 10 })
        if (candidates.length === 0) {
          return {
            human_clin_item_id: clin.id,
            clin_number: clin.clin_number,
            product_name: clin.product_name,
            query,
            ok: true,
            candidates_found: 0,
            inserted_count: 0,
            error: null,
          }
        }

        const payload = candidates.map((c) => ({
          retailer_name: c.seller,
          product_name: c.title,
          sku: c.sku,
          product_url: c.product_url,
          unit_price_cents: c.price_cents,
        }))

        const insertRes = await pool.query<{ id: string }>(
          `INSERT INTO sourcing_results_human (
             opportunity_id, human_clin_item_id,
             retailer_name, product_name, sku, product_url,
             unit_price_cents, supplier_name_freetext, sourced_by
           )
           SELECT
             $1::uuid, $2::uuid,
             c->>'retailer_name',
             c->>'product_name',
             c->>'sku',
             c->>'product_url',
             (c->>'unit_price_cents')::int,
             $3,
             $4
           FROM jsonb_array_elements($5::jsonb) AS c
           RETURNING id`,
          [body.opportunity_id, clin.id, 'Trueprices', sourcedBy, JSON.stringify(payload)],
        )

        return {
          human_clin_item_id: clin.id,
          clin_number: clin.clin_number,
          product_name: clin.product_name,
          query,
          ok: true,
          candidates_found: candidates.length,
          inserted_count: insertRes.rows.length,
          error: null,
        }
      } catch (e) {
        const message =
          e instanceof TruepricesError
            ? `Trueprices ${e.status}: ${e.message}`
            : e instanceof Error
              ? e.message
              : 'Sourcing call failed'
        return {
          human_clin_item_id: clin.id,
          clin_number: clin.clin_number,
          product_name: clin.product_name,
          query,
          ok: false,
          candidates_found: 0,
          inserted_count: 0,
          error: message,
        }
      }
    }),
  )

  const totalInserted = results.reduce((s, r) => s + r.inserted_count, 0)
  const failures = results.filter((r) => !r.ok).length

  return NextResponse.json({
    ok: failures < results.length,
    message: `Sourced ${results.length} CLIN(s), inserted ${totalInserted} candidate(s) into sourcing_results_human${failures > 0 ? ` (${failures} failed)` : ''}.`,
    total_inserted: totalInserted,
    sourced_by: sourcedBy,
    results,
  })
}
