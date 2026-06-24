import Link from 'next/link'
import {
  getSourcingKpis,
  listSourcingResults,
  listGroupedSourcingResults,
  countGroupedSourcingOpps,
  listHumanSourcingResultsForOpportunity,
  type SourcingResultRow,
  type HumanSourcingResultRow,
} from '@/lib/db/queries/sourcing'
import {
  listOpportunityDocuments,
  getOpportunity,
  getOpportunityParsedJson,
  listClinItemsForOpportunity,
  listHumanClinItemsForOpportunity,
} from '@/lib/db/queries/opportunities'
import { planetbidsLinks } from '@/lib/opportunity-links'
import Pagination from '@/components/Pagination'
import { OpportunityLabels } from '@/components/OpportunityLabels'
import { ParsedJsonPanel } from '@/components/ParsedJsonPanel'
import { TruepricesTester } from '@/components/TruepricesTester'
import { PdfParseTool } from '@/components/PdfParseTool'
import {
  ClinSection,
  ClinResultsTable,
  HumanClinSection,
  groupHeaderStyle,
  groupSummaryStyle,
} from '@/components/ClinSections'
import { DocumentsPanel } from './documents-panel'

export const dynamic = 'force-dynamic'

function shortId(id: string) {
  return id.slice(0, 8)
}

