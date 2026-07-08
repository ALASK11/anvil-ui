import type { OpportunityDetail } from './db/queries/opportunities'

export function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value) return null
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
    } catch {}
  }
  return null
}

function asIdString(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'string' && value) return value
  return null
}

export interface PlanetbidsLinks {
  detail: string
  company: string | null
  bidId: string | null
  companyId: string | null
}

/**
 * SAM.gov workspace link from extra.detail_url (set at discovery).
 */
export function samGovDetailUrl(
  opp: Pick<OpportunityDetail, 'source' | 'extra'>,
): string | null {
  if (opp.source !== 'sam_gov') return null
  const extra = toRecord(opp.extra)
  if (!extra) return null
  const detail = typeof extra.detail_url === 'string' ? extra.detail_url : null
  if (!detail || !/^https?:\/\//i.test(detail)) return null
  return detail
}

export interface MunicipalDirectLinks {
  detail: string | null
  listing: string | null
  state: string | null
  slug: string | null
}

function validHttpUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const url = value.trim()
  if (!/^https?:\/\//i.test(url)) return null
  return url
}

/** Align with backend municipal _normalize_url for detail vs listing equality. */
export function normalizeMunicipalUrl(url: string): string {
  return url.trim().replace(/\/$/, '').toLowerCase().split('#')[0]
}

export function municipalUrlsEquivalent(a: string, b: string): boolean {
  return normalizeMunicipalUrl(a) === normalizeMunicipalUrl(b)
}

/**
 * Outbound links for municipal_direct opportunities (city bid detail + listing).
 */
export function municipalDirectLinks(
  opp: Pick<OpportunityDetail, 'source' | 'extra'>,
): MunicipalDirectLinks | null {
  if (opp.source !== 'municipal_direct') return null
  const extra = toRecord(opp.extra)
  if (!extra) return null

  const detail = validHttpUrl(extra.detail_url)
  let listing = validHttpUrl(extra.source_url)
  const state = typeof extra.state === 'string' && extra.state.trim() ? extra.state.trim() : null
  const slug = typeof extra.slug === 'string' && extra.slug.trim() ? extra.slug.trim() : null

  if (detail && listing && municipalUrlsEquivalent(detail, listing)) {
    listing = null
  }

  if (!detail && !listing) return null

  return { detail, listing, state, slug }
}

export function planetbidsLinks(
  opp: Pick<OpportunityDetail, 'source' | 'extra'>,
): PlanetbidsLinks | null {
  if (!opp.source || !opp.source.toLowerCase().includes('planet')) return null
  const extra = toRecord(opp.extra)
  if (!extra) return null

  const detail = typeof extra.detail_url === 'string' ? extra.detail_url : null
  if (!detail || !/^https?:\/\//i.test(detail)) return null

  const companyMatch = detail.match(/^(https?:\/\/[^/]+\/portal\/\d+)/i)
  const company = companyMatch ? companyMatch[1] : null

  return {
    detail,
    company,
    bidId: asIdString(extra.bid_id),
    companyId: asIdString(extra.company_id),
  }
}
