import { getPool } from '../pool'
import type { OpportunityListRow } from '../types'

function opportunityFilterWhere(
  hasDocuments: boolean,
  activeOnly: boolean,
  hideServices: boolean,
  starredOnly: boolean,
): string {
  const conditions: string[] = []
  if (hasDocuments) {
    conditions.push(`EXISTS (
      SELECT 1 FROM opportunity_documents d
      WHERE d.opportunity_id = o.id
        AND d.recalled_at IS NULL
        AND d.superseded_by IS NULL
    )`)
  }
  if (activeOnly) {
    conditions.push(`o.status = 'active'`)
  }
  if (hideServices) {
    // Best-effort heuristic: exclude opps where the literal word "service"
    // appears in the title (also matches "services"). Case-insensitive.
    conditions.push(`(o.title IS NULL OR o.title NOT ILIKE '%service%')`)
  }
  if (starredOnly) {
    conditions.push(`o.is_starred = true`)
  }
  return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
}

export interface ListOpportunitiesOptions {
  limit?: number
  offset?: number
  hasDocuments?: boolean
  activeOnly?: boolean
  hideServices?: boolean
  starredOnly?: boolean
}

export async function listOpportunities(
  options: ListOpportunitiesOptions = {},
): Promise<OpportunityListRow[]> {
  const {
    limit = 100,
    offset = 0,
    hasDocuments = false,
    activeOnly = false,
    hideServices = false,
    starredOnly = false,
  } = options
  const pool = await getPool()
  const whereClause = opportunityFilterWhere(hasDocuments, activeOnly, hideServices, starredOnly)
  const { rows } = await pool.query<OpportunityListRow>(
    `
    SELECT
      o.id,
      o.title,
      o.source,
      o.agency,
      o.posted_date,
      o.response_deadline,
      o.estimated_value_max,
      o.stage,
      o.status,
      o.is_starred,
      (SELECT COUNT(*)::int FROM clin_items       WHERE opportunity_id = o.id) AS product_count,
      (SELECT COUNT(*)::int FROM sourcing_results WHERE opportunity_id = o.id) AS bid_count
    FROM opportunities o
    ${whereClause}
    ORDER BY o.posted_date DESC NULLS LAST
    LIMIT $1 OFFSET $2
    `,
    [limit, offset],
  )
  return rows
}

export async function countOpportunities(
  options: Pick<
    ListOpportunitiesOptions,
    'hasDocuments' | 'activeOnly' | 'hideServices' | 'starredOnly'
  > = {},
): Promise<number> {
  const {
    hasDocuments = false,
    activeOnly = false,
    hideServices = false,
    starredOnly = false,
  } = options
  const pool = await getPool()
  const whereClause = opportunityFilterWhere(hasDocuments, activeOnly, hideServices, starredOnly)
  const { rows } = await pool.query<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM opportunities o ${whereClause}`,
  )
  return rows[0]?.count ?? 0
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
  is_product: boolean | null
  commentary: string | null
  extra: unknown
}

export async function getOpportunity(id: string): Promise<OpportunityDetail | null> {
  const pool = await getPool()
  const { rows } = await pool.query<OpportunityDetail>(
    `SELECT id, title, agency, sub_agency, solicitation_number,
            source, source_id, posted_date, response_deadline,
            stage, status, estimated_value_min, estimated_value_max,
            place_of_performance, naics_code, set_aside_type,
            is_product, commentary, extra
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

export interface OpportunityParsedView {
  opportunity: Record<string, unknown>
  clin_items: Record<string, unknown>[]
}

/**
 * Build a JSON view of everything the parser produced for one opportunity:
 * the parsed_* / restriction_flags / human-label fields off the opportunity
 * row, plus all clin_items as an array. Mirrors what the LLM extracted
 * (the raw LLM response is never persisted — see backend parser.py).
 */
export async function getOpportunityParsedJson(
  id: string,
): Promise<OpportunityParsedView | null> {
  const pool = await getPool()
  const oppRes = await pool.query<Record<string, unknown>>(
    `SELECT
       id, title, source, source_id,
       parsed_product_name, parsed_product_category,
       parsed_quantity, parsed_unit, parsed_brand, parsed_model,
       parsed_specs, parsed_delivery_location, parsed_delivery_days,
       parsed_acceptable_brands, parsed_brand_required,
       parsed_eval_method, parsed_has_service_clin, parsed_clin_count,
       parsed_nte_unit_price_cents, parsed_stated_unit_price_cents,
       restriction_flags, is_product, commentary,
       parsed_at, parsing_model_version
     FROM opportunities
     WHERE id = $1`,
    [id],
  )
  if (oppRes.rows.length === 0) return null

  const clinRes = await pool.query<Record<string, unknown>>(
    `SELECT
       id, clin_number, description, product_name, product_category,
       quantity, unit, acceptable_brands, brand_required,
       model, specs, is_service_clin, service_clin_type,
       sourcing_status, created_at
     FROM clin_items
     WHERE opportunity_id = $1
     ORDER BY clin_number ASC NULLS LAST, created_at ASC`,
    [id],
  )

  return {
    opportunity: oppRes.rows[0],
    clin_items: clinRes.rows,
  }
}

export interface OpportunityClinRow {
  id: string
  clin_number: string | null
  description: string | null
  product_name: string | null
  product_category: string | null
  quantity: number | null
  unit: string | null
  specs: string | null
  brand_required: boolean | null
  is_service_clin: boolean | null
  service_clin_type: string | null
  sourcing_status: string | null
}

export async function listClinItemsForOpportunity(
  opportunityId: string,
): Promise<OpportunityClinRow[]> {
  const pool = await getPool()
  const { rows } = await pool.query<OpportunityClinRow>(
    `SELECT
       id, clin_number, description, product_name, product_category,
       quantity, unit, specs, brand_required, is_service_clin,
       service_clin_type, sourcing_status
     FROM clin_items
     WHERE opportunity_id = $1
     ORDER BY clin_number ASC NULLS LAST, created_at ASC`,
    [opportunityId],
  )
  return rows
}

export interface HumanClinItemRow {
  id: string
  clin_number: string | null
  description: string | null
  product_name: string | null
  product_category: string | null
  quantity: number | null
  unit: string | null
  acceptable_brands: unknown
  brand_required: boolean | null
  model: string | null
  specs: string | null
  is_service_clin: boolean | null
  service_clin_type: string | null
  labeled_by: string | null
  labeled_at: Date | null
  note: string | null
  created_at: Date | null
}

export async function listHumanClinItemsForOpportunity(
  opportunityId: string,
): Promise<HumanClinItemRow[]> {
  const pool = await getPool()
  const { rows } = await pool.query<HumanClinItemRow>(
    `SELECT
       id, clin_number, description, product_name, product_category,
       quantity, unit, acceptable_brands, brand_required,
       model, specs, is_service_clin, service_clin_type,
       labeled_by, labeled_at, note, created_at
     FROM clin_items_human
     WHERE opportunity_id = $1
     ORDER BY clin_number ASC NULLS LAST, created_at ASC`,
    [opportunityId],
  )
  return rows
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
