// First-pass view of the `fpds_market` table — added to give the FPDS
// market-intelligence aggregates a surface in the UI. Layout assumes the
// natural unit of view is a (fiscal_year, agency, NAICS) row; refine if
// the stakeholder model is different (e.g. agency-rolled-up, NAICS trend
// charts, etc.).

import { getMarketKpis, listFpdsMarket } from '@/lib/db/queries/market'
import Pagination from '@/components/Pagination'

export const dynamic = 'force-dynamic'

function formatDollars(d: number | null) {
  if (d == null) return '—'
  if (d >= 1_000_000_000) return `$${(d / 1_000_000_000).toFixed(2)}B`
  if (d >= 1_000_000) return `$${(d / 1_000_000).toFixed(1)}M`
  if (d >= 1_000) return `$${(d / 1_000).toFixed(0)}K`
  return `$${d.toFixed(0)}`
}

function yoyColor(y: number | null) {
  if (y == null) return 'var(--text-muted)'
  if (y > 0.05) return 'var(--green)'
  if (y < -0.05) return 'var(--red)'
  return 'var(--text-muted)'
}

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function MarketPage(props: PageProps) {
  const searchParams = await props.searchParams
  const indexStr = searchParams.index
  const pageIndex = Number(Array.isArray(indexStr) ? indexStr[0] : indexStr || '0')
  const limit = 100
  const offset = pageIndex * limit

  const [kpis, rawRows] = await Promise.all([
    getMarketKpis(),
    listFpdsMarket(limit + 1, offset),
  ])

  const hasNext = rawRows.length > limit
  const rows = rawRows.slice(0, limit)

  return (
    <>
      <div className="page-header">
        <h1>Market Intelligence</h1>
        <p>FPDS aggregates by fiscal year, agency, and NAICS</p>
        <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.85rem', marginTop: '0.5rem' }}>
          First-pass view of the <code>fpds_market</code> table. Each row is one (fiscal_year, agency, NAICS)
          tuple. Layout is initial — tell us what cuts (agency-rollup, NAICS trend, top-awardee drilldown) would
          be useful and we&apos;ll refine.
        </p>
      </div>

      <div className="card-grid">
        <div className="card">
          <div className="card-label">Aggregate Rows</div>
          <div className="card-value">{kpis.total_rows.toLocaleString()}</div>
        </div>
        <div className="card">
          <div className="card-label">Unique Agencies</div>
          <div className="card-value">{kpis.unique_agencies.toLocaleString()}</div>
        </div>
        <div className="card">
          <div className="card-label">Unique NAICS</div>
          <div className="card-value">{kpis.unique_naics.toLocaleString()}</div>
        </div>
        <div className="card">
          <div className="card-label">Fiscal Years</div>
          <div className="card-value">{kpis.fiscal_years_covered.toLocaleString()}</div>
        </div>
        <div className="card">
          <div className="card-label">Total Obligations</div>
          <div className="card-value">{formatDollars(kpis.total_obligations_dollars)}</div>
          <div className="card-sub">Sum across all rows</div>
        </div>
      </div>

      <div className="table-container">
        <div className="table-header">FPDS Aggregates</div>
        <table>
          <thead>
            <tr>
              <th>FY</th>
              <th>Agency</th>
              <th>NAICS</th>
              <th>Description</th>
              <th>Obligations</th>
              <th>Actions</th>
              <th>Avg Contract</th>
              <th>Awardees</th>
              <th>Avg Offers</th>
              <th>SB %</th>
              <th>Dominant Type</th>
              <th>YoY</th>
              <th>Top N</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.fiscal_year}</td>
                <td>
                  <div style={{ fontWeight: 500 }}>{r.agency_name ?? '—'}</div>
                  <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {r.agency_code ?? ''}
                  </div>
                </td>
                <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{r.naics_code ?? '—'}</td>
                <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: 280 }}>
                  {r.naics_description ?? '—'}
                </td>
                <td style={{ fontWeight: 500 }}>{formatDollars(r.total_obligations_dollars)}</td>
                <td>{r.action_count?.toLocaleString() ?? '—'}</td>
                <td>{formatDollars(r.avg_contract_value_dollars)}</td>
                <td>{r.unique_awardees?.toLocaleString() ?? '—'}</td>
                <td>{r.avg_offers_received == null ? '—' : r.avg_offers_received.toFixed(1)}</td>
                <td>{r.pct_small_business == null ? '—' : `${(r.pct_small_business * 100).toFixed(0)}%`}</td>
                <td style={{ fontSize: '0.85rem' }}>{r.dominant_contract_type ?? '—'}</td>
                <td style={{ color: yoyColor(r.yoy_change), fontWeight: 500 }}>
                  {r.yoy_change == null ? '—' : `${(r.yoy_change * 100).toFixed(1)}%`}
                </td>
                <td>{r.top_awardees_count ?? '—'}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={13} style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
                  No market data yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        currentIndex={pageIndex}
        hasNext={hasNext}
        totalCount={kpis.total_rows}
        limit={limit}
        searchParams={searchParams}
      />
    </>
  )
}
