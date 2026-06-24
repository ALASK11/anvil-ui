'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'

interface Props {
  opportunityId: string
  initialIsProduct: boolean | null
  initialCommentary: string | null
  variant?: 'panel' | 'inline'
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

const COMMENTARY_DEBOUNCE_MS = 800

const tristateButton = (selected: boolean): CSSProperties => ({
  background: selected ? 'var(--accent)' : 'var(--bg-hover)',
  border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
  color: selected ? 'white' : 'var(--text)',
  padding: '0.2rem 0.65rem',
  borderRadius: 4,
  fontSize: '0.75rem',
  fontWeight: 500,
  cursor: 'pointer',
})

const yesButton = (selected: boolean): CSSProperties => ({
  ...tristateButton(selected),
  background: selected ? 'var(--green)' : 'var(--bg-hover)',
  borderColor: selected ? 'var(--green)' : 'var(--border)',
})

const noButton = (selected: boolean): CSSProperties => ({
  ...tristateButton(selected),
  background: selected ? 'var(--red)' : 'var(--bg-hover)',
  borderColor: selected ? 'var(--red)' : 'var(--border)',
})

function statusText(status: SaveStatus, error: string): { text: string; color: string } {
  if (status === 'saving') return { text: 'saving…', color: 'var(--text-muted)' }
  if (status === 'saved') return { text: 'saved', color: 'var(--green)' }
  if (status === 'error') return { text: error || 'save failed', color: 'var(--red)' }
  return { text: '', color: 'var(--text-muted)' }
}

export function OpportunityLabels({
  opportunityId,
  initialIsProduct,
  initialCommentary,
  variant = 'panel',
}: Props) {
  const [isProduct, setIsProduct] = useState<boolean | null>(initialIsProduct)
  const [commentary, setCommentary] = useState<string>(initialCommentary ?? '')
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [error, setError] = useState('')

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
      if (savedTimer.current) clearTimeout(savedTimer.current)
    },
    [],
  )

  async function save(updates: { is_product?: boolean | null; commentary?: string | null }) {
    setStatus('saving')
    setError('')
    try {
      const res = await fetch(`/api/opportunity/${opportunityId}/labels`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      const data = (await res.json()) as { ok: boolean; message?: string }
      if (!res.ok || !data.ok) {
        setStatus('error')
        setError(data.message ?? `HTTP ${res.status}`)
        return
      }
      setStatus('saved')
      if (savedTimer.current) clearTimeout(savedTimer.current)
      savedTimer.current = setTimeout(() => {
        setStatus((s) => (s === 'saved' ? 'idle' : s))
      }, 1500)
    } catch (e) {
      setStatus('error')
      setError(e instanceof Error ? e.message : 'Network error')
    }
  }

  function pickIsProduct(value: boolean | null) {
    setIsProduct(value)
    save({ is_product: value })
  }

  function onCommentaryChange(value: string) {
    setCommentary(value)
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      save({ commentary: value === '' ? null : value })
    }, COMMENTARY_DEBOUNCE_MS)
  }

  const s = statusText(status, error)

  if (variant === 'inline') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', minWidth: 220 }}>
        <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
          <button type="button" style={yesButton(isProduct === true)} onClick={() => pickIsProduct(true)}>
            yes
          </button>
          <button type="button" style={noButton(isProduct === false)} onClick={() => pickIsProduct(false)}>
            no
          </button>
          <button
            type="button"
            style={tristateButton(isProduct === null)}
            onClick={() => pickIsProduct(null)}
            title="Clear label"
          >
            —
          </button>
          {s.text && (
            <span style={{ fontSize: '0.7rem', color: s.color, marginLeft: '0.3rem' }}>{s.text}</span>
          )}
        </div>
        <textarea
          value={commentary}
          onChange={(e) => onCommentaryChange(e.target.value)}
          placeholder="notes…"
          rows={2}
          style={{
            background: 'var(--bg-hover)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            padding: '0.35rem 0.5rem',
            fontFamily: 'inherit',
            fontSize: '0.8rem',
            resize: 'vertical',
            minHeight: '2rem',
          }}
        />
      </div>
    )
  }

  return (
    <div className="table-container" style={{ marginBottom: '1rem' }}>
      <div
        className="table-header"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}
      >
        <span>Human Labels</span>
        {s.text && <span style={{ fontSize: '0.75rem', color: s.color, fontWeight: 400 }}>{s.text}</span>}
      </div>
      <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <label
            style={{ fontSize: '0.85rem', color: 'var(--text-muted)', minWidth: '6.5rem' }}
            id={`is-product-label-${opportunityId}`}
          >
            Is product?
          </label>
          <div
            role="radiogroup"
            aria-labelledby={`is-product-label-${opportunityId}`}
            style={{ display: 'flex', gap: '0.4rem' }}
          >
            <button
              type="button"
              role="radio"
              aria-checked={isProduct === true}
              style={yesButton(isProduct === true)}
              onClick={() => pickIsProduct(true)}
            >
              yes — real product RFQ
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={isProduct === false}
              style={noButton(isProduct === false)}
              onClick={() => pickIsProduct(false)}
            >
              no — service / not biddable
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={isProduct === null}
              style={tristateButton(isProduct === null)}
              onClick={() => pickIsProduct(null)}
              title="Clear label"
            >
              unlabeled
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <label
            htmlFor={`commentary-${opportunityId}`}
            style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}
          >
            Commentary <span style={{ fontStyle: 'italic' }}>(why this label / edge cases / caveats)</span>
          </label>
          <textarea
            id={`commentary-${opportunityId}`}
            value={commentary}
            onChange={(e) => onCommentaryChange(e.target.value)}
            placeholder="Free-text notes…"
            rows={4}
            style={{
              background: 'var(--bg-hover)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              padding: '0.5rem 0.65rem',
              fontFamily: 'inherit',
              fontSize: '0.9rem',
              resize: 'vertical',
            }}
          />
        </div>
      </div>
    </div>
  )
}
