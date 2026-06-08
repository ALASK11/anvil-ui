import { getPool } from '../pool'

export interface ParsingKpis {
  opps_parsed: number
  opps_unparsed: number
  total_clin_items: number
  avg_clin_per_opp: number
}

export async function getParsingKpis(): Promise<ParsingKpis> {
  const pool = await getPool()
  const { rows } = await pool.query<ParsingKpis>(
    `
    SELECT
      (SELECT COUNT(*)::int FROM opportunities WHERE parsed_at IS NOT NULL) AS opps_parsed,
      (SELECT COUNT(*)::int FROM opportunities WHERE parsed_at IS NULL)     AS opps_unparsed,
      (SELECT COUNT(*)::int FROM clin_items)                                AS total_clin_items,
      COALESCE(
        (SELECT (COUNT(*)::float / NULLIF(COUNT(DISTINCT opportunity_id), 0))
         FROM clin_items),
        0
      )::float AS avg_clin_per_opp
    `,
  )
  return rows[0]
}

export interface ClinItemRow {
  id: string
  opportunity_id: string
  opp_title: string | null
  clin_number: string | null
  product_name: string | null
  description: string | null
  quantity: number | null
  unit: string | null
  brand_required: boolean | null
  is_service_clin: boolean | null
  sourcing_status: string | null
}

export async function listClinItems(limit = 50, offset = 0): Promise<ClinItemRow[]> {
  const pool = await getPool()
  const { rows } = await pool.query<ClinItemRow>(
    `
    SELECT
      ci.id,
      ci.opportunity_id,
      o.title AS opp_title,
      ci.clin_number,
      ci.product_name,
      ci.description,
      ci.quantity,
      ci.unit,
      ci.brand_required,
      ci.is_service_clin,
      ci.sourcing_status
    FROM clin_items ci
    LEFT JOIN opportunities o ON o.id = ci.opportunity_id
    ORDER BY ci.created_at DESC NULLS LAST
    LIMIT $1 OFFSET $2
    `,
    [limit, offset],
  )
  return rows
}
