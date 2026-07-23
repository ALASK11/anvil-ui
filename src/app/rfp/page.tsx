import Link from 'next/link'
import {
  listOpportunities,
  getOpportunityKpis,
  countOpportunities,
  listSamAgencies,
} from '@/lib/db/queries/opportunities'
import Pagination from '@/components/Pagination'
import { RfpListTable } from '@/components/RfpListTable'
import { AgencyFilterSelect } from '@/components/AgencyFilterSelect'

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
  const hasHumanSourced = flag('human_sourced')
  const hasParseAttempt = flag('has_parse_attempt')

  const sourceRaw = searchParams.source
  const sourceValue = Array.isArray(sourceRaw) ? sourceRaw[0] : sourceRaw
  const source: string | null =
    sourceValue === 'planetbids' ||
    sourceValue === 'sam_gov' ||
    sourceValue === 'municipal_direct'
      ? sourceValue
      : null

  const agencyRaw = searchParams.agency
  const agencyValue = Array.isArray(agencyRaw) ? agencyRaw[0] : agencyRaw
  // Only meaningful when source=sam_gov (see buildOpportunityFilter). If the
  // URL has ?agency= but no ?source=sam_gov we surface it to the input so
  // the user's typed value doesn't vanish on a bad URL — the query itself
  // ignores it.
  const agencyContains: string | null = agencyValue && agencyValue.trim() ? agencyValue.trim() : null

  const filtersActive =
    hasDocuments ||
    activeOnly ||
    hideServices ||
    starredOnly ||
    recent5d ||
    hasHumanSourced ||
    hasParseAttempt ||
    source !== null ||
    (source === 'sam_gov' && agencyContains !== null)

  const [rawRows, kpis, filteredCount, samAgencies] = await Promise.all([
    listOpportunities({
      limit: limit + 1,
      offset,
      hasDocuments,
      activeOnly,
      hideServices,
      starredOnly,
      recent5d,
      hasHumanSourced,
      hasParseAttempt,
      source,
      agencyContains,
    }),
    getOpportunityKpis(),
    filtersActive
      ? countOpportunities({
          hasDocuments,
          activeOnly,
          hideServices,
          starredOnly,
          recent5d,
          hasHumanSourced,
          hasParseAttempt,
          source,
          agencyContains,
        })
      : null,
    // Only fetch the agency list when SAM is selected — no reason to pull it
    // when the dropdown won't render.
    source === 'sam_gov' ? listSamAgencies() : Promise.resolve<string[]>([]),
  ])

  const hasNext = rawRows.length > limit
  const rows = rawRows.slice(0, limit)

  interface FilterState {
    hasDocuments: boolean
    activeOnly: boolean
    hideServices: boolean
    starredOnly: boolean
    recent5d: boolean
    hasHumanSourced: boolean
    hasParseAttempt: boolean
    source: string | null
    agencyContains: string | null
  }

  const currentFilters: FilterState = {
    hasDocuments,
    activeOnly,
    hideServices,
    starredOnly,
    recent5d,
    hasHumanSourced,
    hasParseAttempt,
    source,
    agencyContains,
  }

  function filterUrl(next: FilterState): string {
    const sp = new URLSearchParams()
    if (next.hasDocuments) sp.set('has_documents', 'true')
    if (next.activeOnly) sp.set('active', 'true')
    if (next.hideServices) sp.set('has_services_in_name', 'true')
    if (next.starredOnly) sp.set('starred', 'true')
    if (next.recent5d) sp.set('recent_5d', 'true')
    if (next.hasHumanSourced) sp.set('human_sourced', 'true')
    if (next.hasParseAttempt) sp.set('has_parse_attempt', 'true')
    if (next.source) sp.set('source', next.source)
    // Only carry agency through when SAM is (still) the source.
    if (next.source === 'sam_gov' && next.agencyContains) sp.set('agency', next.agencyContains)
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
          href={filterUrl({ ...currentFilters, hasDocuments: !hasDocuments })}
          className={`filter-chip${hasDocuments ? ' active' : ''}`}
        >
          <span className="filter-chip-dot" />
          Has documents
        </Link>
        <Link
          href={filterUrl({ ...currentFilters, activeOnly: !activeOnly })}
          className={`filter-chip${activeOnly ? ' active' : ''}`}
        >
          <span className="filter-chip-dot" />
          Active only
        </Link>
        <Link
          href={filterUrl({ ...currentFilters, hideServices: !hideServices })}
          className={`filter-chip${hideServices ? ' active' : ''}`}
        >
          <span className="filter-chip-dot" />
          Hide services in title
        </Link>
        <Link
          href={filterUrl({ ...currentFilters, starredOnly: !starredOnly })}
          className={`filter-chip${starredOnly ? ' active' : ''}`}
        >
          <span className="filter-chip-dot" />
          Starred only
        </Link>
        <Link
          href={filterUrl({ ...currentFilters, recent5d: !recent5d })}
          className={`filter-chip${recent5d ? ' active' : ''}`}
        >
          <span className="filter-chip-dot" />
          Found in last 5 days
        </Link>
        <Link
          href={filterUrl({ ...currentFilters, hasHumanSourced: !hasHumanSourced })}
          className={`filter-chip${hasHumanSourced ? ' active' : ''}`}
        >
          <span className="filter-chip-dot" />
          Has human sourcing
        </Link>
        <Link
          href={filterUrl({ ...currentFilters, hasParseAttempt: !hasParseAttempt })}
          className={`filter-chip${hasParseAttempt ? ' active' : ''}`}
        >
          <span className="filter-chip-dot" />
          Has parse attempt
        </Link>
        <span
          className="filter-bar-label"
          style={{ marginLeft: '0.75rem', marginRight: 0 }}
        >
          Source
        </span>
        <Link
          href={filterUrl({
            ...currentFilters,
            source: source === 'planetbids' ? null : 'planetbids',
            // Clearing source clears agency (only relevant to SAM).
            agencyContains: source === 'planetbids' ? null : agencyContains,
          })}
          className={`filter-chip${source === 'planetbids' ? ' active' : ''}`}
        >
          <span className="filter-chip-dot" />
          PlanetBids
        </Link>
        <Link
          href={filterUrl({
            ...currentFilters,
            source: source === 'sam_gov' ? null : 'sam_gov',
            agencyContains: source === 'sam_gov' ? null : agencyContains,
          })}
          className={`filter-chip${source === 'sam_gov' ? ' active' : ''}`}
        >
          <span className="filter-chip-dot" />
          SAM.gov
        </Link>
        <Link
          href={filterUrl({
            ...currentFilters,
            source: source === 'municipal_direct' ? null : 'municipal_direct',
            // Switching away from SAM clears the agency filter (SAM-only).
            agencyContains: null,
          })}
          className={`filter-chip${source === 'municipal_direct' ? ' active' : ''}`}
        >
          <span className="filter-chip-dot" />
          Municipal
        </Link>
        {source === 'sam_gov' && (
          <AgencyFilterSelect agencies={samAgencies} currentValue={agencyContains} />
        )}
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
