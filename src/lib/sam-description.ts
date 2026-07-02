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

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
}

/** Decode HTML entities (mirrors Python html.unescape for SAM description text). */
export function decodeSamHtmlEntities(text: string): string {
  const decoded = text.replace(/&(#x[0-9a-fA-F]+|#\d+|\w+);/g, (match, entity: string) => {
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      const code = parseInt(entity.slice(2), 16)
      return Number.isFinite(code) ? String.fromCodePoint(code) : match
    }
    if (entity.startsWith('#')) {
      const code = parseInt(entity.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : match
    }
    const named = NAMED_ENTITIES[entity.toLowerCase()]
    return named ?? match
  })
  return decoded.replace(/\u00a0/g, ' ')
}

/** Decode entities and normalize whitespace while preserving paragraph newlines. */
export function normalizeSamDescriptionText(text: string): string {
  let out = decodeSamHtmlEntities(text)
  out = out.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  out = out.replace(/[ \t\f\v\u00a0]+/g, ' ')
  out = out.replace(/[ \t]+$/gm, '')
  out = out.replace(/\n{3,}/g, '\n\n')
  return out.trim()
}

export function stripSamHtml(html: string): string {
  let text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
  return normalizeSamDescriptionText(text)
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
    text = stripSamHtml(text)
  } else {
    text = normalizeSamDescriptionText(text)
  }
  if (!text || text.length <= 10) {
    return { kind: 'empty' }
  }

  return { kind: 'text', body: capLength(text) }
}
