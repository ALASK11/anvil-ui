import type { Metadata } from 'next'
import Link from 'next/link'
import './globals.css'
import { TruepricesGlobalTester } from '@/components/TruepricesGlobalTester'

export const metadata: Metadata = {
  title: 'Anvil — Bidding Pipeline',
  description: 'Control plane for the Anvil RFP bidding pipeline',
}

const navItems = [
  { href: '/', label: 'Dashboard' },
  { section: 'Pipeline' },
  { href: '/pipeline/scraping', label: 'Scraping' },
  // TODO: re-enable once deduplication is implemented
  // { href: '/pipeline/dedup', label: 'Deduplication' },
  { href: '/pipeline/parsing', label: 'Parsing' },
  { href: '/pipeline/sourcing', label: 'Sourcing' },
  // TODO: re-enable once the ranking algorithm is implemented
  // { href: '/pipeline/ranking', label: 'Ranking' },
  { href: '/pipeline/review', label: 'Review & Submit' },
  { section: 'Data' },
  { href: '/rfp', label: 'RFPs' },
  { href: '/suppliers', label: 'Suppliers' },
  { href: '/market', label: 'Market' },
  { section: 'Admin' },
  { href: '/admin/users', label: 'Users & Access' },
  { href: '/admin/municipal-registry', label: 'Municipal Registry' },
]

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <div className="layout">
          <nav className="sidebar">
            <div className="sidebar-brand">
              <h1>Anvil</h1>
              <span>Bidding Pipeline</span>
            </div>
            <TruepricesGlobalTester />
            {navItems.map((item, i) => {
              if ('section' in item) {
                return (
                  <div key={i} className="sidebar-section">
                    {item.section}
                  </div>
                )
              }
              return (
                <Link key={item.href} href={item.href!} className="sidebar-link">
                  {item.label}
                </Link>
              )
            })}
          </nav>
          <main className="main-content">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
