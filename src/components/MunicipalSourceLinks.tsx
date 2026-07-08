import type { MunicipalDirectLinks } from '@/lib/opportunity-links'

const linkStyle = { color: 'var(--accent)' } as const

interface Props {
  links: MunicipalDirectLinks
}

function normalizeUrl(url: string): string {
  return url.replace(/\/$/, '')
}

export function MunicipalSourceLinks({ links }: Props) {
  const showListing =
    links.listing &&
    (!links.detail || normalizeUrl(links.listing) !== normalizeUrl(links.detail))

  return (
    <p style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
      Municipal:{' '}
      {links.detail ? (
        <a href={links.detail} target="_blank" rel="noopener noreferrer" style={linkStyle}>
          View bid on city site
        </a>
      ) : links.listing ? (
        <a href={links.listing} target="_blank" rel="noopener noreferrer" style={linkStyle}>
          View bid listing
        </a>
      ) : null}
      {showListing && links.listing && (
        <>
          {' · '}
          <a href={links.listing} target="_blank" rel="noopener noreferrer" style={linkStyle}>
            View bid listing
          </a>
        </>
      )}
    </p>
  )
}
