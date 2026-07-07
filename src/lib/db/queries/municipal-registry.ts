import { getPool } from '../pool'

export interface MunicipalRegistryKpis {
  total: number
  enabled: number
  with_proc_url: number
  with_errors: number
  states: number
}

export async function getMunicipalRegistryKpis(): Promise<MunicipalRegistryKpis> {
  const pool = await getPool()
  const { rows } = await pool.query<MunicipalRegistryKpis>(
    `
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE enabled)::int AS enabled,
      COUNT(*) FILTER (
        WHERE COALESCE(data->>'discovered_procurement_url', data->>'procurement_url') IS NOT NULL
          AND COALESCE(data->>'discovered_procurement_url', data->>'procurement_url') <> ''
      )::int AS with_proc_url,
      COUNT(*) FILTER (
        WHERE COALESCE((data->>'consecutive_errors')::int, 0) > 0
      )::int AS with_errors,
      COUNT(DISTINCT state)::int AS states
    FROM municipal_sites
    `,
  )
  return rows[0]
}

export interface MunicipalSiteFilters {
  state?: string
  enabled?: boolean
}

export interface MunicipalSiteRow {
  slug: string
  state: string
  enabled: boolean
  population: number | null
  check_interval_hours: number
  last_checked: Date | null
  last_attempted: Date | null
  name: string | null
  cms_platform: string | null
  procurement_url: string | null
  consecutive_errors: number
}

export async function listMunicipalSites(
  limit = 50,
  offset = 0,
  filters: MunicipalSiteFilters = {},
): Promise<MunicipalSiteRow[]> {
  const pool = await getPool()
  const state = filters.state?.trim().toUpperCase() || null
  const enabled = filters.enabled ?? null

  const { rows } = await pool.query<MunicipalSiteRow>(
    `
    SELECT
      slug,
      state,
      enabled,
      population,
      check_interval_hours,
      last_checked,
      last_attempted,
      data->>'name' AS name,
      data->>'cms_platform' AS cms_platform,
      COALESCE(data->>'discovered_procurement_url', data->>'procurement_url') AS procurement_url,
      COALESCE((data->>'consecutive_errors')::int, 0) AS consecutive_errors
    FROM municipal_sites
    WHERE ($1::text IS NULL OR state = $1)
      AND ($2::boolean IS NULL OR enabled = $2)
    ORDER BY population DESC NULLS LAST, slug ASC
    LIMIT $3 OFFSET $4
    `,
    [state, enabled, limit, offset],
  )
  return rows
}

export async function countMunicipalSites(
  filters: MunicipalSiteFilters = {},
): Promise<number> {
  const pool = await getPool()
  const state = filters.state?.trim().toUpperCase() || null
  const enabled = filters.enabled ?? null

  const { rows } = await pool.query<{ count: number }>(
    `
    SELECT COUNT(*)::int AS count
    FROM municipal_sites
    WHERE ($1::text IS NULL OR state = $1)
      AND ($2::boolean IS NULL OR enabled = $2)
    `,
    [state, enabled],
  )
  return rows[0].count
}

export async function listMunicipalStates(): Promise<string[]> {
  const pool = await getPool()
  const { rows } = await pool.query<{ state: string }>(
    `SELECT DISTINCT state FROM municipal_sites ORDER BY state`,
  )
  return rows.map((r) => r.state)
}
