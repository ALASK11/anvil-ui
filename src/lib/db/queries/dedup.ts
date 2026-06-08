import { getPool } from '../pool'

export interface DedupKpis {
  total_opps: number
  total_links: number
  opps_in_groups: number
  human_overrides: number
}

export async function getDedupKpis(): Promise<DedupKpis> {
  const pool = await getPool()
  const { rows } = await pool.query<DedupKpis>(
    `
    SELECT
      (SELECT COUNT(*)::int FROM opportunities)                                                AS total_opps,
      (SELECT COUNT(*)::int FROM duplicate_links)                                              AS total_links,
      (SELECT COUNT(*)::int FROM opportunities WHERE duplicate_group_id IS NOT NULL)           AS opps_in_groups,
      (SELECT COUNT(*)::int FROM duplicate_links WHERE human_override IS NOT NULL)             AS human_overrides
    `,
  )
  return rows[0]
}

export interface DuplicateLinkRow {
  id: string
  opportunity_a: string
  opportunity_b: string
  title_a: string | null
  title_b: string | null
  source_a: string | null
  source_b: string | null
  confidence: string | null
  human_override: string | null
  created_at: Date | null
}

export async function listDuplicateLinks(limit = 50, offset = 0): Promise<DuplicateLinkRow[]> {
  const pool = await getPool()
  const { rows } = await pool.query<DuplicateLinkRow>(
    `
    SELECT
      dl.id,
      dl.opportunity_a,
      dl.opportunity_b,
      a.title  AS title_a,
      b.title  AS title_b,
      a.source AS source_a,
      b.source AS source_b,
      dl.confidence,
      dl.human_override,
      dl.created_at
    FROM duplicate_links dl
    LEFT JOIN opportunities a ON a.id = dl.opportunity_a
    LEFT JOIN opportunities b ON b.id = dl.opportunity_b
    ORDER BY dl.created_at DESC NULLS LAST
    LIMIT $1 OFFSET $2
    `,
    [limit, offset],
  )
  return rows
}
