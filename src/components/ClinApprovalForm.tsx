'use client'

import { useState, type CSSProperties } from 'react'

export interface ParsedClin {
  clin_number?: string | null
  description?: string | null
  product_name?: string | null
  product_category?: string | null
  quantity?: number | null
  unit?: string | null
  acceptable_brands?: unknown
  brand_required?: boolean | null
  model?: string | null
  specs?: string | null
  is_service_clin?: boolean | null
  service_clin_type?: string | null
}

interface Props {
  opportunityId: string
  clins: ParsedClin[]
}

const card: CSSProperties = {
  display: 'flex',
  gap: '0.75rem',
  alignItems: 'flex-start',
  padding: '0.65rem 0.75rem',
  border: '1px solid var(--border)',
  borderRadius: 6,
  background: 'var(--bg)',
  fontSize: '0.85rem',
}

const cardSelected: CSSProperties = {
  ...card,
  borderColor: 'var(--accent)',
  background: 'var(--bg-hover)',
}

const submitButton: CSSProperties = {
  background: 'var(--accent)',
  color: 'white',
  border: 'none',
  padding: '0.45rem 1rem',
  borderRadius: 4,
  fontSize: '0.85rem',
  fontWeight: 500,
  cursor: 'pointer',
}

const linkButton: CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--accent)',
  fontSize: '0.78rem',
  cursor: 'pointer',
  padding: 0,
  textDecoration: 'underline',
}

function brandsArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter((s) => s.length > 0)
  return []
}

export function ClinApprovalForm({ opportunityId, clins }: Props) {
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [note, setNote] = useState('')
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle')
  const [response, setResponse] = useState<unknown>(null)
  const [error, setError] = useState('')

  function toggle(idx: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
    setStatus('idle')
  }

  function selectAll() {
    setSelected(new Set(clins.map((_, i) => i)))
    setStatus('idle')
  }

  function selectNone() {
    setSelected(new Set())
    setStatus('idle')
  }

  async function approve() {
    if (selected.size === 0) return
    const trimmedNote = note.trim()
    const payload = {
      opportunity_id: opportunityId,
      clins: Array.from(selected)
        .sort((a, b) => a - b)
        .map((i) => clins[i]),
      note: trimmedNote || null,
    }
    setStatus('submitting')
    setError('')
    setResponse(null)
    try {
      const res = await fetch('/api/clins/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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

  const allSelected = selected.size === clins.length && clins.length > 0

  return (
    <div
      style={{
        marginTop: '1rem',
        border: '1px solid var(--border)',
        borderRadius: 6,
        background: 'var(--bg-card)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: '1rem',
          padding: '0.6rem 0.85rem',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <strong style={{ fontSize: '0.9rem' }}>Approve parsed CLINs ({clins.length})</strong>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          {selected.size} of {clins.length} selected
        </span>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', padding: '0.45rem 0.85rem', fontSize: '0.78rem' }}>
        <button type="button" style={linkButton} onClick={selectAll} disabled={allSelected}>
          select all
        </button>
        <button type="button" style={linkButton} onClick={selectNone} disabled={selected.size === 0}>
          select none
        </button>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.4rem',
          padding: '0 0.85rem 0.85rem',
          maxHeight: '60vh',
          overflow: 'auto',
        }}
      >
        {clins.map((c, i) => {
          const isSelected = selected.has(i)
          const brands = brandsArray(c.acceptable_brands)
          return (
            <label key={i} style={isSelected ? cardSelected : card}>
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggle(i)}
                style={{ marginTop: '0.2rem', flexShrink: 0 }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: 'flex',
                    gap: '0.5rem',
                    alignItems: 'baseline',
                    flexWrap: 'wrap',
                    marginBottom: '0.2rem',
                  }}
                >
                  <strong>CLIN {c.clin_number ?? '—'}</strong>
                  <span>· {c.product_name ?? '(no product name)'}</span>
                  {c.is_service_clin && (
                    <span className="badge badge-yellow" style={{ fontSize: '0.7rem' }}>
                      service
                    </span>
                  )}
                  {c.brand_required && (
                    <span className="badge badge-red" style={{ fontSize: '0.7rem' }}>
                      brand required
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                  {c.quantity != null && (
                    <span>
                      qty {c.quantity.toLocaleString()}
                      {c.unit ? ` ${c.unit}` : ''}
                    </span>
                  )}
                  {c.product_category && <span>category: {c.product_category}</span>}
                  {brands.length > 0 && <span>brand(s): {brands.join(', ')}</span>}
                  {c.model && <span>model: {c.model}</span>}
                </div>
                {c.description && (
                  <div
                    style={{
                      fontSize: '0.78rem',
                      color: 'var(--text-muted)',
                      marginTop: '0.3rem',
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}
                    title={c.description}
                  >
                    {c.description}
                  </div>
                )}
              </div>
            </label>
          )
        })}
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.4rem',
          padding: '0.65rem 0.85rem',
          borderTop: '1px solid var(--border)',
        }}
      >
        <label htmlFor={`approval-note-${opportunityId}`} style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          Note <span style={{ fontStyle: 'italic' }}>(applied to every approved CLIN — optional)</span>
        </label>
        <textarea
          id={`approval-note-${opportunityId}`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="e.g. reviewed against pages 13–22; CLINs 28–32 are brand-required exact matches"
          style={{
            background: 'var(--bg-hover)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            padding: '0.35rem 0.5rem',
            fontFamily: 'inherit',
            fontSize: '0.8rem',
            resize: 'vertical',
          }}
        />
      </div>

      <div
        style={{
          display: 'flex',
          gap: '1rem',
          alignItems: 'center',
          padding: '0.65rem 0.85rem',
          borderTop: '1px solid var(--border)',
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          style={{
            ...submitButton,
            opacity: status === 'submitting' || selected.size === 0 ? 0.6 : 1,
            cursor: status === 'submitting' || selected.size === 0 ? 'not-allowed' : 'pointer',
          }}
          onClick={approve}
          disabled={status === 'submitting' || selected.size === 0}
        >
          {status === 'submitting'
            ? 'approving…'
            : `Approve ${selected.size} CLIN${selected.size === 1 ? '' : 's'}`}
        </button>
        {status === 'error' && (
          <span style={{ fontSize: '0.8rem', color: 'var(--red)' }}>{error}</span>
        )}
        {status === 'done' && (
          <span style={{ fontSize: '0.8rem', color: 'var(--green)' }}>approved</span>
        )}
      </div>

      {response != null && (
        <div
          style={{
            background: 'var(--bg)',
            borderTop: '1px solid var(--border)',
            padding: '0.65rem 0.85rem',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            fontSize: '0.75rem',
            lineHeight: 1.5,
            overflow: 'auto',
            maxHeight: '30vh',
          }}
        >
          <pre style={{ margin: 0, whiteSpace: 'pre' }}>{JSON.stringify(response, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}
