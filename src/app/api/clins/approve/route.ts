import { NextResponse } from 'next/server'
import { getPool } from '@/lib/db/pool'

/**
 * POST /api/clins/approve
 *
 * Writes human-approved CLINs (selected from a Gemini parse) into the
 * `clin_items_human` shadow table. Pipeline code never reads or writes
 * this table — it exists purely for human review traffic.
 *
 * Body:
 *   {
 *     opportunity_id: string (uuid),
 *     clins: ParsedClin[],     // verbatim slices of the Gemini result
 *     note?: string | null     // optional shared note attached to every row
 *   }
 *
 * Per-row columns we populate:
 *   - all CLIN fields from the payload (cast from JSONB)
 *   - labeled_by = the IAP-authenticated user email (null off-IAP, e.g. local dev)
 *   - note       = shared note from the form (same value across all rows)
 *   - machine_snapshot = the verbatim ParsedClin JSONB (audit trail of what
 *                        the LLM produced, even if we later add inline edit)
 *
 * Required SQL grant:
 *   GRANT INSERT ON clin_items_human TO "169801273048-compute@developer";
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface ApprovedClin {
  clin_number?: string | null
  description?: string | null
  product_name?: string | null
  product_category?: string | null
  quantity?: number | null
  unit?: string | null
  acceptable_brands?: unknown
  brand_required?: boolean | null
  model?: string | null
  specs?: string | null
  is_service_clin?: boolean | null
  service_clin_type?: string | null
}

interface Body {
  opportunity_id: string
  clins: ApprovedClin[]
  note?: string | null
}

function extractIapUserEmail(req: Request): string | null {
  const raw = req.headers.get('x-goog-authenticated-user-email')
  if (!raw) return null
  // IAP format: "accounts.google.com:user@example.com" — strip provider prefix.
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
  if (!Array.isArray(body.clins) || body.clins.length === 0) {
    return NextResponse.json(
      { ok: false, message: 'clins array required (at least one)' },
      { status: 400 },
    )
  }
  for (const c of body.clins) {
    if (c === null || typeof c !== 'object') {
      return NextResponse.json(
        { ok: false, message: 'each clin must be an object' },
        { status: 400 },
      )
    }
  }

  const labeledBy = extractIapUserEmail(req)
  const note =
    typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null

  const pool = await getPool()

  try {
    const result = await pool.query<{ id: string }>(
      `INSERT INTO clin_items_human (
         opportunity_id,
         clin_number, description, product_name, product_category,
         quantity, unit, acceptable_brands, brand_required,
         model, specs, is_service_clin, service_clin_type,
         labeled_by, note, machine_snapshot
       )
       SELECT
         $1::uuid,
         c->>'clin_number',
         c->>'description',
         c->>'product_name',
         c->>'product_category',
         (c->>'quantity')::int,
         c->>'unit',
         c->'acceptable_brands',
         (c->>'brand_required')::boolean,
         c->>'model',
         c->>'specs',
         (c->>'is_service_clin')::boolean,
         c->>'service_clin_type',
         $2,
         $3,
         c
       FROM jsonb_array_elements($4::jsonb) AS c
       RETURNING id`,
      [body.opportunity_id, labeledBy, note, JSON.stringify(body.clins)],
    )

    return NextResponse.json({
      ok: true,
      message: `Wrote ${result.rows.length} CLIN(s) to clin_items_human.`,
      inserted_ids: result.rows.map((r) => r.id),
      labeled_by: labeledBy,
      note,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'INSERT failed'
    return NextResponse.json({ ok: false, message }, { status: 500 })
  }
}
