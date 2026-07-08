import type { CSSProperties } from 'react'
import { extractMunicipalDescription } from '@/lib/municipal-description'

const panelStyle: CSSProperties = {
  marginBottom: '1rem',
  border: '1px solid var(--border)',
  borderRadius: '6px',
  background: 'var(--bg-hover)',
}

const summaryStyle: CSSProperties = {
  padding: '0.65rem 0.85rem',
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: '0.9rem',
}

const bodyStyle: CSSProperties = {
  padding: '0 0.85rem 0.85rem',
  fontSize: '0.9rem',
  lineHeight: 1.55,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
}

interface Props {
  extra: unknown
}

export function MunicipalDescriptionPanel({ extra }: Props) {
  const body = extractMunicipalDescription(extra)
  if (!body) return null

  return (
    <details open style={panelStyle}>
      <summary style={summaryStyle}>Listing description</summary>
      <div style={bodyStyle}>{body}</div>
    </details>
  )
}
