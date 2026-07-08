import type { CSSProperties } from 'react'
import type { MunicipalDirectLinks } from '@/lib/opportunity-links'

interface Props {
  links: MunicipalDirectLinks
}

interface LinkItem {
  href: string
  label: string
}

function buildLinkItems(links: MunicipalDirectLinks): LinkItem[] {
  const items: LinkItem[] = []

  if (links.detail) {
    items.push({ href: links.detail, label: 'View bid on city site' })
  } else if (links.listing) {
    items.push({ href: links.listing, label: 'View bid on city site' })
    return items
  }

  if (links.detail && links.listing) {
    items.push({ href: links.listing, label: 'View bid listing' })
  }

  return items
}

const calloutStyle: CSSProperties = {
  marginTop: '0.75rem',
  padding: '0.75rem 1rem',
  borderRadius: '8px',
  border: '1px solid var(--accent)',
  background: 'color-mix(in srgb, var(--accent) 12%, var(--bg))',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
}

const linkButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.4rem',
  alignSelf: 'flex-start',
  padding: '0.45rem 0.85rem',
  borderRadius: '6px',
  border: '1px solid var(--accent)',
  background: 'var(--bg)',
  color: 'var(--accent)',
  fontSize: '0.9rem',
  fontWeight: 600,
  textDecoration: 'none',
  lineHeight: 1.3,
}

function ExternalLink({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" style={linkButtonStyle}>
      <span aria-hidden="true">🔗</span>
      <span>{label}</span>
      <span aria-hidden="true" style={{ opacity: 0.85 }}>
        ↗
      </span>
    </a>
  )
}

export function MunicipalSourceLinks({ links }: Props) {
  const linkItems = buildLinkItems(links)

  return (
    <div style={calloutStyle} role="region" aria-label="Municipal bid source links">
      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
        City website
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        {linkItems.map((item) => (
          <ExternalLink key={`${item.href}:${item.label}`} href={item.href} label={item.label} />
        ))}
      </div>
    </div>
  )
}
