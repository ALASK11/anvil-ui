import Link from 'next/link'
import { getPlanetbidsDiscoveryLast7Days } from '@/lib/db/queries/dashboard'
import { listOpportunities } from '@/lib/db/queries/opportunities'
import { DiscoveryChart, type DiscoveryPoint } from '@/components/DiscoveryChart'
import { RfpListTable } from '@/components/RfpListTable'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function DashboardPage(props: PageProps) {
  const searchParams = await props.searchParams
  const flag = (key: string): boolean => {
    const v = searchParams[key]
    const value = Array.isArray(v) ? v[0] : v
    return value === 'true' || value === '1'
  }
  const noClin = flag('no_clin')

  const [discoveryRows, digestRows] = await Promise.all([
    getPlanetbidsDiscoveryLast7Days(),
    listOpportunities({
      limit: 500,
      parsedOnly: true,
      hasClin: !noClin,
      withoutClin: noClin,
      hideServices: true,
      discoveredYesterday: true,
    }),
  ])

  // Pad to seven UTC calendar days so the X axis is continuous.
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const dates: string[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today)
    d.setUTCDate(today.getUTCDate() - i)
    dates.push(d.toISOString().slice(0, 10))
  }

  const byDate = new Map(discoveryRows.map((r) => [r.discovered_date, r]))
  const chartData: DiscoveryPoint[] = dates.map((date) => {
    const row = byDate.get(date)
    return {
      date,
      with_docs: row?.with_downloaded_docs ?? 0,
      without_docs: row?.without_downloaded_docs ?? 0,
    }
  })

  const digestTitle = noClin
    ? `Digest — Yesterday's parsed RFPs with no CLINs (${digestRows.length})`
    : `Digest — Yesterday's most attractive RFPs (${digestRows.length})`

  const digestEmpty = noClin
    ? 'No parsed RFPs without CLINs discovered yesterday.'
    : 'No parsed RFPs with CLINs discovered yesterday.'

  return (
    <>
      <div className="page-header">
        <h1>Dashboard</h1>
      </div>

      <DiscoveryChart data={chartData} />

      <div className="filter-bar" style={{ marginTop: '1rem' }}>
        <span className="filter-bar-label">Digest filter</span>
        <Link href={noClin ? '/' : '/?no_clin=true'} className={`filter-chip${noClin ? ' active' : ''}`}>
          <span className="filter-chip-dot" />
          No parsed CLIN docs
        </Link>
      </div>

      <RfpListTable rows={digestRows} title={digestTitle} emptyMessage={digestEmpty} />
    </>
  )
}
