import { getPool } from '../pool'
import type { OpportunityListRow } from '../types'

export async function listOpportunities(limit = 100, offset = 0): Promise<OpportunityListRow[]> {
  const pool = await getPool()
  const { rows } = await pool.query<OpportunityListRow>(
    `
    SELECT
      o.id,
      o.title,
      o.agency,
      o.posted_date,
      o.response_deadline,
      o.estimated_value_max,
      o.stage,
      o.status,
      (SELECT COUNT(*)::int FROM clin_items       WHERE opportunity_id = o.id) AS product_count,
      (SELECT COUNT(*)::int FROM sourcing_results WHERE opportunity_id = o.id) AS bid_count
    FROM opportunities o
    ORDER BY o.posted_date DESC NULLS LAST
    LIMIT $1 OFFSET $2
    `,
    [limit, offset],
  )
  return rows
}

export interface OpportunityKpis {
  total: number
  active: number
  awarded: number
  cancelled: number
}

export async function getOpportunityKpis(): Promise<OpportunityKpis> {
  const pool = await getPool()
  const { rows } = await pool.query<OpportunityKpis>(
    `
    SELECT
      COUNT(*)::int                                       AS total,
      COUNT(*) FILTER (WHERE status = 'active')::int      AS active,
      COUNT(*) FILTER (WHERE status = 'awarded')::int     AS awarded,
      COUNT(*) FILTER (WHERE status = 'cancelled')::int   AS cancelled
    FROM opportunities
    `,
  )
  return rows[0]
}