function formatDate(d: Date | null) {
  if (!d) return '—'
  return new Date(d).toISOString().slice(0, 10)
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

  const flag = (key: string): boolean => {
    const v = params[key]
    const value = Array.isArray(v) ? v[0] : v
    return value === 'true' || value === '1'
  }
  const hasDocuments = flag('has_documents')
  const activeOnly = flag('active')

  const filtersActive = !opportunityId && (hasDocuments || activeOnly)

  const [
    kpis,
    rawResults,
    rawGroupedResults,
    oppDocuments,
    opp,
    filteredCount,
    parsedJson,
    clinItems,
    humanClinItems,
    rawHumanSourcingResults,
  ] = await Promise.all([
    opportunityId ? null : getSourcingKpis(),
    opportunityId ? listSourcingResults({ opportunityId }) : [],
    opportunityId
      ? []
      : listGroupedSourcingResults({ limit: limit + 1, offset, hasDocuments, activeOnly }),
    opportunityId ? listOpportunityDocuments(opportunityId) : [],
    opportunityId ? getOpportunity(opportunityId) : null,
    filtersActive ? countGroupedSourcingOpps({ hasDocuments, activeOnly }) : null,
    opportunityId ? getOpportunityParsedJson(opportunityId) : null,
    opportunityId ? listClinItemsForOpportunity(opportunityId) : [],
    opportunityId ? listHumanClinItemsForOpportunity(opportunityId) : [],
    opportunityId ? listHumanSourcingResultsForOpportunity(opportunityId) : [],
  ])

  const humanResultsByClin = new Map<string | null, HumanSourcingResultRow[]>()
  for (const r of rawHumanSourcingResults) {
    const key = r.human_clin_item_id ?? null
    const bucket = humanResultsByClin.get(key)
    if (bucket) bucket.push(r)
    else humanResultsByClin.set(key, [r])
  }

  function filterUrl(next: { hasDocuments: boolean; activeOnly: boolean }): string {
    const sp = new URLSearchParams()
    if (next.hasDocuments) sp.set('has_documents', 'true')
    if (next.activeOnly) sp.set('active', 'true')
    const q = sp.toString()
    return q ? `/pipeline/sourcing?${q}` : '/pipeline/sourcing'
  }

  const pb = opp ? planetbidsLinks(opp) : null

  const hasNext = opportunityId ? false : rawGroupedResults.length > limit
  const groupedResults = rawGroupedResults.slice(0, limit)

  // Group sourcing results by clin_item_id; null key = opp-level / orphan results.
  const resultsByClin = new Map<string | null, SourcingResultRow[]>()
  for (const r of rawResults) {
    const key = r.clin_item_id ?? null
    const bucket = resultsByClin.get(key)
    if (bucket) bucket.push(r)
    else resultsByClin.set(key, [r])
  }
  const orphanResults = resultsByClin.get(null) ?? []

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
            flexWrap: 'wrap',
          }}
        >
          <span>
            Filtered to opportunity{' '}
            <code style={{ fontFamily: 'monospace' }}>{shortId(opportunityId)}</code>
          </span>
          <Link href={`/rfp/${opportunityId}`} style={{ color: 'var(--accent)' }}>
            view bid detail
          </Link>
          {pb && (
            <a
              href={pb.detail}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--accent)' }}
            >
              PlanetBids bid{pb.bidId ? ` #${pb.bidId}` : ''}
            </a>
          )}
          {pb?.company && (
            <a
              href={pb.company}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--accent)' }}
            >
              PlanetBids company{pb.companyId ? ` #${pb.companyId}` : ''}
            </a>
          )}
          <Link href="/pipeline/sourcing" style={{ color: 'var(--accent)' }}>
            clear filter
          </Link>
        </div>
      )}

      {opportunityId && opp && (
        <OpportunityLabels
          opportunityId={opportunityId}
          initialIsProduct={opp.is_product}
          initialCommentary={opp.commentary}
        />
      )}

      {opportunityId && (
        <div style={{ marginBottom: '1rem' }}>
          <TruepricesTester defaultQuery={opp?.title ?? null} />
        </div>
      )}

      {opportunityId && parsedJson && (
        <ParsedJsonPanel
          data={parsedJson}
          title={`Parsed JSON — ${parsedJson.clin_items.length} CLIN item${parsedJson.clin_items.length === 1 ? '' : 's'}`}
        />
      )}

      {opportunityId && <DocumentsPanel documents={oppDocuments} />}

      {opportunityId && (
        <PdfParseTool
          opportunityId={opportunityId}
          documents={oppDocuments.map((d) => ({ id: d.id, filename: d.filename }))}
        />
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

      {!opportunityId && (
        <div className="filter-bar">
          <span className="filter-bar-label">Filters</span>
          <Link
            href={filterUrl({ hasDocuments: !hasDocuments, activeOnly })}
            className={`filter-chip${hasDocuments ? ' active' : ''}`}
          >
            <span className="filter-chip-dot" />
            Has documents
          </Link>
          <Link
            href={filterUrl({ hasDocuments, activeOnly: !activeOnly })}
            className={`filter-chip${activeOnly ? ' active' : ''}`}
          >
            <span className="filter-chip-dot" />
            Active only
          </Link>
          {filteredCount != null && (
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              {filteredCount.toLocaleString()} opp{filteredCount === 1 ? '' : 's'} match
            </span>
          )}
          {(hasDocuments || activeOnly) && (
            <Link href="/pipeline/sourcing" className="filter-bar-clear">
              clear filters
            </Link>
          )}
        </div>
      )}

      {opportunityId ? (
        <>
          {clinItems.length === 0 &&
            humanClinItems.length === 0 &&
            orphanResults.length === 0 && (
              <div className="table-container">
                <div className="table-header">Sourcing Results</div>
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No sourcing results for this opportunity yet.
                </div>
              </div>
            )}

          {clinItems.length > 0 && (
            <details open style={groupHeaderStyle}>
              <summary style={groupSummaryStyle}>
                Machine-parsed CLINs ({clinItems.length})
              </summary>
              <div style={{ padding: '0 0.85rem 0.5rem' }}>
                {clinItems.map((clin) => (
                  <ClinSection
                    key={clin.id}
                    clin={clin}
                    results={resultsByClin.get(clin.id) ?? []}
                  />
                ))}
              </div>
            </details>
          )}

          {humanClinItems.length > 0 && (
            <details open style={groupHeaderStyle}>
              <summary style={groupSummaryStyle}>
                Human-reviewed CLINs ({humanClinItems.length})
              </summary>
              <div style={{ padding: '0 0.85rem 0.5rem' }}>
                {humanClinItems.map((clin) => (
                  <HumanClinSection
                    key={clin.id}
                    clin={clin}
                    results={humanResultsByClin.get(clin.id) ?? []}
                  />
                ))}
              </div>
            </details>
          )}

          {orphanResults.length > 0 && (
            <div className="table-container" style={{ marginBottom: '1.25rem' }}>
              <div className="table-header">
                {clinItems.length === 0 && humanClinItems.length === 0
                  ? 'Sourcing Results (opportunity-level)'
                  : `Other results — ${orphanResults.length} not linked to a CLIN`}
              </div>
              <ClinResultsTable results={orphanResults} />
            </div>
          )}
        </>
      ) : (
        <div className="table-container">
          <div className="table-header">Sourcing Opportunities Summary</div>
          <table>
            <thead>
              <tr>
                <th>Opp ID</th>
                <th>Opportunity Title</th>
                <th>Bid Due</th>
                <th style={{ textAlign: 'center' }}>Sourced Count</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {groupedResults.map((r) => (
                <tr key={r.opportunity_id}>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{shortId(r.opportunity_id)}</td>
                  <td style={{ fontWeight: 500 }}>{r.opp_title ?? '—'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{formatDate(r.response_deadline)}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span
                      className="badge badge-blue"
                      style={{ fontSize: '0.85rem', padding: '0.25rem 0.6rem', fontWeight: 600 }}
                    >
                      {r.sourced_count}
                    </span>
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
                  <td colSpan={5} style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
                    No sourcing opportunities found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {!opportunityId && (
        <Pagination
          currentIndex={pageIndex}
          hasNext={hasNext}
          limit={limit}
          searchParams={params}
        />
      )}
    </>
  )
}
