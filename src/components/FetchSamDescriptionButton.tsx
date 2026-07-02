'use client'

import { useRouter } from 'next/navigation'
import { useState, type CSSProperties } from 'react'

interface Props {
  opportunityId: string
}

const buttonStyle: CSSProperties = {
  background: 'var(--accent)',
  color: 'white',
  border: 'none',
  padding: '0.35rem 0.75rem',
  borderRadius: 4,
  fontSize: '0.85rem',
  fontWeight: 500,
  cursor: 'pointer',
}

export function FetchSamDescriptionButton({ opportunityId }: Props) {
  const router = useRouter()
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [error, setError] = useState('')

  async function run() {
    setStatus('loading')
    setError('')
    try {
      const res = await fetch(`/api/opportunity/${opportunityId}/fetch-sam-description`, {
        method: 'POST',
      })
      const data = (await res.json()) as { ok?: boolean; message?: string }
      if (!res.ok || data?.ok === false) {
        setStatus('error')
        setError(typeof data?.message === 'string' ? data.message : `HTTP ${res.status}`)
        return
      }
      setStatus('idle')
      router.refresh()
    } catch (e) {
      setStatus('error')
      setError(e instanceof Error ? e.message : 'Network error')
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
      <button
        type="button"
        style={{
          ...buttonStyle,
          opacity: status === 'loading' ? 0.6 : 1,
          cursor: status === 'loading' ? 'not-allowed' : 'pointer',
        }}
        onClick={run}
        disabled={status === 'loading'}
      >
        {status === 'loading' ? 'Fetching…' : 'Fetch description'}
      </button>
      {status === 'error' && (
        <span style={{ fontSize: '0.78rem', color: 'var(--red)' }}>{error}</span>
      )}
    </div>
  )
}
