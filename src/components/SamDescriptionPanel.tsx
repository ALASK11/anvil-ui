import type { CSSProperties } from 'react'
import { FetchSamDescriptionButton } from '@/components/FetchSamDescriptionButton'
import { extractSamDescription } from '@/lib/sam-description'

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

const mutedStyle: CSSProperties = {
  padding: '0 0.85rem 0.85rem',
  fontSize: '0.85rem',
  color: 'var(--text-muted)',
}

const actionStyle: CSSProperties = {
  padding: '0 0.85rem 0.85rem',
}

interface Props {
  opportunityId: string
  source: string
  extra: unknown
}

export function SamDescriptionPanel({ opportunityId, source, extra }: Props) {
  if (source !== 'sam_gov') return null

  const view = extractSamDescription(extra)
  if (!view) return null

  if (view.kind === 'empty') {
    return (
      <details open style={panelStyle}>
        <summary style={summaryStyle}>SAM.gov description</summary>
        <p style={mutedStyle}>Description not fetched yet.</p>
        <div style={actionStyle}>
          <FetchSamDescriptionButton opportunityId={opportunityId} />
        </div>
      </details>
    )
  }

  return (
    <details open style={panelStyle}>
      <summary style={summaryStyle}>SAM.gov description</summary>
      {view.kind === 'text' ? (
        <>
          <div style={bodyStyle}>{view.body}</div>
          <div style={actionStyle}>
            <FetchSamDescriptionButton opportunityId={opportunityId} refetch />
          </div>
        </>
      ) : view.kind === 'pending_enrichment' ? (
        <>
          <p style={mutedStyle}>Description not fetched yet.</p>
          <div style={actionStyle}>
            <FetchSamDescriptionButton opportunityId={opportunityId} />
          </div>
        </>
      ) : (
        <p style={mutedStyle}>
          SAM.gov has no description text for this notice.
        </p>
      )}
    </details>
  )
}
