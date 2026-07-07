'use client'

import { useState, type CSSProperties } from 'react'
import { extractCandidates, type TruepricesCandidate } from '@/lib/trueprices-parse'

const triggerButton: CSSProperties = {
  display: 'block',
  width: 'calc(100% - 2rem)',
  margin: '0 1rem 1rem',
  padding: '0.5rem 0.75rem',
  background: 'var(--accent)',
  color: 'white',
  border: 'none',
  borderRadius: 6,
  fontSize: '0.8rem',
  fontWeight: 600,
  cursor: 'pointer',
  textAlign: 'center',
  letterSpacing: '0.01em',
}

const overlay: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.55)',
  zIndex: 50,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '2rem',
}

const dialog: CSSProperties = {
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  width: 'min(1100px, 95vw)',
  maxHeight: '90vh',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
}

const closeButton: CSSProperties = {
  background: 'var(--bg-hover)',
  border: '1px solid var(--border)',
  color: 'var(--text)',
  padding: '0.25rem 0.65rem',
  borderRadius: 4,
  fontSize: '0.75rem',
  cursor: 'pointer',
}

const searchButton: CSSProperties = {
  background: 'var(--accent)',
  color: 'white',
  border: 'none',
  padding: '0.45rem 1rem',
  borderRadius: 4,
  fontSize: '0.85rem',
  fontWeight: 500,
  cursor: 'pointer',
}

const input: CSSProperties = {
  flex: 1,
  background: 'var(--bg-hover)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  color: 'var(--text)',
  padding: '0.45rem 0.6rem',
  fontSize: '0.9rem',
  fontFamily: 'inherit',
}

function formatCents(cents: number | null): string {
  if (cents == null) return '—'
  return `$${(cents / 100).toFixed(2)}`
}

export function TruepricesGlobalTester() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [candidates, setCandidates] = useState<TruepricesCandidate[]>([])
  const [error, setError] = useState('')

  async function runSearch() {
    if (!query.trim()) return
    setStatus('loading')
    setError('')
    setCandidates([])
    try {
      const res = await fetch(`/api/trueprices/search?query=${encodeURIComponent(query)}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      })
      const data = await res.json()
      if (!res.ok) {
        setStatus('error')
        setError(typeof data?.message === 'string' ? data.message : `HTTP ${res.status}`)
        return
      }
      const parsed = extractCandidates(data)
      setCandidates(parsed)
      setStatus('done')
    } catch (e) {
      setStatus('error')
      setError(e instanceof Error ? e.message : 'Network error')
    }
  }

  return (
    <>
      <button type="button" style={triggerButton} onClick={() => setOpen(true)}>
        Source with TruePrices
      </button>

      {open && (
        <div
          style={overlay}
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false)
          }}
        >
          <div style={dialog}>
            <div
              style={{
                padding: '0.75rem 1rem',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '1rem',
              }}
            >
              <strong style={{ fontSize: '0.95rem' }}>Source with TruePrices</strong>
              <button type="button" style={closeButton} onClick={() => setOpen(false)}>
                close
              </button>
            </div>

            <div
              style={{
                padding: '0.75rem 1rem',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                gap: '0.5rem',
              }}
            >
              <input
                style={input}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') runSearch()
                }}
                placeholder="product query (e.g. paper towel multi-fold)"
                autoFocus
              />
              <button
                type="button"
                style={{
                  ...searchButton,
                  opacity: status === 'loading' || !query.trim() ? 0.6 : 1,
                  cursor:
                    status === 'loading' || !query.trim() ? 'not-allowed' : 'pointer',
                }}
                onClick={runSearch}
                disabled={status === 'loading' || !query.trim()}
              >
                {status === 'loading' ? 'searching…' : 'Search'}
              </button>
            </div>

            <div
              style={{
                overflow: 'auto',
                flex: 1,
                minHeight: '200px',
              }}
            >
              {status === 'idle' && (
                <div style={{ padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Enter a query and hit Search.
                </div>
              )}
              {status === 'loading' && (
                <div style={{ padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Calling TruePrices…
                </div>
              )}
              {status === 'error' && (
                <div style={{ padding: '1.5rem', color: 'var(--red)', fontSize: '0.85rem' }}>
                  {error}
                </div>
              )}
              {status === 'done' && candidates.length === 0 && (
                <div style={{ padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No candidates returned for that query.
                </div>
              )}
              {status === 'done' && candidates.length > 0 && (
                <table>
                  <thead>
                    <tr>
                      <th>Supplier</th>
                      <th>Retailer</th>
                      <th>Product</th>
                      <th>SKU</th>
                      <th>Unit</th>
                      <th>Landed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidates.map((c, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 500 }}>Trueprices</td>
                        <td>
                          {c.product_url && c.seller ? (
                            <a
                              href={c.product_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: 'var(--accent)' }}
                            >
                              {c.seller}
                            </a>
                          ) : (
                            c.seller ?? '—'
                          )}
                        </td>
                        <td>
                          {c.product_url ? (
                            <a
                              href={c.product_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: 'var(--accent)' }}
                            >
                              {c.title ?? 'view'}
                            </a>
                          ) : (
                            c.title ?? '—'
                          )}
                        </td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                          {c.sku ?? '—'}
                        </td>
                        <td>{formatCents(c.price_cents)}</td>
                        <td style={{ color: 'var(--text-muted)' }}>—</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
