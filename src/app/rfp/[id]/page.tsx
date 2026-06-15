import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getOpportunity, listOpportunityDocuments } from '@/lib/db/queries/opportunities'
import { planetbidsLinks } from '@/lib/opportunity-links'

export const dynamic = 'force-dynamic'

function formatCents(cents: number | null): string {
  if (cents == null) return '—'
  const dollars = cents / 100
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(2)}M`
  if (dollars >= 1_000) return `$${(dollars / 1_000).toFixed(0)}K`
  return `$${dollars.toFixed(0)}`
}

function formatDate(d: Date | null): string {
  if (!d) return '—'
  return new Date(d).toISOString().slice(0, 10)
}

function isPdfLike(filename: string | null): boolean {
  if (!filename) return false
  return /\.pdf$/i.test(filename)
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function BidDetailPage({ params }: PageProps) {
  const { id } = await params
  const [opp, docs] = await Promise.all([
    getOpportunity(id),
    listOpportunityDocuments(id),
  ])

  if (!opp) notFound()

  const pb = planetbidsLinks(opp)

  return (
    <>
      <div className="page-header">
        <Link href="/rfp" style={{ color: 'var(--accent)', fontSize: '0.85rem' }}>
          ← Back to RFPs
        </Link>
        <h1 style={{ marginTop: '0.5rem' }}>{opp.title ?? 'Untitled opportunity'}</h1>
        <p style={{ color: 'var(--text-muted)' }}>
          {opp.agency ?? '—'}
          {opp.solicitation_number && (
            <>
              {' · '}
              <code style={{ fontFamily: 'monospace' }}>{opp.solicitation_number}</code>
            </>
          )}
        </p>
        {pb && (
          <p style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
            PlanetBids:{' '}
            <a
              href={pb.detail}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--accent)' }}
            >
              Bid {pb.bidId ? `#${pb.bidId}` : 'detail'}
            </a>
            {pb.company && (
              <>
                {' · '}
                <a
                  href={pb.company}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--accent)' }}
                >
                  Company {pb.companyId ? `#${pb.companyId}` : 'portal'}
                </a>
              </>
            )}
          </p>
        )}
      </div>

      <div className="card-grid">
        <div className="card">
          <div className="card-label">Posted</div>
          <div className="card-value" style={{ fontSize: '1rem' }}>{formatDate(opp.posted_date)}</div>
        </div>
        <div className="card">
          <div className="card-label">Due</div>
          <div className="card-value" style={{ fontSize: '1rem' }}>{formatDate(opp.response_deadline)}</div>
        </div>
        <div className="card">
          <div className="card-label">Est. Value Max</div>
          <div className="card-value">{formatCents(opp.estimated_value_max)}</div>
        </div>
        <div className="card">
          <div className="card-label">Stage / Status</div>
          <div className="card-value" style={{ fontSize: '0.9rem' }}>
            {opp.stage ?? '—'} / {opp.status ?? '—'}
          </div>
        </div>
        <div className="card">
          <div className="card-label">NAICS</div>
          <div className="card-value" style={{ fontSize: '0.95rem' }}>{opp.naics_code ?? '—'}</div>
        </div>
        <div className="card">
          <div className="card-label">Set-Aside</div>
          <div className="card-value" style={{ fontSize: '0.95rem' }}>{opp.set_aside_type ?? '—'}</div>
        </div>
        <div className="card">
          <div className="card-label">Source</div>
          <div className="card-value" style={{ fontSize: '0.95rem' }}>{opp.source}</div>
          {opp.source_id && (
            <div className="card-sub" style={{ fontFamily: 'monospace' }}>{opp.source_id}</div>
          )}
        </div>
        <div className="card">
          <div className="card-label">Place of Performance</div>
          <div className="card-value" style={{ fontSize: '0.9rem' }}>
            {opp.place_of_performance ?? '—'}
          </div>
        </div>
      </div>

      <div className="table-container">
        <div className="table-header">Documents ({docs.length})</div>
        {docs.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            No documents attached.
          </div>
        ) : (
          <div style={{ padding: '1rem' }}>
            {docs.map((d) => {
              const proxyUrl = `/api/doc?id=${d.id}`
              return (
                <div key={d.id} style={{ marginBottom: '1.5rem' }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      gap: '1rem',
                      padding: '0.5rem 0.75rem',
                      background: 'var(--bg-hover)',
                      border: '1px solid var(--border)',
                      borderRadius: '4px 4px 0 0',
                      fontSize: '0.85rem',
                    }}
                  >
                    <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {d.filename ?? 'document'}
                    </strong>
                    <a
                      href={proxyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'var(--accent)', whiteSpace: 'nowrap' }}
                    >
                      open in new tab
                    </a>
                  </div>
                  {isPdfLike(d.filename) ? (
                    <iframe
                      src={proxyUrl}
                      title={d.filename ?? 'document'}
                      style={{
                        width: '100%',
                        height: '80vh',
                        border: '1px solid var(--border)',
                        borderTop: 'none',
                        borderRadius: '0 0 4px 4px',
                        background: 'white',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        padding: '1rem',
                        border: '1px solid var(--border)',
                        borderTop: 'none',
                        borderRadius: '0 0 4px 4px',
                        color: 'var(--text-muted)',
                        fontSize: '0.85rem',
                      }}
                    >
                      Non-PDF document — use &quot;open in new tab&quot; to view.
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
