'use client'

import Link from 'next/link'
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
}

export default function TrackingClient({ deals }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden' }}>
      {/* Top bar */}
      <div style={{
        height: 50, background: 'white',
        borderBottom: '0.5px solid rgba(0,0,0,0.07)',
        display: 'flex', alignItems: 'center',
        padding: '0 20px', gap: 12, flexShrink: 0,
      }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: '#1a1a18', flex: 1 }}>Pipeline</span>
        <Link href="/capture" style={{
          background: '#1a1a18', color: 'white', borderRadius: 10,
          padding: '7px 14px', fontSize: 12, fontWeight: 500, textDecoration: 'none',
        }}>
          + Add Deal
        </Link>
      </div>

      {/* Kanban */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <KanbanBoard deals={deals} />
      </div>
    </div>
  )
}