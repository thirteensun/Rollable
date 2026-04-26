'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import KanbanBoard from './KanbanBoard'

type Deal = {
  id: string
  name: string
  stage: string
  value?: number
  company_name?: string
  days_since_activity: number
  owner_initials?: string
}

type Props = {
  deals: Deal[]
  contacts: any[]
  companies: any[]
  events: any[]
  stageTemplate?: string
}

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    setIsDesktop(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return isDesktop
}

export default function TrackingClient({ deals, stageTemplate }: Props) {
  const isDesktop = useIsDesktop()

  // Mobile: redirect hint — the separate pages now handle deals/contacts/companies
  if (!isDesktop) {
    return (
      <div style={{ paddingTop: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h1 style={{ fontSize: 22, fontWeight: 500, color: '#1a1a18', margin: '0 0 8px' }}>Pipeline</h1>
        {[
          { href: '/deals',     label: 'Deals',     sub: 'View and manage your deals',           icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg> },
          { href: '/contacts',  label: 'Contacts',  sub: 'Your people and relationships',        icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5"/><path d="M4 20c0-4.4 3.6-7 8-7s8 2.6 8 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
          { href: '/companies', label: 'Companies', sub: 'Accounts and organisations',           icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="2" y="7" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" stroke="currentColor" strokeWidth="1.5"/></svg> },
        ].map(item => (
          <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
            <div style={{
              background: 'white', border: '0.5px solid rgba(0,0,0,0.07)',
              borderRadius: 16, padding: '16px 18px',
              display: 'flex', alignItems: 'center', gap: 14,
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}>
              <div style={{ color: '#6b6960', flexShrink: 0 }}>{item.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#1a1a18' }}>{item.label}</div>
                <div style={{ fontSize: 12, color: '#9b9890', marginTop: 2 }}>{item.sub}</div>
              </div>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M6 4l4 4-4 4" stroke="#c8c5be" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
            </div>
          </Link>
        ))}
      </div>
    )
  }

  // Desktop: full Kanban — unchanged
  return (
    <>
      <div style={{ height: '100vh' }} />
      <div style={{
        position: 'fixed', top: 0, left: 210, right: 0, bottom: 0,
        background: '#f5f4f0', display: 'flex', flexDirection: 'column', zIndex: 10,
      }}>
        <div style={{
          height: 52, background: 'white', borderBottom: '0.5px solid rgba(0,0,0,0.07)',
          display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12, flexShrink: 0,
        }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: '#1a1a18', flex: 1 }}>Pipeline</span>
          <Link href="/capture" style={{
            background: '#1a1a18', color: 'white', borderRadius: 10,
            padding: '7px 14px', fontSize: 12, fontWeight: 500, textDecoration: 'none',
          }}>
            + Add Deal
          </Link>
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <KanbanBoard deals={deals} stageTemplate={stageTemplate} />
        </div>
      </div>
    </>
  )
}