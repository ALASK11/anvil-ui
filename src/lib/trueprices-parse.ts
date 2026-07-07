/**
 * Pure Trueprices response parser — safe to import from both server and
 * client code (no process.env, no fetch, no Node-only APIs).
 *
 * Kept separate from src/lib/trueprices.ts so the client bundle doesn't
 * pull in server-only credentials handling.
 */

export interface TruepricesCandidate {
  title: string | null
  price_cents: number | null
  seller: string | null
  product_url: string | null
  sku: string | null
}

/**
 * Best-effort extraction. Trueprices' response key has shifted between
 * versions; try common ones in order. If nothing matches we just return [].
 * Callers that need the literal shape should use the raw response.
 */
export function extractCandidates(response: unknown): TruepricesCandidate[] {
  if (!response || typeof response !== 'object') return []
  const r = response as Record<string, unknown>
  const list =
    (r.products as unknown) ??
    (r.results as unknown) ??
    (r.hits as unknown) ??
    (r.data as unknown) ??
    (r.items as unknown)
  if (!Array.isArray(list)) return []

  const out: TruepricesCandidate[] = []
  for (const item of list) {
    if (!item || typeof item !== 'object') continue
    const i = item as Record<string, unknown>
    const merchant = (i.merchant ?? i.seller ?? i.retailer) as
      | Record<string, unknown>
      | string
      | undefined

    const title = pickString(i, ['title', 'name', 'productName'])
    const price = pickNumber(i, ['price', 'priceUsd', 'minPrice'])
    const seller =
      pickString(typeof merchant === 'object' ? merchant : undefined, ['name', 'sellerName']) ??
      (typeof merchant === 'string' ? merchant : null)
    // Trueprices returns the retailer's product page as `link` (verified
    // against real fixtures in the backend repo). It does NOT return a
    // separate merchant/homepage URL — the `merchant` object only has
    // name/rating/reviews. So both Product and Retailer cells hyperlink to
    // the same product page.
    const product_url = pickString(i, ['link', 'url', 'productUrl'])
    const sku = pickString(i, ['sku', 'id', 'productId'])

    if (price == null) continue
    out.push({
      title,
      price_cents: Math.round(price * 100),
      seller,
      product_url,
      sku,
    })
  }
  return out
}

function pickString(obj: Record<string, unknown> | undefined, keys: string[]): string | null {
  if (!obj) return null
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === 'string' && v.length > 0) return v
  }
  return null
}

function pickNumber(obj: Record<string, unknown> | undefined, keys: string[]): number | null {
  if (!obj) return null
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === 'number' && Number.isFinite(v)) return v
  }
  return null
}
