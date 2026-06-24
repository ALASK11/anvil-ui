'use client'

import { useState, type CSSProperties } from 'react'

interface Props {
  opportunityId: string
  humanClinCount: number
}

const button: CSSProperties = {
  background: 'var(--accent)',
  color: 'white',
  border: 'none',
  padding: '0.4rem 0.85rem',
  borderRadius: 4,
  fontSize: '0.85rem',
  fontWeight: 500,
  cursor: 'pointer',
}

export function SourceHumanClinsButton({ opportunityId, humanClinCount }: Props) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [response, setResponse] = useState<unknown>(null)
  const [error, setError] = useState('')

  async function run() {
    setStatus('loading')
    setError('')
    setResponse(null)
    try {
      const res = await fetch('/api/clins/source-human', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opportunity_id: opportunityId }),
      })
      const data = await res.json()
      if (!res.ok || data?.ok === false) {
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

  const disabled = status === 'loading' || humanClinCount === 0

  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          style={{
            ...button,
            opacity: disabled ? 0.5 : 1,
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
          onClick={run}
          disabled={disabled}
        >
          {status === 'loading' ? 'sourcing…' : 'Attempt to source human CLINs'}
        </button>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          {humanClinCount === 0
            ? 'no human CLINs to source yet'
            : `${humanClinCount} human CLIN${humanClinCount === 1 ? '' : 's'} on this opportunity`}
        </span>
        {status === 'error' && (
          <span style={{ fontSize: '0.78rem', color: 'var(--red)' }}>{error}</span>
        )}
      </div>

      {response != null && (
        <div
          style={{
            marginTop: '0.6rem',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            padding: '0.65rem 0.85rem',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            fontSize: '0.78rem',
            lineHeight: 1.5,
            overflow: 'auto',
            maxHeight: '50vh',
          }}
        >
          <pre style={{ margin: 0, whiteSpace: 'pre' }}>{JSON.stringify(response, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}
