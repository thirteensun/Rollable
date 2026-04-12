'use client'

import Link from 'next/link'
import { useRef, useState, useEffect } from 'react'
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

type Contact = {
  id: string
  full_name: string
  role?: string
  company_name?: string
  created_at: string
}

type Company = {
  id: string
  name: string
  industry?: string
  created_at: string
}

type Props = {
  deals: Deal[]
  contacts: Contact[]
  companies: Company[]
  events: any[]
}

type Tab = 'deals' | 'contacts' | 'companies'

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

const STAGE_ORDER = ['lead','qualified','demo','proposal','negotiation','closed_won','closed_lost']
const STAGE_LABELS: Record<string, string> = {
  lead: 'Lead', qualified: 'Qualified', demo: 'Demo',
  proposal: 'Proposal', negotiation: 'Negotiation',
  closed_won: 'Won', closed_lost: 'Lost',
}

function formatValue(v?: number) {
  if (!v) return '—'
  if (v >= 1000) return `$${(v / 1000).toFixed(0)}k`
  return `$${v}`
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const d = Math.floor(diff / 86400000)
  if (d === 0) return 'Today'
  if (d === 1) return 'Yesterday'
  return `${d}d ago`
}

function DealsList({ deals }: { deals: Deal[] }) {
  const sorted = [...deals].sort((a, b) =>
    STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage)
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {sorted.map(deal => {
        const atRisk = deal.days_since_activity >= 14 &&
          deal.stage !== 'closed_won' && deal.stage !== 'closed_lost'
        return (
          <Link key={deal.id} href={`/tracking/deals/${deal.id}`} style={{ textDecoration: 'none' }}>
            <div style={{
              background: 'white',
              border: '0.5px solid rgba(0,0,0,0.07)',
              borderLeft: atRisk ? '2.5px solid #EF9F27' : undefined,
              borderRadius: 16, padding: '14px 16px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#1a1a18', marginBottom: 2 }}>{deal.name}</div>
                  {deal.company_name && <div style={{ fontSize: 12, color: '#9b9890' }}>{deal.company_name}</div>}
                </div>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#1a1a18' }}>{formatValue(deal.value)}</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 500, background: '#f5f4f0', color: '#6b6960', padding: '3px 8px', borderRadius: 6 }}>
                  {STAGE_LABELS[deal.stage] ?? deal.stage}
                </span>
                {atRisk && <span style={{ fontSize: 11, color: '#EF9F27' }}>{deal.days_since_activity}d no activity</span>}
              </div>
            </div>
          </Link>
        )
      })}
    </div>
  )
}

function ContactsList({ contacts }: { contacts: Contact[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {contacts.map(c => (
        <Link key={c.id} href={`/contacts/${c.id}`} style={{ textDecoration: 'none' }}>
          <div style={{ background: 'white', border: '0.5px solid rgba(0,0,0,0.07)', borderRadius: 16, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#1a1a18', color: 'white', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {c.full_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#1a1a18', marginBottom: 2 }}>{c.full_name}</div>
              <div style={{ fontSize: 12, color: '#9b9890' }}>{[c.role, c.company_name].filter(Boolean).join(' · ')}</div>
            </div>
            <div style={{ fontSize: 11, color: '#9b9890' }}>{timeAgo(c.created_at)}</div>
          </div>
        </Link>
      ))}
    </div>
  )
}

function CompaniesList({ companies }: { companies: Company[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {companies.map(c => (
        <Link key={c.id} href={`/companies/${c.id}`} style={{ textDecoration: 'none' }}>
          <div style={{ background: 'white', border: '0.5px solid rgba(0,0,0,0.07)', borderRadius: 16, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: '#f5f4f0', border: '0.5px solid rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 18 }}>🏢</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#1a1a18', marginBottom: 2 }}>{c.name}</div>
              {c.industry && <div style={{ fontSize: 12, color: '#9b9890' }}>{c.industry}</div>}
            </div>
            <div style={{ fontSize: 11, color: '#9b9890' }}>{timeAgo(c.created_at)}</div>
          </div>
        </Link>
      ))}
    </div>
  )
}

const TABS: { key: Tab; label: string }[] = [
  { key: 'deals', label: 'Deals' },
  { key: 'contacts', label: 'Contacts' },
  { key: 'companies', label: 'Companies' },
]

export default function TrackingClient({ deals, contacts, companies }: Props) {
  const isDesktop = useIsDesktop()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [tab, setTab] = useState<Tab>('deals')
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)

  function checkScroll() {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 0)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    checkScroll()
    el.addEventListener('scroll', checkScroll)
    window.addEventListener('resize', checkScroll)
    return () => {
      el.removeEventListener('scroll', checkScroll)
      window.removeEventListener('resize', checkScroll)
    }
  }, [isDesktop])

  function scrollKanban(amount: number) {
    scrollRef.current?.scrollBy({ left: amount, behavior: 'smooth' })
  }

  // ── Desktop: Kanban ──────────────────────────────────────────────────────
  if (isDesktop) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{
          height: 50, background: 'white',
          borderBottom: '0.5px solid rgba(0,0,0,0.07)',
          display: 'flex', alignItems: 'center',
          padding: '0 20px', gap: 12, flexShrink: 0,
        }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: '#1a1a18', flex: 1 }}>Pipeline</span>
          
          <Link href="/capture" style={{ background: '#1a1a18', color: 'white', borderRadius: 10, padding: '7px 14px', fontSize: 12, fontWeight: 500, textDecoration: 'none' }}>
            + Add Deal
          </Link>
        </div>
        <div ref={scrollRef} style={{ overflowX: 'auto', overflowY: 'hidden', flex: 1 }} className="no-scrollbar">
          <KanbanBoard deals={deals} />
        </div>
      </div>
    )
  }

  // ── Mobile: tabbed list ──────────────────────────────────────────────────
  return (
    <div style={{ paddingTop: 16 }}>
      <div style={{ paddingBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 500, color: '#1a1a18', margin: 0 }}>Tracking</h1>
      </div>
      <div style={{ display: 'flex', gap: 4, paddingBottom: 12, overflowX: 'auto' }} className="no-scrollbar">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            background: tab === t.key ? '#1a1a18' : 'white',
            color: tab === t.key ? 'white' : '#6b6960',
            border: '0.5px solid rgba(0,0,0,0.07)',
            borderRadius: 20, padding: '6px 14px',
            fontSize: 13, fontWeight: tab === t.key ? 500 : 400,
            cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
          }}>{t.label}</button>
        ))}
      </div>
      {tab === 'deals'     && <DealsList deals={deals} />}
      {tab === 'contacts'  && <ContactsList contacts={contacts} />}
      {tab === 'companies' && <CompaniesList companies={companies} />}
    </div>
  )
}