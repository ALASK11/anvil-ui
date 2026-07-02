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
 * Build out-bound links to PlanetBids for an opportunity whose source is
 * PlanetBids. Returns null for non-PlanetBids opps or when `extra.detail_url`
 * is missing/malformed. Company portal URL is derived by trimming the
 * /bo/bo-detail/<id> suffix from detail_url.
 */
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
