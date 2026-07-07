import { getPool } from '../pool'

export interface SourcingKpis {
  total_results: number
  selected_results: number
  total_clins_sourced: number
  avg_results_per_clin: number
}

export async function getSourcingKpis(): Promise<SourcingKpis> {
  const pool = await getPool()
  const { rows } = await pool.query<SourcingKpis>(
    `
    SELECT
      (SELECT COUNT(*)::int FROM sourcing_results)                                                              AS total_results,
      (SELECT COUNT(*)::int FROM sourcing_results WHERE is_selected)                                            AS selected_results,
      (SELECT COUNT(DISTINCT clin_item_id)::int FROM sourcing_results WHERE clin_item_id IS NOT NULL)           AS total_clins_sourced,
      COALESCE(
        (SELECT COUNT(*)::float / NULLIF(COUNT(DISTINCT clin_item_id), 0)
         FROM sourcing_results
         WHERE clin_item_id IS NOT NULL),
        0
      )::float AS avg_results_per_clin
    `,
  )
  return rows[0]
}

export interface SourcingResultRow {
  id: string
  opportunity_id: string
  clin_item_id: string | null
  opp_title: string | null
  response_deadline: Date | null
  supplier_name: string | null
  retailer_name: string | null
  product_name: string | null
  product_url: string | null
  sku: string | null
  unit_price_cents: number | null
  total_landed_cost_cents: number | null
  bid_price_recommended_cents: number | null
  margin_pct: number | null
  lead_time_days: number | null
  confidence: string | null
  is_selected: boolean | null
  taa_compliant: boolean | null
  buy_american_compliant: boolean | null
  sourced_at: Date | null
}

const SOURCING_RESULTS_SELECT = `
  SELECT
    sr.id,
    sr.opportunity_id,
    sr.clin_item_id,
    o.title AS opp_title,
    o.response_deadline,
    s.name  AS supplier_name,
    sr.retailer_name,
    sr.product_name,
    sr.product_url,
    sr.sku,
    sr.unit_price_cents,
    sr.total_landed_cost_cents,
    sr.bid_price_recommended_cents,
    sr.margin_pct,
    sr.lead_time_days,
    sr.confidence,
    sr.is_selected,
    sr.taa_compliant,
    sr.buy_american_compliant,
    sr.sourced_at
  FROM sourcing_results sr
  LEFT JOIN opportunities o ON o.id = sr.opportunity_id
  LEFT JOIN suppliers     s ON s.id = sr.supplier_id
`

export interface ListSourcingResultsOptions {
  limit?: number
  offset?: number
  opportunityId?: string
}

export async function listSourcingResults(
  options: ListSourcingResultsOptions = {},
): Promise<SourcingResultRow[]> {
  const { limit = 50, offset = 0, opportunityId } = options
  const pool = await getPool()

  if (opportunityId) {
    // Per-opp views render grouped by CLIN, so we want every candidate;
    // pagination doesn't make sense here.
    const { rows } = await pool.query<SourcingResultRow>(
      `${SOURCING_RESULTS_SELECT}
       WHERE sr.opportunity_id = $1
       ORDER BY sr.sourced_at DESC NULLS LAST, sr.id ASC`,
      [opportunityId],
    )
    return rows
  }

  const { rows } = await pool.query<SourcingResultRow>(
    `${SOURCING_RESULTS_SELECT}
     ORDER BY sr.sourced_at DESC NULLS LAST, sr.id ASC
     LIMIT $1 OFFSET $2`,
    [limit, offset],
  )
  return rows
}

export interface GroupedSourcingRow {
  opportunity_id: string
  opp_title: string | null
  response_deadline: Date | null
  sourced_count: number
}

export interface ListGroupedSourcingResultsOptions {
  limit?: number
  offset?: number
  hasDocuments?: boolean
  activeOnly?: boolean
}

function groupedSourcingWhere(hasDocuments: boolean, activeOnly: boolean): string {
  const conditions: string[] = []
  if (hasDocuments) {
    conditions.push(`EXISTS (
      SELECT 1 FROM opportunity_documents d
      WHERE d.opportunity_id = sr.opportunity_id
        AND d.recalled_at IS NULL
        AND d.superseded_by IS NULL
    )`)
  }
  if (activeOnly) {
    conditions.push(`o.status = 'active'`)
  }
  return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
}

export interface HumanSourcingResultRow {
  id: string
  opportunity_id: string
  human_clin_item_id: string | null
  supplier_name: string | null
  retailer_name: string | null
  product_name: string | null
  product_url: string | null
  sku: string | null
  unit_price_cents: number | null
  total_landed_cost_cents: number | null
  bid_price_recommended_cents: number | null
  margin_pct: number | null
  lead_time_days: number | null
  confidence: string | null
  is_selected: boolean | null
  sourced_by: string | null
  sourced_at: Date | null
  created_at: Date | null
}

export async function listHumanSourcingResultsForOpportunity(
  opportunityId: string,
): Promise<HumanSourcingResultRow[]> {
  const pool = await getPool()
  const { rows } = await pool.query<HumanSourcingResultRow>(
    `SELECT
       sr.id,
       sr.opportunity_id,
       sr.human_clin_item_id,
       COALESCE(s.name, sr.supplier_name_freetext) AS supplier_name,
       sr.retailer_name,
       sr.product_name,
       sr.product_url,
       sr.sku,
       sr.unit_price_cents,
       sr.total_landed_cost_cents,
       sr.bid_price_recommended_cents,
       sr.margin_pct,
       sr.lead_time_days,
       sr.confidence,
       sr.is_selected,
       sr.sourced_by,
       sr.sourced_at,
       sr.created_at
     FROM sourcing_results_human sr
     LEFT JOIN suppliers s ON s.id = sr.supplier_id
     WHERE sr.opportunity_id = $1
     ORDER BY sr.sourced_at DESC NULLS LAST, sr.created_at DESC, sr.id ASC`,
    [opportunityId],
  )
  return rows
}

export async function countGroupedSourcingOpps(
  options: Pick<ListGroupedSourcingResultsOptions, 'hasDocuments' | 'activeOnly'> = {},
): Promise<number> {
  const { hasDocuments = false, activeOnly = false } = options
  const pool = await getPool()
  const whereClause = groupedSourcingWhere(hasDocuments, activeOnly)
  const { rows } = await pool.query<{ count: number }>(
    `
    SELECT COUNT(DISTINCT sr.opportunity_id)::int AS count
    FROM sourcing_results sr
    LEFT JOIN opportunities o ON o.id = sr.opportunity_id
    ${whereClause}
    `,
  )
  return rows[0]?.count ?? 0
}

export async function listGroupedSourcingResults(
  options: ListGroupedSourcingResultsOptions = {},
): Promise<GroupedSourcingRow[]> {
  const { limit = 50, offset = 0, hasDocuments = false, activeOnly = false } = options
  const pool = await getPool()
  const whereClause = groupedSourcingWhere(hasDocuments, activeOnly)

  const { rows } = await pool.query<GroupedSourcingRow>(
    `
    SELECT
      sr.opportunity_id,
      o.title             AS opp_title,
      o.response_deadline,
      COUNT(sr.id)::int   AS sourced_count
    FROM sourcing_results sr
    LEFT JOIN opportunities o ON o.id = sr.opportunity_id
    ${whereClause}
    GROUP BY sr.opportunity_id, o.title, o.response_deadline
    ORDER BY sourced_count DESC, sr.opportunity_id ASC
    LIMIT $1 OFFSET $2
    `,
    [limit, offset],
  )
  return rows
}


