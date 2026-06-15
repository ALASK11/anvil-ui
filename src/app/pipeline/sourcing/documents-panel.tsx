'use client'

import { useState, type CSSProperties } from 'react'

interface DocumentSummary {
  id: string
  filename: string | null
}

interface Props {
  documents: DocumentSummary[]
}

const viewButton: CSSProperties = {
  background: 'var(--bg-hover)',
  border: '1px solid var(--border)',
  color: 'var(--text)',
  padding: '0.15rem 0.6rem',
  borderRadius: 4,
  fontSize: '0.75rem',
  fontWeight: 500,
  cursor: 'pointer',
  minWidth: '3.5rem',
}

const activeViewButton: CSSProperties = {
  ...viewButton,
  background: 'var(--accent)',
  borderColor: 'var(--accent)',
  color: 'white',
}

const closeButton: CSSProperties = {
  ...viewButton,
  fontSize: '0.7rem',
  padding: '0.1rem 0.5rem',
  minWidth: 0,
}

export function DocumentsPanel({ documents }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const active = documents.find((d) => d.id === activeId) ?? null

  return (
    <>
      <div className="table-container" style={{ marginBottom: '1rem' }}>
        <div className="table-header">Documents ({documents.length})</div>
        {documents.length === 0 ? (
          <div style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            No documents attached to this opportunity.
          </div>
        ) : (
          <div style={{ padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {documents.map((d) => {
              const isActive = d.id === activeId
              return (
                <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <button
                    type="button"
                    onClick={() => setActiveId(isActive ? null : d.id)}
                    style={isActive ? activeViewButton : viewButton}
                    title={isActive ? 'Hide preview' : 'Preview inline'}
                  >
                    {isActive ? 'hide' : 'view'}
                  </button>
                  <a
                    href={`/api/doc?id=${d.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: 'var(--accent)',
                      fontSize: '0.9rem',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {d.filename ?? 'document'}
                  </a>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {active && (
        <div className="table-container" style={{ marginBottom: '1rem' }}>
          <div
            className="table-header"
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Previewing: {active.filename ?? 'document'}
            </span>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <a
                href={`/api/doc?id=${active.id}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--accent)', fontSize: '0.8rem' }}
              >
                open in new tab
              </a>
              <button type="button" onClick={() => setActiveId(null)} style={closeButton}>
                close
              </button>
            </div>
          </div>
          <iframe
            key={active.id}
            src={`/api/doc?id=${active.id}`}
            title={active.filename ?? 'document'}
            style={{
              width: '100%',
              height: '75vh',
              border: '1px solid var(--border)',
              borderTop: 'none',
              background: 'white',
            }}
          />
        </div>
      )}
    </>
  )
}
