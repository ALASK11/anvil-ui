import Link from 'next/link'
import type { CSSProperties } from 'react'
import { getRankingKpis, listRankings } from '@/lib/db/queries/ranking'
import Pagination from '@/components/Pagination'

const viewLinkStyle: CSSProperties = {
  background: 'var(--accent)',
  color: 'white',
  padding: '0.2rem 0.6rem',
  borderRadius: 4,
  fontSize: '0.75rem',
  fontWeight: 500,
  textDecoration: 'none',
  display: 'inline-block',
}

export const dynamic = 'force-dynamic'

function shortId(id: string) {
  return id.slice(0, 8)
}

function formatCents(cents: number | null) {
  if (cents == null) return '—'
  return `$${(cents / 100).toFixed(2)}`
}

function formatDate(d: Date | null) {
  if (!d) return '—'
  return new Date(d).toISOString().slice(0, 10)
}

function decisionBadge(decision: string | null, result: string | null) {
  if (result === 'won') return 'badge badge-green'
  if (result === 'lost') return 'badge badge-red'
  if (result === 'no_award') return 'badge badge-muted'
  if (decision === 'pursue') return 'badge badge-purple'
  if (decision === 'pass') return 'badge badge-muted'
  return 'badge badge-yellow'
}

function decisionLabel(decision: string | null, result: string | null) {
  if (result) return result.replace(/_/g, ' ')
  if (decision) return decision
  return 'pending'
}

function fitColor(score: number | null): string {
  if (score == null) return 'var(--text-muted)'
  if (score >= 80) return 'var(--green)'
  if (score >= 60) return 'var(--yellow)'
  return 'var(--red)'
}

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function RankingPage(props: PageProps) {
  const searchParams = await props.searchParams
  const indexStr = searchParams.index
  const pageIndex = Number(Array.isArray(indexStr) ? indexStr[0] : indexStr || '0')
  const limit = 50
  const offset = pageIndex * limit

  const [kpis, rawRows] = await Promise.all([
    getRankingKpis(),
    listRankings(limit + 1, offset),
  ])

  const hasNext = rawRows.length > limit
  const rows = rawRows.slice(0, limit)

  return (
    <>
      <div className="page-header">
        <h1>Page Ranking</h1>
        <p>Bid outcomes scored by fit; sorted by fit_score descending</p>
      </div>

      <div className="card-grid">
        <div className="card">
          <div className="card-label">Total Scored</div>
          <div className="card-value">{kpis.total_scored.toLocaleString()}</div>
        </div>
        <div className="card">
          <div className="card-label">Avg Fit Score</div>
          <div className="card-value">{kpis.avg_fit_score.toFixed(0)}</div>
          <div className="card-sub">0–100 scale</div>
        </div>
        <div className="card">
          <div className="card-label">Avg Sourcing Margin</div>
          <div className="card-value">{kpis.avg_margin_pct.toFixed(1)}%</div>
        </div>
        <div className="card">
          <div className="card-label">Awaiting Decision</div>
          <div className="card-value">{kpis.awaiting_decision.toLocaleString()}</div>
        </div>
      </div>

      <div className="table-container">
        <div className="table-header">Ranked Bid Outcomes</div>
        <table>
          <thead>
            <tr>
              <th>Opp</th>
              <th>Title</th>
              <th>Agency</th>
              <th>Fit</th>
              <th>Sourcing Margin</th>
              <th>Sourcing Cost</th>
              <th>Supplier</th>
              <th>Decision</th>
              <th>Scored</th>
              <th>Decided</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.id}>
                <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{shortId(b.opportunity_id)}</td>
                <td style={{ fontWeight: 500 }}>{b.opp_title ?? '—'}</td>
                <td>{b.agency ?? '—'}</td>
                <td style={{ color: fitColor(b.fit_score), fontWeight: 600 }}>{b.fit_score ?? '—'}</td>
                <td>{b.sourcing_margin_pct == null ? '—' : `${b.sourcing_margin_pct.toFixed(1)}%`}</td>
                <td>{formatCents(b.sourcing_cost_cents)}</td>
                <td>{b.sourcing_supplier ?? '—'}</td>
                <td><span className={decisionBadge(b.decision, b.result)}>{decisionLabel(b.decision, b.result)}</span></td>
                <td style={{ color: 'var(--text-muted)' }}>{formatDate(b.scored_at)}</td>
                <td style={{ color: 'var(--text-muted)' }}>{formatDate(b.decided_at)}</td>
                <td>
                  <Link
                    href={`/pipeline/sourcing?opportunity_id=${b.opportunity_id}`}
                    style={viewLinkStyle}
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={11} style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
                  No bids scored yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        currentIndex={pageIndex}
        hasNext={hasNext}
        totalCount={kpis.total_scored}
        limit={limit}
        searchParams={searchParams}
      />
    </>
  )
}
