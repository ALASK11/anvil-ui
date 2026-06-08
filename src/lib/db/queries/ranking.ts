import { getPool } from '../pool'

export interface RankingKpis {
  total_scored: number
  avg_fit_score: number
  avg_margin_pct: number
  awaiting_decision: number
}

export async function getRankingKpis(): Promise<RankingKpis> {
  const pool = await getPool()
  const { rows } = await pool.query<RankingKpis>(
    `
    SELECT
      COUNT(*) FILTER (WHERE fit_score IS NOT NULL)::int                                            AS total_scored,
      COALESCE(AVG(fit_score), 0)::float                                                            AS avg_fit_score,
      COALESCE(AVG(sourcing_margin_pct), 0)::float                                                  AS avg_margin_pct,
      COUNT(*) FILTER (WHERE fit_score IS NOT NULL AND decision IS NULL)::int                       AS awaiting_decision
    FROM bid_outcomes
    `,
  )
  return rows[0]
}

export interface RankingRow {
  id: string
  opportunity_id: string
  opp_title: string | null
  agency: string | null
  fit_score: number | null
  decision: string | null
  result: string | null
  sourcing_margin_pct: number | null
  sourcing_cost_cents: number | null
  sourcing_supplier: string | null
  scored_at: Date | null
  decided_at: Date | null
}

export async function listRankings(limit = 50, offset = 0): Promise<RankingRow[]> {
  const pool = await getPool()
  const { rows } = await pool.query<RankingRow>(
    `
    SELECT
      bo.id,
      bo.opportunity_id,
      o.title  AS opp_title,
      o.agency AS agency,
      bo.fit_score,
      bo.decision,
      bo.result,
      bo.sourcing_margin_pct,
      bo.sourcing_cost_cents,
      bo.sourcing_supplier,
      bo.scored_at,
      bo.decided_at
    FROM bid_outcomes bo
    LEFT JOIN opportunities o ON o.id = bo.opportunity_id
    WHERE bo.fit_score IS NOT NULL
    ORDER BY bo.fit_score DESC NULLS LAST, bo.scored_at DESC NULLS LAST
    LIMIT $1 OFFSET $2
    `,
    [limit, offset],
  )
  return rows
}
