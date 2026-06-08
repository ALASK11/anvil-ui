import { getDedupKpis, listDuplicateLinks } from '@/lib/db/queries/dedup'
import Pagination from '@/components/Pagination'

export const dynamic = 'force-dynamic'

function shortId(id: string) {
  return id.slice(0, 8)
}

function formatDate(d: Date | null) {
  if (!d) return '—'
  return new Date(d).toISOString().slice(0, 10)
}

function confidenceBadge(c: string | null) {
  const map: Record<string, string> = {
    exact: 'badge-green',
    high: 'badge-green',
    medium: 'badge-yellow',
    low: 'badge-muted',
  }
  return `badge ${(c && map[c]) || 'badge-muted'}`
}

function overrideBadge(o: string | null) {
  if (!o) return 'badge badge-muted'
  if (o === 'confirmed') return 'badge badge-green'
  if (o === 'rejected') return 'badge badge-red'
  return 'badge badge-muted'
}

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function DedupPage(props: PageProps) {
  const searchParams = await props.searchParams
  const indexStr = searchParams.index
  const pageIndex = Number(Array.isArray(indexStr) ? indexStr[0] : indexStr || '0')
  const limit = 50
  const offset = pageIndex * limit

  const [kpis, rawLinks] = await Promise.all([
    getDedupKpis(),
    listDuplicateLinks(limit + 1, offset),
  ])

  const hasNext = rawLinks.length > limit
  const links = rawLinks.slice(0, limit)

  return (
    <>
      <div className="page-header">
        <h1>Deduplication</h1>
        <p>Cross-source duplicate links between opportunities</p>
      </div>

      <div className="card-grid">
        <div className="card">
          <div className="card-label">Total Opportunities</div>
          <div className="card-value">{kpis.total_opps.toLocaleString()}</div>
        </div>
        <div className="card">
          <div className="card-label">Duplicate Links</div>
          <div className="card-value">{kpis.total_links.toLocaleString()}</div>
        </div>
        <div className="card">
          <div className="card-label">Opps in Groups</div>
          <div className="card-value">{kpis.opps_in_groups.toLocaleString()}</div>
        </div>
        <div className="card">
          <div className="card-label">Human Overrides</div>
          <div className="card-value">{kpis.human_overrides.toLocaleString()}</div>
          <div className="card-sub">Confirmed or rejected manually</div>
        </div>
      </div>

      <div className="table-container">
        <div className="table-header">Duplicate Links</div>
        <table>
          <thead>
            <tr>
              <th>Opp A</th>
              <th>Source A</th>
              <th>Title A</th>
              <th>Opp B</th>
              <th>Source B</th>
              <th>Title B</th>
              <th>Confidence</th>
              <th>Override</th>
              <th>Linked</th>
            </tr>
          </thead>
          <tbody>
            {links.map((l) => (
              <tr key={l.id}>
                <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{shortId(l.opportunity_a)}</td>
                <td>{l.source_a ?? '—'}</td>
                <td style={{ fontWeight: 500 }}>{l.title_a ?? '—'}</td>
                <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{shortId(l.opportunity_b)}</td>
                <td>{l.source_b ?? '—'}</td>
                <td style={{ fontWeight: 500 }}>{l.title_b ?? '—'}</td>
                <td><span className={confidenceBadge(l.confidence)}>{l.confidence ?? '—'}</span></td>
                <td><span className={overrideBadge(l.human_override)}>{l.human_override ?? 'none'}</span></td>
                <td style={{ color: 'var(--text-muted)' }}>{formatDate(l.created_at)}</td>
              </tr>
            ))}
            {links.length === 0 && (
              <tr>
                <td colSpan={9} style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
                  No duplicate links found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        currentIndex={pageIndex}
        hasNext={hasNext}
        totalCount={kpis.total_links}
        limit={limit}
        searchParams={searchParams}
      />
    </>
  )
}
