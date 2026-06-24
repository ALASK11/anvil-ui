interface Props {
  data: unknown
  title?: string
  defaultOpen?: boolean
}

/**
 * Server-rendered collapsible JSON viewer. Uses native <details>/<summary>
 * so no JS is needed for the open/close toggle.
 */
export function ParsedJsonPanel({ data, title = 'Parsed JSON', defaultOpen = false }: Props) {
  const json = JSON.stringify(data, null, 2)

  return (
    <details
      open={defaultOpen}
      style={{
        marginBottom: '1rem',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 8,
      }}
    >
      <summary
        style={{
          padding: '0.75rem 1rem',
          fontSize: '0.95rem',
          fontWeight: 600,
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        {title}
      </summary>
      <pre
        style={{
          margin: 0,
          padding: '0.75rem 1rem 1rem',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          fontSize: '0.8rem',
          lineHeight: 1.5,
          color: 'var(--text)',
          overflow: 'auto',
          maxHeight: '60vh',
          whiteSpace: 'pre',
        }}
      >
        {json}
      </pre>
    </details>
  )
}
