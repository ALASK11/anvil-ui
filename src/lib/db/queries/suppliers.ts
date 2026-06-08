import { getPool } from '../pool'

export interface SuppliersKpis {
  total: number
  active: number
  avg_reliability: number | null
  total_sourced_sum: number
}

export async function getSuppliersKpis(): Promise<SuppliersKpis> {
  const pool = await getPool()
  const { rows } = await pool.query<SuppliersKpis>(
    `
    SELECT
      COUNT(*)::int                                                     AS total,
      COUNT(*) FILTER (WHERE is_active)::int                            AS active,
      AVG(reliability_score) FILTER (WHERE reliability_score IS NOT NULL)::float
                                                                        AS avg_reliability,
      COALESCE(SUM(total_sourced), 0)::int                              AS total_sourced_sum
    FROM suppliers
    `,
  )
  return rows[0]
}

export interface SupplierRow {
  id: string
  name: string
  adapter_key: string
  category_focus: unknown
  handles_shipping: boolean | null
  avg_margin_pct: number | null
  avg_lead_days: number | null
  reliability_score: number | null
  total_sourced: number | null
  total_fulfilled: number | null
  is_active: boolean | null
  notes: string | null
  created_at: Date | null
  updated_at: Date | null
}

export async function listSuppliers(limit = 50, offset = 0): Promise<SupplierRow[]> {
  const pool = await getPool()
  const { rows } = await pool.query<SupplierRow>(
    `
    SELECT
      id,
      name,
      adapter_key,
      category_focus,
      handles_shipping,
      avg_margin_pct,
      avg_lead_days,
      reliability_score,
      total_sourced,
      total_fulfilled,
      is_active,
      notes,
      created_at,
      updated_at
    FROM suppliers
    ORDER BY is_active DESC NULLS LAST, name ASC
    LIMIT $1 OFFSET $2
    `,
    [limit, offset],
  )
  return rows
}
