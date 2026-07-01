import { toRecord } from './opportunity-links'

const MAX_CHARS = 8000

export type SamDescriptionView =
  | { kind: 'text'; body: string }
  | { kind: 'pending_enrichment' }
  | { kind: 'not_available' }
  | { kind: 'empty' }

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

function unwrapJsonDescription(raw: string): string {
  if (!raw.startsWith('{')) return raw
  try {
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const inner = asTrimmedString((parsed as Record<string, unknown>).description)
      if (inner) return inner
    }
  } catch {
    // keep raw string
  }
  return raw
}

function stripHtml(html: string): string {
  const text = html.replace(/<[^>]+>/g, ' ')
  return text.replace(/\s+/g, ' ').trim()
}

function capLength(text: string): string {
  if (text.length <= MAX_CHARS) return text
  return `${text.slice(0, MAX_CHARS)} [truncated]`
}

/**
 * Extract SAM.gov solicitation description from opportunities.extra.
 * Returns null when extra has no description field at all (hide panel).
 */
export function extractSamDescription(extra: unknown): SamDescriptionView | null {
  const record = toRecord(extra)
  if (!record) return null

  const raw = asTrimmedString(record.description)
  if (!raw) return { kind: 'empty' }

  if (raw === 'not_available') {
    return { kind: 'not_available' }
  }

  if (raw.startsWith('https://api.sam.gov')) {
    return { kind: 'pending_enrichment' }
  }

  let text = unwrapJsonDescription(raw)
  if (text.includes('<') && text.includes('>')) {
    text = stripHtml(text)
  }
  if (!text || text.length <= 10) {
    return { kind: 'empty' }
  }

  return { kind: 'text', body: capLength(text) }
}
