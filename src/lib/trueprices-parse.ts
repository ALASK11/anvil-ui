/**
 * Type module for Trueprices candidates. Safe to import from client bundles
 * (no server-only APIs, no runtime dependencies).
 *
 * The actual response parsing/orchestration lives in `trueprices.ts` because
 * getting a real product URL requires the offers endpoint (search alone does
 * NOT return URLs — verified against the backend's Python client). Keeping
 * this file type-only means the client can typecheck against candidate rows
 * without pulling in the server-side client.
 */

export interface TruepricesCandidate {
  title: string | null
  price_cents: number | null
  landed_cents: number | null
  seller: string | null
  product_url: string | null
  sku: string | null
}
