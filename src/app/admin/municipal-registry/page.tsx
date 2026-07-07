import Link from 'next/link'
import Pagination from '@/components/Pagination'
import {
  countMunicipalSites,
  getMunicipalRegistryKpis,
  listMunicipalSites,
  listMunicipalStates,
} from '@/lib/db/queries/municipal-registry'

export const dynamic = 'force-dynamic'

function formatDate(d: Date | null) {
  if (!d) return '—'
  return new Date(d).toISOString().slice(0, 10)
}

function parseEnabled(value: string | string[] | undefined): boolean | undefined {
  const raw = Array.isArray(value) ? value[0] : value
  if (raw === 'true') return true
  if (raw === 'false') return false
  return undefined
}

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function MunicipalRegistryPage(props: PageProps) {
  const searchParams = await props.searchParams
  const indexStr = searchParams.index
  const pageIndex = Number(Array.isArray(indexStr) ? indexStr[0] : indexStr || '0')
  const stateParam = Array.isArray(searchParams.state) ? searchParams.state[0] : searchParams.state
  const enabledFilter = parseEnabled(searchParams.enabled)
  const filters = {
    state: stateParam?.trim() || undefined,
    enabled: enabledFilter,
  }
  const filtersActive = Boolean(filters.state || enabledFilter !== undefined)

  const limit = 50
  const offset = pageIndex * limit

  const [kpis, states, filteredCount, rawSites] = await Promise.all([
    getMunicipalRegistryKpis(),
    listMunicipalStates(),
    countMunicipalSites(filters),
    listMunicipalSites(limit + 1, offset, filters),
  ])

  const hasNext = rawSites.length > limit
  const sites = rawSites.slice(0, limit)

  const clearHref = '/admin/municipal-registry'

  return (
    <>
      <div className="page-header">
        <h1>Municipal Registry</h1>
        <p>Scrape-target registry for the <code>municipal_direct</code> discovery source</p>
        <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.85rem', marginTop: '0.5rem' }}>
          View-only — site URLs, CMS platform, check schedule, and circuit-breaker state.
        </p>
      </div>

      <div className="card-grid">
        <div className="card">
          <div className="card-label">Total Sites</div>
          <div className="card-value">{kpis.total.toLocaleString()}</div>
        </div>
        <div className="card">
          <div className="card-label">Enabled</div>
          <div className="card-value">{kpis.enabled.toLocaleString()}</div>
        </div>
        <div className="card">
          <div className="card-label">With Proc URL</div>
          <div className="card-value">{kpis.with_proc_url.toLocaleString()}</div>
        </div>
        <div className="card">
          <div className="card-label">States</div>
          <div className="card-value">{kpis.states.toLocaleString()}</div>
        </div>
        <div className="card">
          <div className="card-label">With Errors</div>
          <div className="card-value">{kpis.with_errors.toLocaleString()}</div>
          <div className="card-sub">consecutive_errors &gt; 0</div>
        </div>
      </div>

      <form method="get" className="filter-bar">
        <span className="filter-bar-label">Filters</span>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem' }}>
          State
          <select
            name="state"
            defaultValue={filters.state ?? ''}
            style={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              color: 'var(--text)',
              padding: '0.25rem 0.5rem',
              fontSize: '0.85rem',
            }}
          >
            <option value="">All</option>
            {states.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem' }}>
          Enabled
          <select
            name="enabled"
            defaultValue={
              enabledFilter === true ? 'true' : enabledFilter === false ? 'false' : ''
            }
            style={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              color: 'var(--text)',
              padding: '0.25rem 0.5rem',
              fontSize: '0.85rem',
            }}
          >
            <option value="">All</option>
            <option value="true">Enabled</option>
            <option value="false">Disabled</option>
          </select>
        </label>
        <button
          type="submit"
          className="pagination-btn"
          style={{ marginLeft: '0.25rem' }}
        >
          Apply
        </button>
        {filtersActive && (
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {filteredCount.toLocaleString()} site{filteredCount === 1 ? '' : 's'} match
          </span>
        )}
        {filtersActive && (
          <Link href={clearHref} className="filter-bar-clear">
            clear filters
          </Link>
        )}
      </form>

      <div className="table-container">
        <div className="table-header">Municipal Sites</div>
        <table>
          <thead>
            <tr>
              <th>State</th>
              <th>Slug</th>
              <th>Name</th>
              <th>Population</th>
              <th>CMS</th>
              <th>Proc URL</th>
              <th>Enabled</th>
              <th>Errors</th>
              <th>Last Checked</th>
              <th>Last Attempted</th>
            </tr>
          </thead>
          <tbody>
            {sites.map((site) => (
              <tr key={site.slug}>
                <td>{site.state}</td>
                <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{site.slug}</td>
                <td style={{ fontWeight: 500 }}>{site.name ?? '—'}</td>
                <td>
                  {site.population == null ? '—' : site.population.toLocaleString()}
                </td>
                <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {site.cms_platform ?? '—'}
                </td>
                <td>
                  {site.procurement_url ? (
                    <a
                      href={site.procurement_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="badge badge-blue"
                      style={{ textDecoration: 'none' }}
                    >
                      open
                    </a>
                  ) : (
                    <span className="badge badge-muted">no</span>
                  )}
                </td>
                <td>
                  {site.enabled
                    ? <span className="badge badge-green">yes</span>
                    : <span className="badge badge-muted">no</span>}
                </td>
                <td>
                  {site.consecutive_errors > 0 ? (
                    <span className="badge badge-red">{site.consecutive_errors}</span>
                  ) : (
                    '0'
                  )}
                </td>
                <td style={{ color: 'var(--text-muted)' }}>{formatDate(site.last_checked)}</td>
                <td style={{ color: 'var(--text-muted)' }}>{formatDate(site.last_attempted)}</td>
              </tr>
            ))}
            {sites.length === 0 && (
              <tr>
                <td colSpan={10} style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
                  No municipal sites match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        currentIndex={pageIndex}
        hasNext={hasNext}
        totalCount={filteredCount}
        limit={limit}
        searchParams={searchParams}
      />
    </>
  )
}
