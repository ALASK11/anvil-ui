'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { type CSSProperties } from 'react'

interface Props {
  agencies: string[]
  currentValue: string | null
}

const selectStyle: CSSProperties = {
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 999,
  color: 'var(--text)',
  padding: '0.3rem 0.6rem',
  fontSize: '0.8rem',
  fontWeight: 500,
  fontFamily: 'inherit',
  cursor: 'pointer',
  maxWidth: '20rem',
}

export function AgencyFilterSelect({ agencies, currentValue }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function onChange(value: string) {
    const sp = new URLSearchParams(searchParams.toString())
    if (value) sp.set('agency', value)
    else sp.delete('agency')
    // Reset pagination when the filter changes.
    sp.delete('index')
    const q = sp.toString()
    router.push(q ? `/rfp?${q}` : '/rfp')
  }

  return (
    <select
      style={selectStyle}
      value={currentValue ?? ''}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Filter by SAM agency"
    >
      <option value="">All SAM agencies ({agencies.length})</option>
      {agencies.map((a) => (
        <option key={a} value={a}>
          {a}
        </option>
      ))}
    </select>
  )
}
