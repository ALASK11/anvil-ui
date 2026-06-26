import Link from 'next/link'
import type { OpportunityListRow } from '@/lib/db/types'
import { StarToggle } from './StarToggle'

function stageBadge(stage: string | null) {
  const map: Record<string, string> = {
    scraping: 'badge-muted',
    dedup: 'badge-muted',
    parsing: 'badge-blue',
    sourcing: 'badge-blue',
    ranking: 'badge-yellow',
    review: 'badge-purple',
    submitted: 'badge-green',
    no_match: 'badge-red',
    final_rfp: 'badge-blue',
    draft_rfp: 'badge-muted',
  }
  return `badge ${(stage && map[stage]) || 'badge-muted'}`
}

function shortId(id: string) {
  return id.slice(0, 8)
}

function formatDate(d: Date | null) {
  if (!d) return '—'
  return new Date(d).toISOString().slice(0, 10)
}

function formatCents(cents: number | null) {
  if (cents == null) return 'TBD'
  const dollars = cents / 100
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`
  if (dollars >= 1_000) return `$${(dollars / 1_000).toFixed(0)}K`
  return `$${dollars.toFixed(0)}`
}

interface Props {
  rows: OpportunityListRow[]
  title?: string
  emptyMessage?: string
}

export function RfpListTable({
  rows,
  title = 'RFP List',
  emptyMessage = 'No opportunities found.',
}: Props) {
  return (
    <div className="table-container">
      <div className="table-header">{title}</div>
      <table>
        <thead>
          <tr>
            <th style={{ width: '2.5rem', textAlign: 'center' }}>★</th>
            <th>ID</th>
            <th>Source</th>
            <th>Title</th>
            <th>Agency</th>
            <th>Posted</th>
            <th>Due</th>
            <th>CLINs</th>
            <th>Sourcing</th>
            <th>Est. Value</th>
            <th>Stage</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td style={{ textAlign: 'center' }}>
                <StarToggle opportunityId={r.id} initialStarred={r.is_starred === true} />
              </td>
              <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                <Link href={`/rfp/${r.id}`} style={{ color: 'var(--accent)' }}>
                  {shortId(r.id)}
                </Link>
              </td>
              <td style={{ fontWeight: 500 }}>{r.source}</td>
              <td style={{ fontWeight: 500 }}>
                <Link href={`/rfp/${r.id}`} style={{ color: 'var(--text)' }}>
                  {r.title ?? '—'}
                </Link>
              </td>
              <td>{r.agency ?? '—'}</td>
              <td>{formatDate(r.posted_date)}</td>
              <td>{formatDate(r.response_deadline)}</td>
              <td>{r.product_count}</td>
              <td>{r.bid_count}</td>
              <td>{formatCents(r.estimated_value_max)}</td>
              <td>
                <span className={stageBadge(r.stage)}>
                  {r.stage ? r.stage.replace(/_/g, ' ') : '—'}
                </span>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={11}
                style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}
              >
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
