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

/** Unescape a JSON string fragment (fallback when full JSON.parse fails). */
function unescapeJsonStringFragment(text: string): string {
  return text
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
}

/**
 * SAM noticedesc often returns {"description":"..."} JSON. Extract inner text
 * for display and before HTML stripping on fetch.
 */
export function extractDescriptionFromSamPayload(content: string): string {
  const trimmed = content.trim()
  if (!trimmed.startsWith('{')) return trimmed

  try {
    const parsed = JSON.parse(trimmed) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const inner = asTrimmedString((parsed as Record<string, unknown>).description)
      if (inner) return inner
    }
  } catch {
    // malformed JSON — try loose extraction below
  }

  const loose = trimmed.match(/^\s*\{\s*"description"\s*:\s*"([\s\S]*?)"\s*\}\s*$/)
  if (loose?.[1]) {
    return unescapeJsonStringFragment(loose[1])
  }

  return trimmed
}

function unwrapJsonDescription(raw: string): string {
  return extractDescriptionFromSamPayload(raw)
}

/** Stored JSON blob from noticedesc — allow re-fetch to replace with plain text. */
export function isSamDescriptionJsonBlob(desc: string): boolean {
  const stripped = desc.trim()
  return stripped.startsWith('{"description"') || stripped.startsWith('{ "description"')
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
function descriptionFieldToString(value: unknown): string | null {
  if (typeof value === 'string') return asTrimmedString(value)
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return asTrimmedString((value as Record<string, unknown>).description)
  }
  return null
}

export function extractSamDescription(extra: unknown): SamDescriptionView | null {
  const record = toRecord(extra)
  if (!record) return null

  const raw = descriptionFieldToString(record.description)
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
