import { Fragment } from 'react'

export interface DiscoveryPoint {
  date: string // YYYY-MM-DD
  with_docs: number
  without_docs: number
}

const WIDTH = 720
const HEIGHT = 280
const M = { top: 40, right: 30, bottom: 50, left: 50 }
const PLOT_W = WIDTH - M.left - M.right
const PLOT_H = HEIGHT - M.top - M.bottom

const GREEN = 'var(--green)'
const YELLOW = 'var(--yellow)'

function niceCeil(n: number): number {
  if (n <= 5) return 5
  const pow = Math.pow(10, Math.floor(Math.log10(n)))
  const step = pow / 2
  return Math.ceil(n / step) * step
}

export function DiscoveryChart({ data }: { data: DiscoveryPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="table-container">
        <div className="table-header">Discovery — last 7 days (planetbids)</div>
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          No opportunities discovered in the last 7 days.
        </div>
      </div>
    )
  }

  const peak = Math.max(1, ...data.map((d) => Math.max(d.with_docs, d.without_docs)))
  const yMax = niceCeil(peak)

  const xStep = data.length > 1 ? PLOT_W / (data.length - 1) : 0
  const x = (i: number) => M.left + i * xStep
  const y = (v: number) => M.top + PLOT_H - (v / yMax) * PLOT_H

  const yTicks = [0, 1, 2, 3, 4].map((i) => Math.round((yMax * i) / 4))
  const uniqueYTicks = Array.from(new Set(yTicks))

  const withDocsPath = data.map((d, i) => `${x(i)},${y(d.with_docs)}`).join(' ')
  const withoutDocsPath = data.map((d, i) => `${x(i)},${y(d.without_docs)}`).join(' ')

  return (
    <div className="table-container">
      <div
        className="table-header"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '1rem' }}
      >
        <span>Discovery — last 7 days (planetbids)</span>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 400 }}>
          {data.reduce((s, d) => s + d.with_docs + d.without_docs, 0).toLocaleString()} total
        </span>
      </div>
      <div style={{ padding: '0.75rem 1rem 1rem' }}>
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          style={{ width: '100%', maxWidth: WIDTH, display: 'block' }}
          role="img"
          aria-label="Opportunities discovered per day, split by whether docs were downloaded"
        >
          {uniqueYTicks.map((t) => (
            <Fragment key={`y-${t}`}>
              <line
                x1={M.left}
                x2={WIDTH - M.right}
                y1={y(t)}
                y2={y(t)}
                stroke="var(--border)"
                strokeDasharray={t === 0 ? undefined : '2 4'}
              />
              <text
                x={M.left - 8}
                y={y(t) + 4}
                textAnchor="end"
                fontSize={11}
                fill="var(--text-muted)"
              >
                {t}
              </text>
            </Fragment>
          ))}

          {data.map((d, i) => (
            <text
              key={`x-${d.date}`}
              x={x(i)}
              y={HEIGHT - 22}
              textAnchor="middle"
              fontSize={11}
              fill="var(--text-muted)"
            >
              {d.date.slice(5)}
            </text>
          ))}

          <polyline points={withoutDocsPath} fill="none" stroke={YELLOW} strokeWidth={2} />
          <polyline points={withDocsPath} fill="none" stroke={GREEN} strokeWidth={2} />

          {data.map((d, i) => (
            <Fragment key={`pt-${d.date}`}>
              <circle cx={x(i)} cy={y(d.without_docs)} r={3.5} fill={YELLOW} />
              <circle cx={x(i)} cy={y(d.with_docs)} r={3.5} fill={GREEN} />
            </Fragment>
          ))}

          <g transform={`translate(${M.left}, 12)`}>
            <circle cx={6} cy={6} r={4} fill={GREEN} />
            <text x={16} y={10} fontSize={12} fill="var(--text)">
              With docs downloaded
            </text>
            <circle cx={186} cy={6} r={4} fill={YELLOW} />
            <text x={196} y={10} fontSize={12} fill="var(--text)">
              Without
            </text>
          </g>
        </svg>
      </div>
    </div>
  )
}
