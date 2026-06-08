import { getPool } from '../pool'

export interface ReviewKpis {
  pending: number
  pursue_today: number
  pass_today: number
  resolved_today: number
}

export async function getReviewKpis(): Promise<ReviewKpis> {
  const pool = await getPool()
  const { rows } = await pool.query<ReviewKpis>(
    `
    SELECT
      COUNT(*) FILTER (WHERE decision IS NULL AND fit_score IS NOT NULL)::int                       AS pending,
      COUNT(*) FILTER (WHERE decision = 'pursue' AND decided_at::date = CURRENT_DATE)::int          AS pursue_today,
      COUNT(*) FILTER (WHERE decision = 'pass'   AND decided_at::date = CURRENT_DATE)::int          AS pass_today,
      COUNT(*) FILTER (WHERE resolved_at::date = CURRENT_DATE)::int                                 AS resolved_today
    FROM bid_outcomes
    `,
  )
  return rows[0]
}

export interface ReviewRow {
  id: string
  opportunity_id: string
  opp_title: string | null
  agency: string | null
  response_deadline: Date | null
  fit_score: number | null
  sourcing_margin_pct: number | null
  sourcing_cost_cents: number | null
  decision: string | null
  decision_rationale: string | null
  result: string | null
  scored_at: Date | null
  decided_at: Date | null
}

export async function listReviewQueue(limit = 50, offset = 0): Promise<ReviewRow[]> {
  const pool = await getPool()
  const { rows } = await pool.query<ReviewRow>(
    `
    SELECT
      bo.id,
      bo.opportunity_id,
      o.title             AS opp_title,
      o.agency            AS agency,
      o.response_deadline AS response_deadline,
      bo.fit_score,
      bo.sourcing_margin_pct,
      bo.sourcing_cost_cents,
      bo.decision,
      bo.decision_rationale,
      bo.result,
      bo.scored_at,
      bo.decided_at
    FROM bid_outcomes bo
    LEFT JOIN opportunities o ON o.id = bo.opportunity_id
    ORDER BY
      (bo.decision IS NULL) DESC,
      o.response_deadline ASC NULLS LAST,
      bo.scored_at DESC NULLS LAST
    LIMIT $1 OFFSET $2
    `,
    [limit, offset],
  )
  return rows
}
