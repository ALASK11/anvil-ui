import Link from 'next/link'
import {
  listOpportunities,
  getOpportunityKpis,
  countOpportunities,
} from '@/lib/db/queries/opportunities'
import type { OpportunityListRow } from '@/lib/db/types'
import Pagination from '@/components/Pagination'
import { StarToggle } from '@/components/StarToggle'

export const dynamic = 'force-dynamic'

function stageBadge(stage: string | null) {
  const map: Record<string, string> = {
    scraping: 'badge-muted',
    dedup: 'badge-muted',
    parsing: 'badge-blue',
    sourcing: 'badge-blue',
    ranking: 'badge-yellow',
    review: 'badge-purple',
    submitted: 'badge-green',
    no_match: 'badge-red',
    final_rfp: 'badge-blue',
    draft_rfp: 'badge-muted',
  }
  return `badge ${(stage && map[stage]) || 'badge-muted'}`
}

function shortId(id: string) {
  return id.slice(0, 8)
}

function formatDate(d: Date | null) {
  if (!d) return '—'
  return new Date(d).toISOString().slice(0, 10)
}

function formatCents(cents: number | null) {
  if (cents == null) return 'TBD'
  const dollars = cents / 100
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`
  if (dollars >= 1_000) return `$${(dollars / 1_000).toFixed(0)}K`
  return `$${dollars.toFixed(0)}`
}

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function RFPPage(props: PageProps) {
  const searchParams = await props.searchParams
  const indexStr = searchParams.index
  const pageIndex = Number(Array.isArray(indexStr) ? indexStr[0] : indexStr || '0')
  const limit = 100
  const offset = pageIndex * limit

  const flag = (key: string): boolean => {
    const v = searchParams[key]
    const value = Array.isArray(v) ? v[0] : v
    return value === 'true' || value === '1'
  }
  const hasDocuments = flag('has_documents')
  const activeOnly = flag('active')
  const hideServices = flag('has_services_in_name')
  const starredOnly = flag('starred')
  const filtersActive = hasDocuments || activeOnly || hideServices || starredOnly

  const [rawRows, kpis, filteredCount] = await Promise.all([
    listOpportunities({
      limit: limit + 1,
      offset,
      hasDocuments,
      activeOnly,
      hideServices,
      starredOnly,
    }),
    getOpportunityKpis(),
    filtersActive
      ? countOpportunities({ hasDocuments, activeOnly, hideServices, starredOnly })
      : null,
  ])

  const hasNext = rawRows.length > limit
  const rows = rawRows.slice(0, limit)

  function filterUrl(next: {
    hasDocuments: boolean
    activeOnly: boolean
    hideServices: boolean
    starredOnly: boolean
  }): string {
    const sp = new URLSearchParams()
    if (next.hasDocuments) sp.set('has_documents', 'true')
    if (next.activeOnly) sp.set('active', 'true')
    if (next.hideServices) sp.set('has_services_in_name', 'true')
    if (next.starredOnly) sp.set('starred', 'true')
    const q = sp.toString()
    return q ? `/rfp?${q}` : '/rfp'
  }

  return (
    <>
      <div className="page-header">
        <h1>RFPs</h1>
        <p>All deduplicated RFPs and their current pipeline stage</p>
      </div>

      <div className="card-grid">
        <div className="card">
          <div className="card-label">Total RFPs</div>
          <div className="card-value">{kpis.total.toLocaleString()}</div>
        </div>
        <div className="card">
          <div className="card-label">Active</div>
          <div className="card-value">{kpis.active.toLocaleString()}</div>
        </div>
        <div className="card">
          <div className="card-label">Awarded</div>
          <div className="card-value">{kpis.awarded.toLocaleString()}</div>
        </div>
        <div className="card">
          <div className="card-label">Cancelled</div>
          <div className="card-value">{kpis.cancelled.toLocaleString()}</div>
        </div>
      </div>

      <div className="filter-bar">
        <span className="filter-bar-label">Filters</span>
        <Link
          href={filterUrl({ hasDocuments: !hasDocuments, activeOnly, hideServices, starredOnly })}
          className={`filter-chip${hasDocuments ? ' active' : ''}`}
        >
          <span className="filter-chip-dot" />
          Has documents
        </Link>
        <Link
          href={filterUrl({ hasDocuments, activeOnly: !activeOnly, hideServices, starredOnly })}
          className={`filter-chip${activeOnly ? ' active' : ''}`}
        >
          <span className="filter-chip-dot" />
          Active only
        </Link>
        <Link
          href={filterUrl({ hasDocuments, activeOnly, hideServices: !hideServices, starredOnly })}
          className={`filter-chip${hideServices ? ' active' : ''}`}
        >
          <span className="filter-chip-dot" />
          Hide services in title
        </Link>
        <Link
          href={filterUrl({ hasDocuments, activeOnly, hideServices, starredOnly: !starredOnly })}
          className={`filter-chip${starredOnly ? ' active' : ''}`}
        >
          <span className="filter-chip-dot" />
          Starred only
        </Link>
        {filteredCount != null && (
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {filteredCount.toLocaleString()} opp{filteredCount === 1 ? '' : 's'} match
          </span>
        )}
        {filtersActive && (
          <Link href="/rfp" className="filter-bar-clear">
            clear filters
          </Link>
        )}
      </div>

      <div className="table-container">
        <div className="table-header">RFP List</div>
        <table>
          <thead>
            <tr>
              <th style={{ width: '2.5rem', textAlign: 'center' }}>★</th>
              <th>ID</th>
              <th>Source</th>
              <th>Title</th>
              <th>Agency</th>
              <th>Posted</th>
              <th>Due</th>
              <th>CLINs</th>
              <th>Sourcing</th>
              <th>Est. Value</th>
              <th>Stage</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: OpportunityListRow) => (
              <tr key={r.id}>
                <td style={{ textAlign: 'center' }}>
                  <StarToggle opportunityId={r.id} initialStarred={r.is_starred === true} />
                </td>
                <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                  <Link href={`/rfp/${r.id}`} style={{ color: 'var(--accent)' }}>
                    {shortId(r.id)}
                  </Link>
                </td>
                <td style={{ fontWeight: 500 }}>{r.source}</td>
                <td style={{ fontWeight: 500 }}>
                  <Link href={`/rfp/${r.id}`} style={{ color: 'var(--text)' }}>
                    {r.title ?? '—'}
                  </Link>
                </td>
                <td>{r.agency ?? '—'}</td>
                <td>{formatDate(r.posted_date)}</td>
                <td>{formatDate(r.response_deadline)}</td>
                <td>{r.product_count}</td>
                <td>{r.bid_count}</td>
                <td>{formatCents(r.estimated_value_max)}</td>
                <td>
                  <span className={stageBadge(r.stage)}>
                    {r.stage ? r.stage.replace(/_/g, ' ') : '—'}
                  </span>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={10} style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
                  No opportunities found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        currentIndex={pageIndex}
        hasNext={hasNext}
        totalCount={filteredCount ?? kpis.total}
        limit={limit}
        searchParams={searchParams}
      />
    </>
  )
}
