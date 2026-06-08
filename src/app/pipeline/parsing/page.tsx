import { getParsingKpis, listClinItems } from '@/lib/db/queries/parsing'
import Pagination from '@/components/Pagination'

export const dynamic = 'force-dynamic'

function shortId(id: string) {
  return id.slice(0, 8)
}

function statusBadge(status: string | null) {
  const map: Record<string, string> = {
    pending: 'badge-yellow',
    sourced: 'badge-green',
    not_sourceable: 'badge-red',
  }
  return `badge ${(status && map[status]) || 'badge-muted'}`
}

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function ParsingPage(props: PageProps) {
  const searchParams = await props.searchParams
  const indexStr = searchParams.index
  const pageIndex = Number(Array.isArray(indexStr) ? indexStr[0] : indexStr || '0')
  const limit = 50
  const offset = pageIndex * limit

  const [kpis, rawItems] = await Promise.all([
    getParsingKpis(),
    listClinItems(limit + 1, offset),
  ])

  const hasNext = rawItems.length > limit
  const items = rawItems.slice(0, limit)

  return (
    <>
      <div className="page-header">
        <h1>Parsing</h1>
        <p>Structured CLIN line items extracted from RFP documents</p>
      </div>

      <div className="card-grid">
        <div className="card">
          <div className="card-label">Opps Parsed</div>
          <div className="card-value">{kpis.opps_parsed.toLocaleString()}</div>
        </div>
        <div className="card">
          <div className="card-label">Opps Unparsed</div>
          <div className="card-value">{kpis.opps_unparsed.toLocaleString()}</div>
        </div>
        <div className="card">
          <div className="card-label">CLIN Items</div>
          <div className="card-value">{kpis.total_clin_items.toLocaleString()}</div>
        </div>
        <div className="card">
          <div className="card-label">Avg CLINs / Opp</div>
          <div className="card-value">{kpis.avg_clin_per_opp.toFixed(1)}</div>
        </div>
      </div>

      <div className="table-container">
        <div className="table-header">Recent CLIN Items</div>
        <table>
          <thead>
            <tr>
              <th>Opp</th>
              <th>Opp Title</th>
              <th>CLIN #</th>
              <th>Product</th>
              <th>Description</th>
              <th>Qty</th>
              <th>Unit</th>
              <th>Brand Req?</th>
              <th>Service?</th>
              <th>Sourcing</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id}>
                <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{shortId(p.opportunity_id)}</td>
                <td>{p.opp_title ?? '—'}</td>
                <td>{p.clin_number ?? '—'}</td>
                <td style={{ fontWeight: 500 }}>{p.product_name ?? '—'}</td>
                <td style={{ maxWidth: 300, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  {p.description ?? '—'}
                </td>
                <td>{p.quantity?.toLocaleString() ?? '—'}</td>
                <td>{p.unit ?? '—'}</td>
                <td>{p.brand_required == null ? '—' : p.brand_required ? 'yes' : 'no'}</td>
                <td>{p.is_service_clin == null ? '—' : p.is_service_clin ? 'yes' : 'no'}</td>
                <td><span className={statusBadge(p.sourcing_status)}>{p.sourcing_status ?? '—'}</span></td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={10} style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
                  No CLIN items parsed yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        currentIndex={pageIndex}
        hasNext={hasNext}
        totalCount={kpis.total_clin_items}
        limit={limit}
        searchParams={searchParams}
      />
    </>
  )
}
