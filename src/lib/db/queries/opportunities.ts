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

export interface OpportunityDetail {
  id: string
  title: string | null
  agency: string | null
  sub_agency: string | null
  solicitation_number: string | null
  source: string
  source_id: string | null
  posted_date: Date | null
  response_deadline: Date | null
  stage: string | null
  status: string | null
  estimated_value_min: number | null
  estimated_value_max: number | null
  place_of_performance: string | null
  naics_code: string | null
  set_aside_type: string | null
  extra: unknown
}

export async function getOpportunity(id: string): Promise<OpportunityDetail | null> {
  const pool = await getPool()
  const { rows } = await pool.query<OpportunityDetail>(
    `SELECT id, title, agency, sub_agency, solicitation_number,
            source, source_id, posted_date, response_deadline,
            stage, status, estimated_value_min, estimated_value_max,
            place_of_performance, naics_code, set_aside_type, extra
     FROM opportunities
     WHERE id = $1`,
    [id],
  )
  return rows[0] ?? null
}

export interface OpportunityDocumentRow {
  id: string
  filename: string | null
  gcs_url: string | null
  created_at: Date | null
}

export async function listOpportunityDocuments(
  opportunityId: string,
): Promise<OpportunityDocumentRow[]> {
  const pool = await getPool()
  const { rows } = await pool.query<OpportunityDocumentRow>(
    `SELECT id, filename, gcs_url, created_at
     FROM opportunity_documents
     WHERE opportunity_id = $1
       AND recalled_at IS NULL
       AND superseded_by IS NULL
     ORDER BY created_at ASC`,
    [opportunityId],
  )
  return rows
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
