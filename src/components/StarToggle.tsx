'use client'

import { useState, type CSSProperties } from 'react'

interface Props {
  opportunityId: string
  initialStarred: boolean
}

const baseStyle: CSSProperties = {
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  padding: '0.2rem 0.4rem',
  fontSize: '1.1rem',
  lineHeight: 1,
  borderRadius: 4,
}

export function StarToggle({ opportunityId, initialStarred }: Props) {
  const [starred, setStarred] = useState(initialStarred)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(false)

  async function toggle() {
    if (pending) return
    const next = !starred
    setStarred(next)
    setPending(true)
    setError(false)
    try {
      const res = await fetch(`/api/opportunity/${opportunityId}/labels`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_starred: next }),
      })
      if (!res.ok) {
        setStarred(!next)
        setError(true)
      }
    } catch {
      setStarred(!next)
      setError(true)
    } finally {
      setPending(false)
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={starred}
      aria-label={starred ? 'Unstar this RFP' : 'Star this RFP'}
      title={error ? 'Save failed — click to retry' : starred ? 'Starred (click to remove)' : 'Click to star'}
      style={{
        ...baseStyle,
        cursor: pending ? 'wait' : 'pointer',
        color: error ? 'var(--red)' : starred ? 'var(--yellow)' : 'var(--text-muted)',
        opacity: pending ? 0.5 : 1,
      }}
    >
      {starred ? '★' : '☆'}
    </button>
  )
}
