import Link from 'next/link'
import {
  getSourcingKpis,
  listSourcingResults,
  listGroupedSourcingResults,
} from '@/lib/db/queries/sourcing'
import { signGcsUrl } from '@/lib/gcs'
import Pagination from '@/components/Pagination'

export const dynamic = 'force-dynamic'

function shortId(id: string) {
  return id.slice(0, 8)
}

function formatDate(d: Date | null) {
  if (!d) return '—'
  return new Date(d).toISOString().slice(0, 10)
}

function formatCents(cents: number | null) {
  if (cents == null) return '—'
  return `$${(cents / 100).toFixed(2)}`
}

function formatMarginRange(min: number | null, max: number | null) {
  if (min == null || max == null) return '—'
  if (min === max) return `${min.toFixed(1)}%`
  return `${min.toFixed(1)}% – ${max.toFixed(1)}%`
}

function formatCostRange(min: number | null, max: number | null) {
  if (min == null || max == null) return '—'
  if (min === max) return formatCents(min)
  return `${formatCents(min)} – ${formatCents(max)}`
}

function confidenceBadge(c: string | null) {
  const map: Record<string, string> = {
    high: 'badge-green',
    medium: 'badge-yellow',
    low: 'badge-red',
  }
  return `badge ${(c && map[c]) || 'badge-muted'}`
}

