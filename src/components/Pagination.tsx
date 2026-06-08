import Link from 'next/link'

interface PaginationProps {
  currentIndex: number
  hasNext: boolean
  totalCount?: number
  limit: number
  searchParams: Record<string, string | string[] | undefined>
}

export default function Pagination({
  currentIndex,
  hasNext,
  totalCount,
  limit,
  searchParams,
}: PaginationProps) {
  // Helper to construct link URL preserving other params
  const getPageUrl = (index: number) => {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(searchParams)) {
      if (key !== 'index' && value !== undefined) {
        if (Array.isArray(value)) {
          value.forEach((val) => params.append(key, val))
        } else {
          params.set(key, value)
        }
      }
    }
    if (index > 0) {
      params.set('index', String(index))
    }
    const qs = params.toString()
    return qs ? `?${qs}` : '?'
  }

  const hasPrev = currentIndex > 0
  const currentPageNum = currentIndex + 1

  let infoText = `Page ${currentPageNum}`
  if (totalCount !== undefined) {
    const totalPages = Math.ceil(totalCount / limit)
    infoText = `Page ${currentPageNum} of ${Math.max(1, totalPages)} (${totalCount.toLocaleString()} total)`
  }

  return (
    <div className="pagination">
      <div className="pagination-info">{infoText}</div>
      <div className="pagination-buttons">
        <Link
          href={getPageUrl(currentIndex - 1)}
          className={`pagination-btn ${!hasPrev ? 'disabled' : ''}`}
          aria-disabled={!hasPrev}
          tabIndex={!hasPrev ? -1 : undefined}
        >
          &larr; Previous
        </Link>
        <Link
          href={getPageUrl(currentIndex + 1)}
          className={`pagination-btn ${!hasNext ? 'disabled' : ''}`}
          aria-disabled={!hasNext}
          tabIndex={!hasNext ? -1 : undefined}
        >
          Next &rarr;
        </Link>
      </div>
    </div>
  )
}
