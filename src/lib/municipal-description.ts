import { toRecord } from './opportunity-links'

const MAX_CHARS = 8000

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

/** Strip simple HTML tags for display when listing text includes markup. */
function stripSimpleHtml(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function capLength(text: string): string {
  if (text.length <= MAX_CHARS) return text
  return `${text.slice(0, MAX_CHARS)} [truncated]`
}

/**
 * Extract listing description from municipal_direct opportunities.extra.
 * Returns null when no usable description text exists.
 */
export function extractMunicipalDescription(extra: unknown): string | null {
  const record = toRecord(extra)
  if (!record) return null

  const raw = asTrimmedString(record.description)
  if (!raw) return null

  let text = raw
  if (text.includes('<') && text.includes('>')) {
    text = stripSimpleHtml(text)
  }
  if (!text || text.length <= 10) return null

  return capLength(text)
}
