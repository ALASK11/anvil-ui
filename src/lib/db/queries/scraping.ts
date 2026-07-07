import { getPool } from '../pool'

export interface ScrapingKpis {
  active_sources: number
  opps_24h: number
  opps_total: number
}

export async function getScrapingKpis(): Promise<ScrapingKpis> {
  const pool = await getPool()
  const { rows } = await pool.query<ScrapingKpis>(
    `
    SELECT
      COUNT(DISTINCT source)::int                                                       AS active_sources,
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours')::int            AS opps_24h,
      COUNT(*)::int                                                                     AS opps_total
    FROM opportunities
    `,
  )
  return rows[0]
}

export interface SourceStats {
  source: string
  opp_count: number
  earliest_posted: Date | null
  latest_posted: Date | null
}

export async function listSourceStats(): Promise<SourceStats[]> {
  const pool = await getPool()
  const { rows } = await pool.query<SourceStats>(
    `
    SELECT
      source,
      COUNT(*)::int    AS opp_count,
      MIN(posted_date) AS earliest_posted,
      MAX(posted_date) AS latest_posted
    FROM opportunities
    GROUP BY source
    ORDER BY opp_count DESC, source ASC
    `,
  )
  return rows
}

export interface RecentScrape {
  id: string
  source: string
  source_id: string | null
  title: string | null
  raw_content_hash: string | null
  raw_storage_url: string | null
  created_at: Date | null
}

export async function listRecentScrapes(limit = 25, offset = 0): Promise<RecentScrape[]> {
  const pool = await getPool()
  const { rows } = await pool.query<RecentScrape>(
    `
    SELECT
      id,
      source,
      source_id,
      title,
      raw_content_hash,
      raw_storage_url,
      created_at
    FROM opportunities
    ORDER BY created_at DESC NULLS LAST, id ASC
    LIMIT $1 OFFSET $2
    `,
    [limit, offset],
  )
  return rows
}
