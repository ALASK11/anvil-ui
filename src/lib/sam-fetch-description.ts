import { stripSamHtml } from './sam-description'

const SAM_SEARCH = 'https://api.sam.gov/opportunities/v2/search'
const REQUEST_DELAY_MS = 1100
const MAX_429_RETRIES = 5

export type FetchDescriptionResult =
  | { ok: true; kind: 'text'; description: string }
  | { ok: true; kind: 'not_available' }
  | { ok: false; kind: 'rate_limited' }
  | { ok: false; kind: 'no_description' }
  | { ok: false; kind: 'error'; error: string }

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function parseRetryAfter(headers: Headers): number {
  const raw = headers.get('Retry-After') ?? '60'
  const parsed = parseInt(raw, 10)
  return Number.isFinite(parsed) ? parsed : 60
}

export function appendApiKey(url: string, apiKey: string): string {
  if (url.includes('api_key=')) return url
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}api_key=${encodeURIComponent(apiKey)}`
}

async function samGet(url: string, params?: Record<string, string>): Promise<Response | 'rate_limited' | null> {
  let retries = 0
  while (true) {
    await sleep(REQUEST_DELAY_MS)
    let target = url
    if (params && Object.keys(params).length > 0) {
      const sp = new URLSearchParams(params)
      target = `${url}${url.includes('?') ? '&' : '?'}${sp.toString()}`
    }
    let resp: Response
    try {
      resp = await fetch(target, { method: 'GET', cache: 'no-store' })
    } catch {
      return null
    }

    if (resp.status === 429) {
      retries += 1
      if (retries > MAX_429_RETRIES) return 'rate_limited'
      const waitSec = parseRetryAfter(resp.headers)
      await sleep(waitSec * 1000)
      continue
    }

    return resp
  }
}

export async function fetchDescriptionText(
  descUrl: string,
  apiKey: string,
): Promise<{ text: string } | { notAvailable: true } | { rateLimited: true } | null> {
  const fullUrl = appendApiKey(descUrl, apiKey)
  const resp = await samGet(fullUrl)
  if (resp === 'rate_limited') return { rateLimited: true }
  if (resp === null) return null
  if (resp.status === 404) return { notAvailable: true }
  if (resp.status !== 200) return null

  const content = (await resp.text()).trim()
  if (!content) return null

  const clean = stripSamHtml(content)
  if (clean.length <= 10) return null
  return { text: clean }
}

function extractDescUrlFromSearchPayload(data: unknown): string | null {
  let oppsData: unknown[] = []
  if (Array.isArray(data)) {
    oppsData = data
  } else if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>
    if (Array.isArray(record.opportunitiesData)) {
      oppsData = record.opportunitiesData
    } else if (record.noticeId) {
      oppsData = [data]
    }
  }
  if (oppsData.length === 0) return null

  const rawNotice = oppsData[0]
  if (!rawNotice || typeof rawNotice !== 'object') return null
  const notice = rawNotice as Record<string, unknown>
  const descUrl =
    (typeof notice.description === 'string' ? notice.description.trim() : '') ||
    (typeof notice.solicitationDescription === 'string'
      ? notice.solicitationDescription.trim()
      : '')

  if (!descUrl) return null
  if (!descUrl.startsWith('http')) {
    const clean = stripSamHtml(descUrl)
    return clean.length > 10 ? `__inline__:${clean}` : null
  }
  return descUrl
}

export async function resolveDescriptionUrl(
  sourceId: string,
  apiKey: string,
  existingDesc?: string | null,
): Promise<
  | { descUrl: string }
  | { inlineText: string }
  | { rateLimited: true }
  | null
> {
  if (existingDesc?.startsWith('https://api.sam.gov')) {
    return { descUrl: existingDesc }
  }

  const resp = await samGet(SAM_SEARCH, { noticeid: sourceId, api_key: apiKey })
  if (resp === 'rate_limited') return { rateLimited: true }
  if (resp === null || resp.status !== 200) return null

  let data: unknown
  try {
    data = await resp.json()
  } catch {
    return null
  }

  const resolved = extractDescUrlFromSearchPayload(data)
  if (!resolved) return null
  if (resolved.startsWith('__inline__:')) {
    return { inlineText: resolved.slice('__inline__:'.length) }
  }
  return { descUrl: resolved }
}

export async function fetchSamDescriptionForOpportunity(
  sourceId: string,
  apiKey: string,
  existingDesc?: string | null,
): Promise<FetchDescriptionResult> {
  const resolved = await resolveDescriptionUrl(sourceId, apiKey, existingDesc)
  if (!resolved) return { ok: false, kind: 'no_description' }
  if ('rateLimited' in resolved) return { ok: false, kind: 'rate_limited' }
  if ('inlineText' in resolved) return { ok: true, kind: 'text', description: resolved.inlineText }

  const fetched = await fetchDescriptionText(resolved.descUrl, apiKey)
  if (!fetched) return { ok: false, kind: 'error', error: 'SAM.gov request failed' }
  if ('rateLimited' in fetched) return { ok: false, kind: 'rate_limited' }
  if ('notAvailable' in fetched) return { ok: true, kind: 'not_available' }
  return { ok: true, kind: 'text', description: fetched.text }
}

export function isEnrichedSamDescription(desc: unknown): boolean {
  if (typeof desc !== 'string') return false
  const stripped = desc.trim()
  if (!stripped || stripped === 'not_available') return stripped === 'not_available'
  return !stripped.startsWith('https://')
}
