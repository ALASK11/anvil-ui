import { getReviewKpis, listReviewQueue } from '@/lib/db/queries/review'
import Pagination from '@/components/Pagination'

export const dynamic = 'force-dynamic'

function shortId(id: string) {
  return id.slice(0, 8)
}

function formatCents(cents: number | null) {
  if (cents == null) return '—'
  return `$${(cents / 100).toFixed(2)}`
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

function daysUntil(d: Date | null): { label: string; color: string } {
  if (!d) return { label: '—', color: 'var(--text-muted)' }
  const diff = Math.ceil((new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  if (diff < 0) return { label: 'OVERDUE', color: 'var(--red)' }
  if (diff <= 3) return { label: `${diff}d (urgent)`, color: 'var(--orange)' }
  if (diff <= 7) return { label: `${diff}d`, color: 'var(--yellow)' }
  return { label: `${diff}d`, color: 'var(--text-muted)' }
}

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function ReviewPage(props: PageProps) {
  const searchParams = await props.searchParams
  const indexStr = searchParams.index
  const pageIndex = Number(Array.isArray(indexStr) ? indexStr[0] : indexStr || '0')
  const limit = 50
  const offset = pageIndex * limit

  const [kpis, rawRows] = await Promise.all([
    getReviewKpis(),
    listReviewQueue(limit + 1, offset),
  ])

  const hasNext = rawRows.length > limit
  const rows = rawRows.slice(0, limit)

  return (
    <>
      <div className="page-header">
        <h1>Review &amp; Submit</h1>
        <p>Bid outcomes awaiting a pursue / pass decision, plus today&apos;s activity</p>
      </div>

      <div className="card-grid">
        <div className="card">
          <div className="card-label">Pending</div>
          <div className="card-value" style={{ color: 'var(--yellow)' }}>{kpis.pending.toLocaleString()}</div>
        </div>
        <div className="card">
          <div className="card-label">Pursued Today</div>
          <div className="card-value" style={{ color: 'var(--green)' }}>{kpis.pursue_today.toLocaleString()}</div>
        </div>
        <div className="card">
          <div className="card-label">Passed Today</div>
          <div className="card-value" style={{ color: 'var(--red)' }}>{kpis.pass_today.toLocaleString()}</div>
        </div>
        <div className="card">
          <div className="card-label">Resolved Today</div>
          <div className="card-value" style={{ color: 'var(--purple)' }}>{kpis.resolved_today.toLocaleString()}</div>
        </div>
      </div>

      <div className="table-container">
        <div className="table-header">Review Queue</div>
        <table>
          <thead>
            <tr>
              <th>Opp</th>
              <th>Title</th>
              <th>Agency</th>
              <th>Fit</th>
              <th>Margin</th>
              <th>Cost</th>
              <th>Due In</th>
              <th>Decision</th>
              <th>Rationale</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const due = daysUntil(r.response_deadline)
              return (
                <tr key={r.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{shortId(r.opportunity_id)}</td>
                  <td style={{ fontWeight: 500 }}>{r.opp_title ?? '—'}</td>
                  <td>{r.agency ?? '—'}</td>
                  <td>{r.fit_score ?? '—'}</td>
                  <td>{r.sourcing_margin_pct == null ? '—' : `${r.sourcing_margin_pct.toFixed(1)}%`}</td>
                  <td>{formatCents(r.sourcing_cost_cents)}</td>
                  <td style={{ color: due.color, fontWeight: 500 }}>{due.label}</td>
                  <td><span className={decisionBadge(r.decision, r.result)}>{decisionLabel(r.decision, r.result)}</span></td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem', maxWidth: 320 }}>
                    {r.decision_rationale ?? '—'}
                  </td>
                </tr>
              )
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
                  Queue empty.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        currentIndex={pageIndex}
        hasNext={hasNext}
        limit={limit}
        searchParams={searchParams}
      />
    </>
  )
}
