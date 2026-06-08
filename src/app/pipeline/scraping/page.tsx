import {
  getScrapingKpis,
  listSourceStats,
  listRecentScrapes,
} from '@/lib/db/queries/scraping'
import Pagination from '@/components/Pagination'

export const dynamic = 'force-dynamic'

function shortId(id: string) {
  return id.slice(0, 8)
}

function formatDate(d: Date | null) {
  if (!d) return '—'
  return new Date(d).toISOString().slice(0, 10)
}

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function ScrapingPage(props: PageProps) {
  const searchParams = await props.searchParams
  const indexStr = searchParams.index
  const pageIndex = Number(Array.isArray(indexStr) ? indexStr[0] : indexStr || '0')
  const limit = 25
  const offset = pageIndex * limit

  const [kpis, sources, rawRecent] = await Promise.all([
    getScrapingKpis(),
    listSourceStats(),
    listRecentScrapes(limit + 1, offset),
  ])

  const hasNext = rawRecent.length > limit
  const recent = rawRecent.slice(0, limit)

  return (
    <>
      <div className="page-header">
        <h1>Scraping</h1>
        <p>Raw RFP document ingestion from configured sources</p>
      </div>

      <div className="card-grid">
        <div className="card">
          <div className="card-label">Active Sources</div>
          <div className="card-value">{kpis.active_sources}</div>
          <div className="card-sub">Distinct opportunities.source values</div>
        </div>
        <div className="card">
          <div className="card-label">Opps (24h)</div>
          <div className="card-value">{kpis.opps_24h.toLocaleString()}</div>
        </div>
        <div className="card">
          <div className="card-label">Total Opportunities</div>
          <div className="card-value">{kpis.opps_total.toLocaleString()}</div>
        </div>
      </div>

      <div className="table-container">
        <div className="table-header">Sources</div>
        <table>
          <thead>
            <tr>
              <th>Source</th>
              <th>Opportunities</th>
              <th>Earliest Posted</th>
              <th>Latest Posted</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((s) => (
              <tr key={s.source}>
                <td style={{ fontWeight: 500 }}>{s.source}</td>
                <td>{s.opp_count.toLocaleString()}</td>
                <td>{formatDate(s.earliest_posted)}</td>
                <td>{formatDate(s.latest_posted)}</td>
              </tr>
            ))}
            {sources.length === 0 && (
              <tr>
                <td colSpan={4} style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
                  No sources yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="table-container">
        <div className="table-header">Recently Ingested</div>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Source</th>
              <th>External ID</th>
              <th>Title</th>
              <th>Hash</th>
              <th>Ingested</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((r) => (
              <tr key={r.id}>
                <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{shortId(r.id)}</td>
                <td>{r.source}</td>
                <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{r.source_id ?? '—'}</td>
                <td style={{ fontWeight: 500 }}>{r.title ?? '—'}</td>
                <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {r.raw_content_hash ? `${r.raw_content_hash.slice(0, 8)}…` : '—'}
                </td>
                <td style={{ color: 'var(--text-muted)' }}>{formatDate(r.created_at)}</td>
              </tr>
            ))}
            {recent.length === 0 && (
              <tr>
                <td colSpan={6} style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
                  Nothing ingested yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        currentIndex={pageIndex}
        hasNext={hasNext}
        totalCount={kpis.opps_total}
        limit={limit}
        searchParams={searchParams}
      />
    </>
  )
}
