'use client'

import { useMemo, useState, type CSSProperties } from 'react'
import { ClinApprovalForm, type ParsedClin } from './ClinApprovalForm'

function extractClins(response: unknown): ParsedClin[] {
  if (!response || typeof response !== 'object') return []
  const r = response as Record<string, unknown>
  const result = r.result
  if (!result || typeof result !== 'object') return []
  const clins = (result as Record<string, unknown>).clins
  return Array.isArray(clins) ? (clins as ParsedClin[]) : []
}

interface DocSummary {
  id: string
  filename: string | null
}

interface Props {
  opportunityId: string
  documents: DocSummary[]
  defaultPreamble?: string
}

const DEFAULT_PREAMBLE = `You are analyzing government solicitation documents (RFP / RFQ / IFB).
Extract structured information from the provided pages and return JSON matching
the schema below. Be precise about numbers, dates, and named brands. If a field
is not present in the supplied pages, use null rather than guessing. Emit only
the JSON object — no markdown fences, no commentary.

Schema (all fields optional — use null if unknown):
{
  "product_name": string,           // canonical product name (e.g. "Office Chair, Ergonomic")
  "product_category": string,       // MUST be one of these exact values (pick the closest match):
                                    // "office furniture", "office supplies", … "other"
  "quantity": integer,
  "unit": string,                   // EA, CS, LB, GL, SET, KT, etc.
  "brand": string,                  // primary brand from dominant product CLIN (null if "or equal")
  "acceptable_brands": [],          // ALL named brands/models from the primary product CLIN
  "brand_required": boolean,        // false = "or approved equal" acceptable; true = brand-name-only
  "model": string,
  "specs": string,                  // key technical specs, 1-3 sentences max
  "delivery_location": string,
  "estimated_value_cents": integer,
  "delivery_days": integer,         // calendar days from award to required delivery (ignore bid deadline)
  "eval_method": string,            // "lpta"|"best_value"|"sealed_bid"|"lowest_price"|null
  "has_service_clin": boolean,
  "restriction_flags": [],          // "itar","ear_dual_use","buy_american","taa_required","hazmat",
                                    //  "firearms","explosives","alcohol","tobacco",
                                    //  "controlled_substance","prescription_medical","radioactive","pesticide"
  "nte_unit_price_cents": integer,  // explicit per-unit ceiling only
  "stated_unit_price_cents": integer,
  "parse_confidence": float,        // 0.0-1.0
  "clins": [                        // ONLY if explicit CLIN/line-item structure present
    {
      "clin_number": string, "description": string, "product_name": string,
      "product_category": string, "quantity": integer, "unit": string,
      "acceptable_brands": [], "brand_required": boolean, "model": string,
      "specs": string, "is_service_clin": boolean, "service_clin_type": string
    }
  ]                                 // [] for DIBBS single-NSN / title-only / no explicit CLINs
}`

const inputStyle: CSSProperties = {
  background: 'var(--bg-hover)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  color: 'var(--text)',
  padding: '0.3rem 0.5rem',
  fontSize: '0.8rem',
  fontFamily: 'inherit',
  width: '14rem',
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

const toggleButton: CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--accent)',
  fontSize: '0.8rem',
  cursor: 'pointer',
  padding: 0,
}

const textarea: CSSProperties = {
  background: 'var(--bg-hover)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  padding: '0.5rem 0.65rem',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  fontSize: '0.8rem',
  resize: 'vertical',
}

export function PdfParseTool({ opportunityId, documents, defaultPreamble }: Props) {
  const [open, setOpen] = useState(false)
  const [pageRanges, setPageRanges] = useState<Record<string, string>>({})
  const [preamble, setPreamble] = useState(defaultPreamble ?? DEFAULT_PREAMBLE)
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [response, setResponse] = useState<unknown>(null)
  const [error, setError] = useState('')

  const selectedDocs = useMemo(
    () =>
      Object.entries(pageRanges)
        .filter(([, range]) => range.trim() !== '')
        .map(([docId, range]) => ({ document_id: docId, page_ranges: range.trim() })),
    [pageRanges],
  )

  async function runParse() {
    if (selectedDocs.length === 0) return
    setStatus('loading')
    setError('')
    setResponse(null)
    try {
      const res = await fetch('/api/parse-pdfs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opportunity_id: opportunityId,
          documents: selectedDocs,
          preamble,
        }),
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

  return (
    <div className="table-container" style={{ marginBottom: '1rem' }}>
      <div
        className="table-header"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}
      >
        <span>Parse PDF pages with Gemini</span>
        <button type="button" style={toggleButton} onClick={() => setOpen((v) => !v)}>
          {open ? 'hide' : 'show'}
        </button>
      </div>

      {open && (
        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {documents.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              No documents to parse for this opportunity.
            </div>
          ) : (
            <div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                Enter page ranges per document (e.g. <code>1-3, 5, 7-10</code>). Leave blank to skip.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {documents.map((d) => (
                  <div
                    key={d.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.75rem',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.85rem',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        flex: 1,
                      }}
                      title={d.filename ?? undefined}
                    >
                      {d.filename ?? 'document'}
                    </span>
                    <input
                      type="text"
                      style={inputStyle}
                      placeholder="e.g. 1-3, 5"
                      value={pageRanges[d.id] ?? ''}
                      onChange={(e) =>
                        setPageRanges((prev) => ({ ...prev, [d.id]: e.target.value }))
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Preamble{' '}
              <span style={{ fontStyle: 'italic' }}>
                (framing prompt sent to Gemini before the PDF content)
              </span>
            </label>
            <textarea
              value={preamble}
              onChange={(e) => setPreamble(e.target.value)}
              rows={8}
              style={textarea}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              style={{
                ...submitButton,
                opacity: status === 'loading' || selectedDocs.length === 0 ? 0.6 : 1,
                cursor:
                  status === 'loading' || selectedDocs.length === 0 ? 'not-allowed' : 'pointer',
              }}
              onClick={runParse}
              disabled={status === 'loading' || selectedDocs.length === 0}
            >
              {status === 'loading' ? 'parsing…' : 'Parse with Gemini'}
            </button>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {selectedDocs.length === 0
                ? 'enter page ranges to enable'
                : `${selectedDocs.length} document${selectedDocs.length === 1 ? '' : 's'} selected`}
            </span>
            {status === 'error' && (
              <span style={{ fontSize: '0.8rem', color: 'var(--red)' }}>{error}</span>
            )}
            {status === 'done' && (
              <span style={{ fontSize: '0.8rem', color: 'var(--green)' }}>done</span>
            )}
          </div>

          {response != null && (
            <>
              {(() => {
                const parsedClins = extractClins(response)
                return parsedClins.length > 0 ? (
                  <ClinApprovalForm opportunityId={opportunityId} clins={parsedClins} />
                ) : null
              })()}
              <details
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                }}
              >
                <summary
                  style={{
                    padding: '0.55rem 0.75rem',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    userSelect: 'none',
                    color: 'var(--text-muted)',
                  }}
                >
                  Raw response JSON
                </summary>
                <pre
                  style={{
                    margin: 0,
                    padding: '0 0.75rem 0.75rem',
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                    fontSize: '0.78rem',
                    lineHeight: 1.5,
                    overflow: 'auto',
                    maxHeight: '50vh',
                    whiteSpace: 'pre',
                  }}
                >
                  {JSON.stringify(response, null, 2)}
                </pre>
              </details>
            </>
          )}
        </div>
      )}
    </div>
  )
}
