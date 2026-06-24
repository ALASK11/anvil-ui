import { NextResponse } from 'next/server'
import { getPool } from '@/lib/db/pool'

/**
 * PATCH /api/opportunity/:id/labels
 *
 * Updates the human-input label columns on opportunities:
 *   - is_product: boolean | null  — tri-state (Yes / No / Unlabeled)
 *   - commentary: string | null   — free-text notes
 *
 * These columns are documented in backend/app/models/opportunity.py as
 * "human labels, never written by the parser or any automated pipeline".
 * Direct UI writes are appropriate here; no backend round-trip needed.
 *
 * The Cloud SQL IAM user the Next.js service runs as must have:
 *   GRANT UPDATE (is_product, commentary, updated_at) ON opportunities
 *     TO "169801273048-compute@developer";
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const COMMENTARY_MAX = 10_000

interface Body {
  is_product?: boolean | null
  commentary?: string | null
}

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PATCH(req: Request, ctx: RouteContext): Promise<NextResponse> {
  const { id } = await ctx.params
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ ok: false, message: 'Invalid opportunity id' }, { status: 400 })
  }

  let body: Body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const hasIsProduct = 'is_product' in body
  const hasCommentary = 'commentary' in body
  if (!hasIsProduct && !hasCommentary) {
    return NextResponse.json({ ok: false, message: 'No fields to update' }, { status: 400 })
  }
  if (hasIsProduct && body.is_product !== null && typeof body.is_product !== 'boolean') {
    return NextResponse.json(
      { ok: false, message: 'is_product must be boolean or null' },
      { status: 400 },
    )
  }
  if (hasCommentary) {
    if (body.commentary !== null && typeof body.commentary !== 'string') {
      return NextResponse.json(
        { ok: false, message: 'commentary must be string or null' },
        { status: 400 },
      )
    }
    if (typeof body.commentary === 'string' && body.commentary.length > COMMENTARY_MAX) {
      return NextResponse.json(
        { ok: false, message: `commentary exceeds ${COMMENTARY_MAX} chars` },
        { status: 400 },
      )
    }
  }

  const setClauses: string[] = []
  const values: unknown[] = []
  let i = 1
  if (hasIsProduct) {
    setClauses.push(`is_product = $${i++}`)
    values.push(body.is_product)
  }
  if (hasCommentary) {
    setClauses.push(`commentary = $${i++}`)
    values.push(body.commentary === '' ? null : body.commentary)
  }
  setClauses.push('updated_at = NOW()')
  values.push(id)

  const pool = await getPool()
  const { rowCount } = await pool.query(
    `UPDATE opportunities SET ${setClauses.join(', ')} WHERE id = $${i}`,
    values,
  )

  if (rowCount === 0) {
    return NextResponse.json({ ok: false, message: 'Opportunity not found' }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
