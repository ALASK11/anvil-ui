import { getPool } from '../pool'

export interface MarketKpis {
  total_rows: number
  unique_agencies: number
  unique_naics: number
  fiscal_years_covered: number
  total_obligations_dollars: number
}

export async function getMarketKpis(): Promise<MarketKpis> {
  const pool = await getPool()
  const { rows } = await pool.query<MarketKpis>(
    `
    SELECT
      COUNT(*)::int                                              AS total_rows,
      COUNT(DISTINCT agency_code)::int                           AS unique_agencies,
      COUNT(DISTINCT naics_code)::int                            AS unique_naics,
      COUNT(DISTINCT fiscal_year)::int                           AS fiscal_years_covered,
      COALESCE(SUM(total_obligations)::float / 100, 0)::float    AS total_obligations_dollars
    FROM fpds_market
    `,
  )
  return rows[0]
}

export interface FpdsMarketRow {
  id: string
  fiscal_year: number
  agency_code: string | null
  agency_name: string | null
  naics_code: string | null
  naics_description: string | null
  total_obligations_dollars: number | null
  action_count: number | null
  avg_contract_value_dollars: number | null
  unique_awardees: number | null
  avg_offers_received: number | null
  pct_small_business: number | null
  dominant_contract_type: string | null
  yoy_change: number | null
  top_awardees_count: number | null
}

export async function listFpdsMarket(limit = 100, offset = 0): Promise<FpdsMarketRow[]> {
  const pool = await getPool()
  const { rows } = await pool.query<FpdsMarketRow>(
    `
    SELECT
      id,
      fiscal_year,
      agency_code,
      agency_name,
      naics_code,
      naics_description,
      (total_obligations::float    / 100) AS total_obligations_dollars,
      action_count,
      (avg_contract_value::float   / 100) AS avg_contract_value_dollars,
      unique_awardees,
      avg_offers_received,
      pct_small_business,
      dominant_contract_type,
      yoy_change,
      CASE
        WHEN top_awardees IS NULL THEN NULL
        WHEN jsonb_typeof(top_awardees) = 'array' THEN jsonb_array_length(top_awardees)
        ELSE NULL
      END AS top_awardees_count
    FROM fpds_market
    ORDER BY fiscal_year DESC NULLS LAST, total_obligations DESC NULLS LAST
    LIMIT $1 OFFSET $2
    `,
    [limit, offset],
  )
  return rows
}
