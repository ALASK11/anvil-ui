import { getPool } from '../pool'

export interface DocumentLookup {
  id: string
  filename: string | null
  gcs_url: string | null
}

/**
 * Look up an opportunity_document by id. Used by the /api/doc proxy route
 * to translate an opaque doc id into the gs:// URL it should stream from.
 * Filters out recalled / superseded docs so a stale link can't surface
 * withdrawn content.
 */
export async function getDocumentForProxy(id: string): Promise<DocumentLookup | null> {
  const pool = await getPool()
  const { rows } = await pool.query<DocumentLookup>(
    `SELECT id, filename, gcs_url
     FROM opportunity_documents
     WHERE id = $1
       AND recalled_at IS NULL
       AND superseded_by IS NULL`,
    [id],
  )
  return rows[0] ?? null
}
