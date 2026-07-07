import { getPool } from '../pool'
import type { OpportunityListRow } from '../types'

interface FilterFlags {
  hasDocuments?: boolean
  activeOnly?: boolean
  hideServices?: boolean
  starredOnly?: boolean
  recent5d?: boolean
  parsedOnly?: boolean
  hasClin?: boolean
  withoutClin?: boolean
  hasHumanSourced?: boolean
  discoveredYesterday?: boolean
  source?: string | null            // exact match on opportunities.source
  agencyContains?: string | null    // ILIKE match on opportunities.agency (SAM only)
}

interface FilterBuild {
  where: string
  params: unknown[]
}

function buildOpportunityFilter(flags: FilterFlags): FilterBuild {
  const conditions: string[] = []
  const params: unknown[] = []

  if (flags.hasDocuments) {
    conditions.push(`EXISTS (
      SELECT 1 FROM opportunity_documents d
      WHERE d.opportunity_id = o.id
        AND d.recalled_at IS NULL
        AND d.superseded_by IS NULL
    )`)
  }
  if (flags.activeOnly) {
    conditions.push(`o.status = 'active'`)
  }
  if (flags.hideServices) {
    // Best-effort heuristic: exclude opps where the literal word "service"
    // appears in the title (also matches "services"). Case-insensitive.
    conditions.push(`(o.title IS NULL OR o.title NOT ILIKE '%service%')`)
  }
  if (flags.starredOnly) {
    conditions.push(`o.is_starred = true`)
  }
  if (flags.recent5d) {
    conditions.push(`o.created_at >= NOW() - INTERVAL '5 days'`)
  }
  if (flags.parsedOnly) {
    conditions.push(`o.parsed_at IS NOT NULL`)
  }
  if (flags.hasClin) {
    conditions.push(
      `EXISTS (SELECT 1 FROM clin_items ci WHERE ci.opportunity_id = o.id)`,
    )
  }
  if (flags.withoutClin) {
    conditions.push(
      `NOT EXISTS (SELECT 1 FROM clin_items ci WHERE ci.opportunity_id = o.id)`,
    )
  }
  if (flags.hasHumanSourced) {
    conditions.push(
      `EXISTS (SELECT 1 FROM sourcing_results_human srh WHERE srh.opportunity_id = o.id)`,
    )
  }
  if (flags.discoveredYesterday) {
    conditions.push(`o.created_at::date = (CURRENT_DATE - 1)`)
  }
  if (flags.source) {
    params.push(flags.source)
    conditions.push(`o.source = $${params.length}`)
  }
  // Agency filter only applies to SAM opps (per product decision). Scope so a
  // stray ?agency=... in the URL without ?source=sam_gov becomes a no-op
  // rather than silently searching across all sources.
  if (flags.agencyContains && flags.source === 'sam_gov') {
    params.push(`%${flags.agencyContains}%`)
    conditions.push(`o.agency ILIKE $${params.length}`)
  }

  return {
    where: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
  }
}

export interface ListOpportunitiesOptions extends FilterFlags {
  limit?: number
  offset?: number
}

export async function listOpportunities(
  options: ListOpportunitiesOptions = {},
): Promise<OpportunityListRow[]> {
  const { limit = 100, offset = 0, ...flags } = options
  const pool = await getPool()
  const { where, params } = buildOpportunityFilter(flags)
  const limitIdx = params.length + 1
  const offsetIdx = params.length + 2
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
    ${where}
    ORDER BY o.posted_date DESC NULLS LAST, o.id ASC
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `,
    [...params, limit, offset],
  )
  return rows
}

export async function countOpportunities(options: FilterFlags = {}): Promise<number> {
  const pool = await getPool()
  const { where, params } = buildOpportunityFilter(options)
  const { rows } = await pool.query<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM opportunities o ${where}`,
    params,
  )
  return rows[0]?.count ?? 0
}

/**
 * Distinct SAM agency names for the agency dropdown on /rfp. Cached at the
 * DB level via a partial index (`ix_opp_source` if it exists) or just a fast
 * scan on a modest table. Returns sorted asc, nulls dropped.
 */
export async function listSamAgencies(): Promise<string[]> {
  const pool = await getPool()
  const { rows } = await pool.query<{ agency: string }>(
    `SELECT DISTINCT agency
     FROM opportunities
     WHERE source = 'sam_gov' AND agency IS NOT NULL
     ORDER BY agency ASC`,
  )
  return rows.map((r) => r.agency)
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
  is_starred: boolean | null
  extra: unknown
}

export async function getOpportunity(id: string): Promise<OpportunityDetail | null> {
  const pool = await getPool()
  const { rows } = await pool.query<OpportunityDetail>(
    `SELECT id, title, agency, sub_agency, solicitation_number,
            source, source_id, posted_date, response_deadline,
            stage, status, estimated_value_min, estimated_value_max,
            place_of_performance, naics_code, set_aside_type,
            is_product, commentary, is_starred, extra
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
