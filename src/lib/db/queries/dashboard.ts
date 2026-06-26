import { getPool } from '../pool'

export interface DiscoveryDayRow {
  discovered_date: string // YYYY-MM-DD
  discovered: number
  with_downloaded_docs: number
  without_downloaded_docs: number
}

/**
 * Per-day breakdown of new planetbids opportunities discovered in the last
 * 7 days, split by whether at least one document for that opp has finished
 * downloading (download_status = 'success').
 */
export async function getPlanetbidsDiscoveryLast7Days(): Promise<DiscoveryDayRow[]> {
  const pool = await getPool()
  const { rows } = await pool.query<{
    discovered_date: Date | string
    discovered: number
    with_downloaded_docs: number
    without_downloaded_docs: number
  }>(`
    SELECT created_at::date                            AS discovered_date,
           count(*)::int                               AS discovered,
           count(*) FILTER (WHERE has_docs)::int       AS with_downloaded_docs,
           count(*) FILTER (WHERE NOT has_docs)::int   AS without_downloaded_docs
    FROM (
      SELECT o.id, o.created_at,
             EXISTS (
               SELECT 1 FROM opportunity_documents od
               WHERE od.opportunity_id = o.id
                 AND od.download_status = 'success'
             ) AS has_docs
      FROM opportunities o
      WHERE o.source = 'planetbids'
        AND o.created_at >= now() - interval '7 days'
    ) t
    GROUP BY discovered_date
    ORDER BY discovered_date
  `)
  return rows.map((r) => ({
    discovered_date:
      r.discovered_date instanceof Date
        ? r.discovered_date.toISOString().slice(0, 10)
        : String(r.discovered_date).slice(0, 10),
    discovered: r.discovered,
    with_downloaded_docs: r.with_downloaded_docs,
    without_downloaded_docs: r.without_downloaded_docs,
  }))
}
