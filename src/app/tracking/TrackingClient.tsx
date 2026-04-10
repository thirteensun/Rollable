'use client'

import { useState } from 'react'
import Link from 'next/link'

type Tab = 'deals' | 'contacts' | 'companies'

interface Deal {
  id: string
  name: string
  value: number | null
  currency: string
  stage: string
  last_activity_at: string | null
  created_at: string
  companies: { name: string } | null
  deal_contacts: { contacts: { full_name: string } | null }[]
}

interface Contact {
  id: string
  full_name: string
  role: string | null
  email: string | null
  phone: string | null
  last_contacted_at: string | null
  companies: { name: string } | null
}

interface Company {
  id: string
  name: string
  industry: string | null
  website: string | null
}

const stageProgress: Record<string, number> = {
  lead: 10, qualified: 25, demo: 40,
  proposal: 60, negotiation: 80,
  closed_won: 100, closed_lost: 100,
}

const stageLabel: Record<string, string> = {
  lead: 'Lead', qualified: 'Qualified', demo: 'Demo',
  proposal: 'Proposal', negotiation: 'Negotiation',
  closed_won: 'Won', closed_lost: 'Lost',
}

function isAtRisk(deal: Deal): boolean {
  const ref = deal.last_activity_at ?? deal.created_at
  return (Date.now() - new Date(ref).getTime()) / 86400000 > 14
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

function timeAgo(val: string | null) {
  if (!val) return 'Never'
  const days = Math.floor((Date.now() - new Date(val).getTime()) / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return `${days}d ago`
}

const avatarPalette = [
  { bg: '#E6F1FB', color: '#185FA5' },
  { bg: '#E1F5EE', color: '#0F6E56' },
  { bg: '#FAEEDA', color: '#854F0B' },
  { bg: '#EEEDFE', color: '#534AB7' },
  { bg: '#FCEBEB', color: '#A32D2D' },
]

export default function TrackingClient({ deals, contacts, companies }: {
  deals: Deal[]
  contacts: Contact[]
  companies: Company[]
}) {
  const [tab, setTab] = useState<Tab>('deals')

  const total = deals.reduce((s, d) => s + (d.value || 0), 0)
  const atRisk = deals.filter(isAtRisk).reduce((s, d) => s + (d.value || 0), 0)
  const closing = deals.filter(d => !isAtRisk(d) && stageProgress[d.stage] >= 60).reduce((s, d) => s + (d.value || 0), 0)
  const fmt = (v: number) => v >= 1000 ? `€${(v / 1000).toFixed(0)}k` : `€${v}`

  return (
    <main style={{ background: '#f5f4f0', paddingBottom: '90px' }}>

      {/* Header */}
      <div style={{ padding: '56px 24px 16px' }}>
        <p style={{ margin: 0, fontSize: '13px', color: '#9b9890' }} suppressHydrationWarning>
          {new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
        </p>
        <p style={{ margin: '4px 0 0', fontSize: '26px', fontWeight: 500, color: '#1a1a18' }}>Pipeline</p>
      </div>

      {/* Summary — only show on deals tab */}
      {tab === 'deals' && (
        <div style={{ padding: '0 24px 16px', display: 'flex', gap: '8px' }}>
          <div style={{ flex: 1, background: 'white', borderRadius: '14px', border: '0.5px solid rgba(0,0,0,0.07)', padding: '13px 12px' }}>
            <p style={{ margin: 0, fontSize: '11px', color: '#9b9890' }}>Total</p>
            <p style={{ margin: '5px 0 0', fontSize: '19px', fontWeight: 500, color: '#1a1a18' }}>{fmt(total)}</p>
          </div>
          <div style={{ flex: 1, background: 'white', borderRadius: '14px', border: '0.5px solid rgba(0,0,0,0.07)', padding: '13px 12px' }}>
            <p style={{ margin: 0, fontSize: '11px', color: '#9b9890' }}>Closing</p>
            <p style={{ margin: '5px 0 0', fontSize: '19px', fontWeight: 500, color: '#1D9E75' }}>{fmt(closing)}</p>
          </div>
          <div style={{ flex: 1, background: atRisk > 0 ? '#FFF8F8' : 'white', borderRadius: '14px', border: atRisk > 0 ? '0.5px solid rgba(226,75,74,0.15)' : '0.5px solid rgba(0,0,0,0.07)', padding: '13px 12px' }}>
            <p style={{ margin: 0, fontSize: '11px', color: atRisk > 0 ? '#E24B4A' : '#9b9890' }}>At risk</p>
            <p style={{ margin: '5px 0 0', fontSize: '19px', fontWeight: 500, color: atRisk > 0 ? '#E24B4A' : '#1a1a18' }}>{fmt(atRisk)}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ padding: '0 24px 16px' }}>
        <div style={{ display: 'flex', background: 'white', borderRadius: 14, border: '0.5px solid rgba(0,0,0,0.07)', padding: 4, gap: 2 }}>
          {(['deals', 'contacts', 'companies'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1, padding: '8px 0', borderRadius: 10, fontSize: 13, fontWeight: 500,
                border: 'none', cursor: 'pointer',
                background: tab === t ? '#1a1a18' : 'transparent',
                color: tab === t ? 'white' : '#9b9890',
                transition: 'all 0.15s',
                textTransform: 'capitalize',
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Deals tab */}
      {tab === 'deals' && (
        <div style={{ padding: '0 24px' }}>
          <p style={{ margin: '0 0 12px', fontSize: '12px', fontWeight: 500, color: '#9b9890', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Active deals · {deals.length}
          </p>
          {deals.length === 0 ? (
            <EmptyState text="No deals yet" sub="Capture a meeting to create your first deal." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {deals.map((deal, i) => {
                const risk = isAtRisk(deal)
                const progress = stageProgress[deal.stage] || 0
                const palette = avatarPalette[i % avatarPalette.length]
                const contactName = deal.deal_contacts?.[0]?.contacts?.full_name || deal.companies?.name || ''
                const progressColor = risk ? '#E24B4A' : progress >= 60 ? '#1D9E75' : '#EF9F27'
                return (
                  <Link key={deal.id} href={`/tracking/deals/${deal.id}`} style={{ textDecoration: 'none' }}>
                    <div style={{
                      background: risk ? '#FFF8F8' : 'white', borderRadius: '16px',
                      border: risk ? '0.5px solid rgba(226,75,74,0.18)' : '0.5px solid rgba(0,0,0,0.07)',
                      padding: '14px 16px', cursor: 'pointer',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '34px', height: '34px', borderRadius: '10px',
                            background: palette.bg, display: 'flex', alignItems: 'center',
                            justifyContent: 'center', fontSize: '11px', fontWeight: 500, color: palette.color,
                          }}>
                            {getInitials(deal.name)}
                          </div>
                          <div>
                            <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: '#1a1a18' }}>{deal.name}</p>
                            <p style={{ margin: '2px 0 0', fontSize: '12px', color: risk ? '#E24B4A' : '#9b9890' }}>
                              {risk ? 'No activity in 14+ days' : contactName}
                            </p>
                          </div>
                        </div>
                        {deal.value && <p style={{ margin: 0, fontSize: '15px', fontWeight: 500, color: '#1a1a18' }}>{fmt(deal.value)}</p>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ flex: 1, height: '4px', background: '#e8e6e0', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ width: `${progress}%`, height: '100%', background: progressColor, borderRadius: '2px' }} />
                        </div>
                        <span style={{ fontSize: '11px', color: risk ? '#E24B4A' : '#9b9890', flexShrink: 0 }}>
                          {stageLabel[deal.stage]}
                        </span>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Contacts tab */}
      {tab === 'contacts' && (
        <div style={{ padding: '0 24px' }}>
          <p style={{ margin: '0 0 12px', fontSize: '12px', fontWeight: 500, color: '#9b9890', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Contacts · {contacts.length}
          </p>
          {contacts.length === 0 ? (
            <EmptyState text="No contacts yet" sub="Scan a business card or ask the AI assistant to add one." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {contacts.map((c, i) => {
                const palette = avatarPalette[i % avatarPalette.length]
                return (
                  <Link key={c.id} href={`/contacts/${c.id}`} style={{ textDecoration: 'none' }}>
                    <div style={{
                      background: 'white', borderRadius: '16px',
                      border: '0.5px solid rgba(0,0,0,0.07)',
                      padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12,
                    }}>
                      <div style={{
                        width: 38, height: 38, borderRadius: '50%',
                        background: palette.bg, display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontSize: '13px', fontWeight: 500, color: palette.color, flexShrink: 0,
                      }}>
                        {getInitials(c.full_name)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: '#1a1a18' }}>{c.full_name}</p>
                        <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#9b9890' }}>
                          {c.role ? `${c.role}${c.companies?.name ? ` · ${c.companies.name}` : ''}` : c.companies?.name ?? ''}
                        </p>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <p style={{ margin: 0, fontSize: '11px', color: '#9b9890' }}>{timeAgo(c.last_contacted_at)}</p>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Companies tab */}
      {tab === 'companies' && (
        <div style={{ padding: '0 24px' }}>
          <p style={{ margin: '0 0 12px', fontSize: '12px', fontWeight: 500, color: '#9b9890', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Companies · {companies.length}
          </p>
          {companies.length === 0 ? (
            <EmptyState text="No companies yet" sub="Companies are added automatically when you capture contacts." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {companies.map((co, i) => {
                const palette = avatarPalette[i % avatarPalette.length]
                return (
<Link key={co.id} href={`/companies/${co.id}`} style={{ textDecoration: 'none' }}>
<div style={{
                      background: 'white', borderRadius: '16px',
                      border: '0.5px solid rgba(0,0,0,0.07)',
                      padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12,
                    }}>
                      <div style={{
                        width: 38, height: 38, borderRadius: 10,
                        background: palette.bg, display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontSize: '13px', fontWeight: 500, color: palette.color, flexShrink: 0,
                      }}>
                        {getInitials(co.name)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: '#1a1a18' }}>{co.name}</p>
                        {co.industry && <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#9b9890' }}>{co.industry}</p>}
                      </div>
                      {co.website && (
                        <a href={co.website} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ color: '#9b9890' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                          </svg>
                        </a>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      )}

    </main>
  )
}

function EmptyState({ text, sub }: { text: string; sub: string }) {
  return (
    <div style={{ background: 'white', borderRadius: '18px', border: '0.5px solid rgba(0,0,0,0.07)', padding: '32px', textAlign: 'center' }}>
      <p style={{ margin: '0 0 8px', fontSize: '17px', fontWeight: 500, color: '#1a1a18' }}>{text}</p>
      <p style={{ margin: 0, fontSize: '14px', color: '#9b9890' }}>{sub}</p>
    </div>
  )
}