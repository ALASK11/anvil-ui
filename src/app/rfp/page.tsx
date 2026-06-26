import Link from 'next/link'
import {
  listOpportunities,
  getOpportunityKpis,
  countOpportunities,
} from '@/lib/db/queries/opportunities'
import Pagination from '@/components/Pagination'
import { RfpListTable } from '@/components/RfpListTable'

export const dynamic = 'force-dynamic'

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
  const recent5d = flag('recent_5d')
  const filtersActive = hasDocuments || activeOnly || hideServices || starredOnly || recent5d

  const [rawRows, kpis, filteredCount] = await Promise.all([
    listOpportunities({
      limit: limit + 1,
      offset,
      hasDocuments,
      activeOnly,
      hideServices,
      starredOnly,
      recent5d,
    }),
    getOpportunityKpis(),
    filtersActive
      ? countOpportunities({ hasDocuments, activeOnly, hideServices, starredOnly, recent5d })
      : null,
  ])

  const hasNext = rawRows.length > limit
  const rows = rawRows.slice(0, limit)

  function filterUrl(next: {
    hasDocuments: boolean
    activeOnly: boolean
    hideServices: boolean
    starredOnly: boolean
    recent5d: boolean
  }): string {
    const sp = new URLSearchParams()
    if (next.hasDocuments) sp.set('has_documents', 'true')
    if (next.activeOnly) sp.set('active', 'true')
    if (next.hideServices) sp.set('has_services_in_name', 'true')
    if (next.starredOnly) sp.set('starred', 'true')
    if (next.recent5d) sp.set('recent_5d', 'true')
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
          href={filterUrl({ hasDocuments: !hasDocuments, activeOnly, hideServices, starredOnly, recent5d })}
          className={`filter-chip${hasDocuments ? ' active' : ''}`}
        >
          <span className="filter-chip-dot" />
          Has documents
        </Link>
        <Link
          href={filterUrl({ hasDocuments, activeOnly: !activeOnly, hideServices, starredOnly, recent5d })}
          className={`filter-chip${activeOnly ? ' active' : ''}`}
        >
          <span className="filter-chip-dot" />
          Active only
        </Link>
        <Link
          href={filterUrl({ hasDocuments, activeOnly, hideServices: !hideServices, starredOnly, recent5d })}
          className={`filter-chip${hideServices ? ' active' : ''}`}
        >
          <span className="filter-chip-dot" />
          Hide services in title
        </Link>
        <Link
          href={filterUrl({ hasDocuments, activeOnly, hideServices, starredOnly: !starredOnly, recent5d })}
          className={`filter-chip${starredOnly ? ' active' : ''}`}
        >
          <span className="filter-chip-dot" />
          Starred only
        </Link>
        <Link
          href={filterUrl({ hasDocuments, activeOnly, hideServices, starredOnly, recent5d: !recent5d })}
          className={`filter-chip${recent5d ? ' active' : ''}`}
        >
          <span className="filter-chip-dot" />
          Found in last 5 days
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

      <RfpListTable rows={rows} />

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