function isHttpUrl(url: string | null): url is string {
  return !!url && /^https?:\/\//i.test(url)
}

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function SourcingPage({ searchParams }: PageProps) {
  const params = await searchParams
  const rawOppId = params.opportunity_id
  const opportunityId = Array.isArray(rawOppId) ? rawOppId[0] : rawOppId

  const indexStr = params.index
  const pageIndex = Number(Array.isArray(indexStr) ? indexStr[0] : indexStr || '0')
  const limit = 50
  const offset = pageIndex * limit

  const [kpis, rawResults, rawGroupedResults] = await Promise.all([
    opportunityId ? null : getSourcingKpis(),
    opportunityId
      ? listSourcingResults({ limit: limit + 1, offset, opportunityId })
      : [],
    opportunityId
      ? []
      : listGroupedSourcingResults(limit + 1, offset),
  ])

  const hasNext = opportunityId
    ? rawResults.length > limit
    : rawGroupedResults.length > limit

  const results = rawResults.slice(0, limit)
  const groupedResults = rawGroupedResults.slice(0, limit)

  // Sign each unique document gcs_url once so the links open directly in the
  // browser. Signing is deduped because every row of a single-opp view shares
  // the same documents. Failures resolve to null and render as plain text.
  const uniqueDocUrls = Array.from(
    new Set(
      results
        .flatMap((r) => r.documents ?? [])
        .map((d) => d.gcs_url)
        .filter((u): u is string => !!u),
    ),
  )
  const signedDocUrls = new Map<string, string | null>()
  await Promise.all(
    uniqueDocUrls.map(async (url) => {
      signedDocUrls.set(url, await signGcsUrl(url))
    }),
  )

  const selectedRate =
    kpis && kpis.total_results > 0
      ? ((kpis.selected_results / kpis.total_results) * 100).toFixed(0)
      : '0'

  return (
    <>
      <div className="page-header">
        <h1>Sourcing</h1>
        <p>Supplier candidates discovered for opportunities and CLIN items</p>
      </div>

      {opportunityId && (
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '0.75rem 1rem',
            marginBottom: '1rem',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'baseline',
            gap: '0.75rem',
          }}
        >
          <span>
            Filtered to opportunity{' '}
            <code style={{ fontFamily: 'monospace' }}>{shortId(opportunityId)}</code>
          </span>
          <Link href="/pipeline/sourcing" style={{ color: 'var(--accent)' }}>
            clear filter
          </Link>
        </div>
      )}

      {kpis && (
        <div className="card-grid">
          <div className="card">
            <div className="card-label">CLINs Sourced</div>
            <div className="card-value">{kpis.total_clins_sourced.toLocaleString()}</div>
          </div>
          <div className="card">
            <div className="card-label">Sourcing Results</div>
            <div className="card-value">{kpis.total_results.toLocaleString()}</div>
          </div>
          <div className="card">
            <div className="card-label">Avg Results / CLIN</div>
            <div className="card-value">{kpis.avg_results_per_clin.toFixed(1)}</div>
          </div>
          <div className="card">
            <div className="card-label">Selected Rate</div>
            <div className="card-value">{selectedRate}%</div>
            <div className="card-sub">selected / total (all opps)</div>
          </div>
        </div>
      )}

      <div className="table-container">
        <div className="table-header">
          {opportunityId ? `Sourcing Details — ${shortId(opportunityId)}` : 'Sourcing Opportunities Summary'}
        </div>
        <table>
          {opportunityId ? (
            <>
              <thead>
                <tr>
                  <th>Opp</th>
                  <th>Opp Title</th>
                  <th>Bid Due</th>
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
                  <th>Product?</th>
                  <th>Rating Reason</th>
                  <th>Selected</th>
                  <th>Documents</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{shortId(r.opportunity_id)}</td>
                    <td>{r.opp_title ?? '—'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDate(r.response_deadline)}</td>
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
                    <td><span className={confidenceBadge(r.confidence)}>{r.confidence ?? '—'}</span></td>
                    {/* TODO: wire to sourcing_results.is_product once the column exists (see SourcingResultRow). Placeholder for now. */}
                    <td>—</td>
                    {/* TODO: wire to sourcing_results.rating_reason once the column exists. Placeholder for now. */}
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: 280 }}>—</td>
                    <td>{r.is_selected ? <span className="badge badge-green">yes</span> : '—'}</td>
                    <td style={{ fontSize: '0.85rem', maxWidth: 220 }}>
                      {r.documents && r.documents.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                          {r.documents.map((doc, i) => {
                            const signed = doc.gcs_url ? signedDocUrls.get(doc.gcs_url) : null
                            return signed ? (
                              <a
                                key={i}
                                href={signed}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={doc.filename ?? undefined}
                                style={{
                                  color: 'var(--accent)',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {doc.filename ?? 'document'}
                              </a>
                            ) : (
                              <span key={i} title={doc.filename ?? ''} style={{ color: 'var(--text-muted)' }}>
                                {doc.filename ?? '—'}
                              </span>
                            )
                          })}
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
                {results.length === 0 && (
                  <tr>
                    <td colSpan={17} style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
                      No sourcing results for this opportunity yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </>
          ) : (
            <>
              <thead>
                <tr>
                  <th>Opp ID</th>
                  <th>Opportunity Title</th>
                  <th style={{ textAlign: 'center' }}>Sourced Count</th>
                  <th>Suppliers</th>
                  <th>Margin Range</th>
                  <th>Landed Cost Range</th>
                  <th style={{ textAlign: 'center' }}>Selected?</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {groupedResults.map((r) => (
                  <tr key={r.opportunity_id}>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{shortId(r.opportunity_id)}</td>
                    <td style={{ fontWeight: 500 }}>{r.opp_title ?? '—'}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="badge badge-blue" style={{ fontSize: '0.85rem', padding: '0.25rem 0.6rem', fontWeight: 600 }}>
                        {r.sourced_count}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.suppliers || ''}>
                      {r.suppliers}
                    </td>
                    <td>{formatMarginRange(r.min_margin_pct, r.max_margin_pct)}</td>
                    <td>{formatCostRange(r.min_landed_cost_cents, r.max_landed_cost_cents)}</td>
                    <td style={{ textAlign: 'center' }}>
                      {r.any_selected ? <span className="badge badge-green">yes</span> : '—'}
                    </td>
                    <td>
                      <Link
                        href={`/pipeline/sourcing?opportunity_id=${r.opportunity_id}`}
                        className="pagination-btn"
                        style={{
                          padding: '0.25rem 0.6rem',
                          fontSize: '0.75rem',
                          background: 'var(--accent)',
                          borderColor: 'var(--accent)',
                          color: '#fff',
                        }}
                      >
                        View Details
                      </Link>
                    </td>
                  </tr>
                ))}
                {groupedResults.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
                      No sourcing opportunities found.
                    </td>
                  </tr>
                )}
              </tbody>
            </>
          )}
        </table>
      </div>

      <Pagination
        currentIndex={pageIndex}
        hasNext={hasNext}
        limit={limit}
        searchParams={params}
      />
    </>
  )
}
