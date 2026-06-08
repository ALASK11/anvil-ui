// First-pass view of the `suppliers` table — added to give the table a
// surface in the UI. Column choices and ordering are a best guess from
// the schema, not driven by stakeholder requirements yet. Refine once
// the supplier-management workflow is clearer.

import { getSuppliersKpis, listSuppliers } from '@/lib/db/queries/suppliers'
import Pagination from '@/components/Pagination'

export const dynamic = 'force-dynamic'

function formatDate(d: Date | null) {
  if (!d) return '—'
  return new Date(d).toISOString().slice(0, 10)
}

function toArray(value: unknown): unknown[] | null {
  if (value == null) return null
  if (Array.isArray(value)) return value
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return parsed
    } catch {}
  }
  return null
}

function formatList(value: unknown): string {
  const arr = toArray(value)
  return arr && arr.length > 0 ? arr.map(String).join(', ') : '—'
}

function reliabilityBadge(score: number | null) {
  if (score == null) return 'badge badge-muted'
  if (score >= 4) return 'badge badge-green'
  if (score >= 3) return 'badge badge-yellow'
  return 'badge badge-red'
}

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function SuppliersPage(props: PageProps) {
  const searchParams = await props.searchParams
  const indexStr = searchParams.index
  const pageIndex = Number(Array.isArray(indexStr) ? indexStr[0] : indexStr || '0')
  const limit = 50
  const offset = pageIndex * limit

  const [kpis, rawSuppliers] = await Promise.all([
    getSuppliersKpis(),
    listSuppliers(limit + 1, offset),
  ])

  const hasNext = rawSuppliers.length > limit
  const suppliers = rawSuppliers.slice(0, limit)

  return (
    <>
      <div className="page-header">
        <h1>Suppliers</h1>
        <p>Channel registry — adapters that produce sourcing results</p>
        <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.85rem', marginTop: '0.5rem' }}>
          First-pass view of the <code>suppliers</code> table. Layout and columns are a best guess from
          the schema — tell us which aggregations or filters would be most useful and we&apos;ll refine.
        </p>
      </div>

      <div className="card-grid">
        <div className="card">
          <div className="card-label">Total Suppliers</div>
          <div className="card-value">{kpis.total.toLocaleString()}</div>
        </div>
        <div className="card">
          <div className="card-label">Active</div>
          <div className="card-value">{kpis.active.toLocaleString()}</div>
        </div>
        <div className="card">
          <div className="card-label">Avg Reliability</div>
          <div className="card-value">
            {kpis.avg_reliability == null ? '—' : kpis.avg_reliability.toFixed(1)}
          </div>
          <div className="card-sub">1–5 scale</div>
        </div>
        <div className="card">
          <div className="card-label">Total Sourced</div>
          <div className="card-value">{kpis.total_sourced_sum.toLocaleString()}</div>
          <div className="card-sub">Sum across all suppliers</div>
        </div>
      </div>

      <div className="table-container">
        <div className="table-header">All Suppliers</div>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Adapter</th>
              <th>Active</th>
              <th>Categories</th>
              <th>Ships?</th>
              <th>Avg Margin</th>
              <th>Avg Lead</th>
              <th>Reliability</th>
              <th>Sourced</th>
              <th>Fulfilled</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((s) => (
              <tr key={s.id}>
                <td style={{ fontWeight: 500 }}>{s.name}</td>
                <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{s.adapter_key}</td>
                <td>
                  {s.is_active
                    ? <span className="badge badge-green">yes</span>
                    : <span className="badge badge-muted">no</span>}
                </td>
                <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{formatList(s.category_focus)}</td>
                <td>{s.handles_shipping == null ? '—' : s.handles_shipping ? 'yes' : 'no'}</td>
                <td>{s.avg_margin_pct == null ? '—' : `${s.avg_margin_pct.toFixed(1)}%`}</td>
                <td>{s.avg_lead_days == null ? '—' : `${s.avg_lead_days.toFixed(0)}d`}</td>
                <td>
                  <span className={reliabilityBadge(s.reliability_score)}>
                    {s.reliability_score ?? '—'}
                  </span>
                </td>
                <td>{s.total_sourced?.toLocaleString() ?? '—'}</td>
                <td>{s.total_fulfilled?.toLocaleString() ?? '—'}</td>
                <td style={{ color: 'var(--text-muted)' }}>{formatDate(s.updated_at)}</td>
              </tr>
            ))}
            {suppliers.length === 0 && (
              <tr>
                <td colSpan={11} style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
                  No suppliers registered.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        currentIndex={pageIndex}
        hasNext={hasNext}
        totalCount={kpis.total}
        limit={limit}
        searchParams={searchParams}
      />
    </>
  )
}
