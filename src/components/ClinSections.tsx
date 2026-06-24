import type { CSSProperties } from 'react'
import type {
  SourcingResultRow,
  HumanSourcingResultRow,
} from '@/lib/db/queries/sourcing'
import type {
  OpportunityClinRow,
  HumanClinItemRow,
} from '@/lib/db/queries/opportunities'

// Subset of fields ClinResultsTable actually renders. Both SourcingResultRow
// (machine) and HumanSourcingResultRow (human) structurally satisfy this.
interface SourcingDisplayRow {
  id: string
  supplier_name: string | null
  retailer_name: string | null
  product_name: string | null
  product_url: string | null
  sku: string | null
  unit_price_cents: number | null
  total_landed_cost_cents: number | null
  bid_price_recommended_cents: number | null
  margin_pct: number | null
  lead_time_days: number | null
  confidence: string | null
  is_selected: boolean | null
}

function isHttpUrl(url: string | null): url is string {
  return !!url && /^https?:\/\//i.test(url)
}

function formatCents(cents: number | null) {
  if (cents == null) return '—'
  return `$${(cents / 100).toFixed(2)}`
}

function confidenceBadge(c: string | null) {
  const map: Record<string, string> = {
    high: 'badge-green',
    medium: 'badge-yellow',
    low: 'badge-red',
  }
  return `badge ${(c && map[c]) || 'badge-muted'}`
}

export const groupHeaderStyle: CSSProperties = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  marginBottom: '1rem',
}

export const groupSummaryStyle: CSSProperties = {
  padding: '0.6rem 0.85rem',
  fontSize: '0.9rem',
  fontWeight: 600,
  cursor: 'pointer',
  userSelect: 'none',
  listStyle: 'none',
}

export function ClinResultsTable({ results }: { results: SourcingDisplayRow[] }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Supplier</th>
          <th>Retailer</th>
          <th>Product</th>
          <th>SKU</th>
          <th>Unit</th>
          <th>Landed</th>
          <th>Bid Reco</th>
          <th>Margin</th>
          <th>Lead</th>
          <th>Conf.</th>
          <th>Selected</th>
        </tr>
      </thead>
      <tbody>
        {results.map((r) => (
          <tr key={r.id}>
            <td style={{ fontWeight: 500 }}>{r.supplier_name ?? '—'}</td>
            <td>{r.retailer_name ?? '—'}</td>
            <td>
              {isHttpUrl(r.product_url) ? (
                <a
                  href={r.product_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--accent)' }}
                >
                  {r.product_name ?? 'view'}
                </a>
              ) : (
                r.product_name ?? '—'
              )}
            </td>
            <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{r.sku ?? '—'}</td>
            <td>{formatCents(r.unit_price_cents)}</td>
            <td>{formatCents(r.total_landed_cost_cents)}</td>
            <td>{formatCents(r.bid_price_recommended_cents)}</td>
            <td>{r.margin_pct == null ? '—' : `${r.margin_pct.toFixed(1)}%`}</td>
            <td>{r.lead_time_days == null ? '—' : `${r.lead_time_days}d`}</td>
            <td>
              <span className={confidenceBadge(r.confidence)}>{r.confidence ?? '—'}</span>
            </td>
            <td>{r.is_selected ? <span className="badge badge-green">yes</span> : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function ClinSection({
  clin,
  results,
}: {
  clin: OpportunityClinRow
  results: SourcingResultRow[]
}) {
  return (
    <div className="table-container" style={{ marginBottom: '1.25rem' }}>
      <div
        className="table-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
          <strong>CLIN {clin.clin_number ?? '(unnumbered)'}</strong>
          {clin.product_name && <span style={{ fontWeight: 400 }}>· {clin.product_name}</span>}
          {clin.product_category && (
            <span
              className="badge badge-muted"
              style={{ fontSize: '0.7rem', textTransform: 'lowercase' }}
            >
              {clin.product_category}
            </span>
          )}
          {clin.is_service_clin && (
            <span className="badge badge-yellow" style={{ fontSize: '0.7rem' }}>
              service
            </span>
          )}
        </span>
        {clin.quantity != null && (
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
            {clin.quantity.toLocaleString()}
            {clin.unit ? ` ${clin.unit}` : ''}
          </span>
        )}
      </div>
      {results.length === 0 ? (
        <div style={{ padding: '0.9rem 1.25rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          No sourcing results for this CLIN yet.
        </div>
      ) : (
        <ClinResultsTable results={results} />
      )}
    </div>
  )
}

export function HumanClinSection({
  clin,
  results = [],
}: {
  clin: HumanClinItemRow
  results?: HumanSourcingResultRow[]
}) {
  const labeledAt = clin.labeled_at
    ? new Date(clin.labeled_at).toISOString().slice(0, 10)
    : null
  return (
    <div className="table-container" style={{ marginBottom: '1rem' }}>
      <div
        className="table-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
          <strong>CLIN {clin.clin_number ?? '(unnumbered)'}</strong>
          {clin.product_name && <span style={{ fontWeight: 400 }}>· {clin.product_name}</span>}
          {clin.product_category && (
            <span className="badge badge-muted" style={{ fontSize: '0.7rem', textTransform: 'lowercase' }}>
              {clin.product_category}
            </span>
          )}
          {clin.is_service_clin && (
            <span className="badge badge-yellow" style={{ fontSize: '0.7rem' }}>
              service
            </span>
          )}
          {clin.brand_required && (
            <span className="badge badge-red" style={{ fontSize: '0.7rem' }}>
              brand required
            </span>
          )}
        </span>
        {clin.quantity != null && (
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
            {clin.quantity.toLocaleString()}
            {clin.unit ? ` ${clin.unit}` : ''}
          </span>
        )}
      </div>
      <div style={{ padding: '0.65rem 0.85rem', fontSize: '0.85rem' }}>
        {clin.description && (
          <div style={{ color: 'var(--text-muted)', marginBottom: '0.4rem' }}>{clin.description}</div>
        )}
        {clin.specs && (
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{clin.specs}</div>
        )}
        <div
          style={{
            marginTop: '0.5rem',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            borderTop: '1px solid var(--border)',
            paddingTop: '0.4rem',
          }}
        >
          labeled by {clin.labeled_by ?? 'unknown'}
          {labeledAt ? ` on ${labeledAt}` : ''}
          {clin.note ? ` — ${clin.note}` : ''}
        </div>
      </div>
      {results.length > 0 && <ClinResultsTable results={results} />}
    </div>
  )
}
