'use client'

import { useState, type CSSProperties } from 'react'

interface Props {
  defaultQuery?: string | null
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
  width: 'min(900px, 95vw)',
  maxHeight: '90vh',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
}

const triggerButton: CSSProperties = {
  background: 'var(--accent)',
  color: 'white',
  border: 'none',
  padding: '0.35rem 0.75rem',
  borderRadius: 4,
  fontSize: '0.8rem',
  fontWeight: 500,
  cursor: 'pointer',
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
  ...triggerButton,
  padding: '0.45rem 1rem',
  fontSize: '0.85rem',
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

export function TruepricesTester({ defaultQuery }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(defaultQuery ?? '')
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [response, setResponse] = useState<unknown>(null)
  const [error, setError] = useState('')

  async function runSearch() {
    if (!query.trim()) return
    setStatus('loading')
    setError('')
    setResponse(null)
    try {
      const res = await fetch(`/api/trueprices/search?query=${encodeURIComponent(query)}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      })
      const data = await res.json()
      if (!res.ok) {
        setStatus('error')
        setError(typeof data?.message === 'string' ? data.message : `HTTP ${res.status}`)
        setResponse(data)
        return
      }
      setStatus('done')
      setResponse(data)
    } catch (e) {
      setStatus('error')
      setError(e instanceof Error ? e.message : 'Network error')
    }
  }

  return (
    <>
      <button type="button" style={triggerButton} onClick={() => setOpen(true)}>
        Test Trueprices
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
              <strong style={{ fontSize: '0.95rem' }}>Trueprices search</strong>
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
                placeholder="product query (e.g. traffic paint waterborne)"
                autoFocus
              />
              <button
                type="button"
                style={{
                  ...searchButton,
                  opacity: status === 'loading' || !query.trim() ? 0.6 : 1,
                  cursor: status === 'loading' || !query.trim() ? 'not-allowed' : 'pointer',
                }}
                onClick={runSearch}
                disabled={status === 'loading' || !query.trim()}
              >
                {status === 'loading' ? 'searching…' : 'Search'}
              </button>
            </div>

            <div
              style={{
                padding: '0.75rem 1rem',
                overflow: 'auto',
                background: 'var(--bg-card)',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                fontSize: '0.78rem',
                lineHeight: 1.5,
                flex: 1,
                minHeight: '300px',
              }}
            >
              {status === 'idle' && (
                <span style={{ color: 'var(--text-muted)', fontFamily: 'inherit', fontSize: '0.85rem' }}>
                  Enter a query and hit Search.
                </span>
              )}
              {status === 'loading' && (
                <span style={{ color: 'var(--text-muted)', fontFamily: 'inherit', fontSize: '0.85rem' }}>
                  Calling upstream…
                </span>
              )}
              {status === 'error' && (
                <div>
                  <div style={{ color: 'var(--red)', fontFamily: 'inherit', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                    {error}
                  </div>
                  {response != null && (
                    <pre style={{ margin: 0, whiteSpace: 'pre' }}>{JSON.stringify(response, null, 2)}</pre>
                  )}
                </div>
              )}
              {status === 'done' && response != null && (
                <pre style={{ margin: 0, whiteSpace: 'pre' }}>{JSON.stringify(response, null, 2)}</pre>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
