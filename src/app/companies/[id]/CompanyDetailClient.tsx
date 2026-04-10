'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '@/lib/supabase'

const STAGE_COLORS: Record<string, { bg: string; text: string }> = {
  lead:        { bg: 'rgba(155,152,144,0.1)', text: '#9b9890' },
  qualified:   { bg: 'rgba(59,130,246,0.1)',  text: '#3b82f6' },
  demo:        { bg: 'rgba(239,159,39,0.1)',  text: '#EF9F27' },
  proposal:    { bg: 'rgba(239,159,39,0.1)',  text: '#EF9F27' },
  negotiation: { bg: 'rgba(239,159,39,0.1)',  text: '#EF9F27' },
  closed_won:  { bg: 'rgba(29,158,117,0.1)',  text: '#1D9E75' },
  closed_lost: { bg: 'rgba(226,75,74,0.1)',   text: '#E24B4A' },
}

const STAGE_LABELS: Record<string, string> = {
  lead: 'Lead', qualified: 'Qualified', demo: 'Demo',
  proposal: 'Proposal', negotiation: 'Negotiation',
  closed_won: 'Won', closed_lost: 'Lost',
}

function formatCurrency(val?: number | null) {
  if (val == null) return ''
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val)
}

function timeAgo(val: string) {
  const diff = Date.now() - new Date(val).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

const avatarPalette = [
  { bg: '#E6F1FB', color: '#185FA5' },
  { bg: '#E1F5EE', color: '#0F6E56' },
  { bg: '#FAEEDA', color: '#854F0B' },
  { bg: '#EEEDFE', color: '#534AB7' },
  { bg: '#FCEBEB', color: '#A32D2D' },
]

export default function CompanyDetailClient({ company, contacts, deals, events }: {
  company: any
  contacts: any[]
  deals: any[]
  events: any[]
}) {
  const router = useRouter()
  const supabase = createBrowserSupabaseClient()

  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(company.name ?? '')
  const [industry, setIndustry] = useState(company.industry ?? '')
  const [website, setWebsite] = useState(company.website ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const totalValue = deals.reduce((s, d) => s + (d.value || 0), 0)

  async function saveCompany() {
    setSaving(true)
    await supabase.from('companies').update({
      name: name || company.name,
      industry: industry || null,
      website: website || null,
    }).eq('id', company.id)
    setSaving(false)
    setEditing(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div style={{ background: '#f5f4f0', minHeight: '100dvh', paddingBottom: 100 }}>

      {/* Back */}
      <div style={{ padding: '56px 20px 12px' }}>
        <button
          onClick={() => router.back()}
          style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#9b9890', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Back
        </button>
      </div>

      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Header card */}
        <div style={{ background: 'white', borderRadius: 16, border: '0.5px solid rgba(0,0,0,0.07)', padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: totalValue > 0 ? 16 : 0 }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14, background: '#1a1a18',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, fontWeight: 600, color: 'white', flexShrink: 0,
            }}>
              {getInitials(company.name ?? '?')}
            </div>
            <div style={{ flex: 1 }}>
              <h1 style={{ fontSize: 20, fontWeight: 600, color: '#1a1a18', margin: '0 0 2px' }}>{company.name}</h1>
              {company.industry && <p style={{ fontSize: 13, color: '#6b6960', margin: 0 }}>{company.industry}</p>}
              {company.website && (
                <a href={company.website} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: '#9b9890', margin: 0, textDecoration: 'none' }}>
                  {company.website.replace(/^https?:\/\//, '')}
                </a>
              )}
            </div>
          </div>

          {/* Pipeline value summary */}
          {totalValue > 0 && (
            <div style={{ display: 'flex', gap: 20 }}>
              <div>
                <p style={{ fontSize: 11, color: '#9b9890', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pipeline value</p>
                <p style={{ fontSize: 20, fontWeight: 600, color: '#1a1a18', margin: 0 }}>{formatCurrency(totalValue)}</p>
              </div>
              <div>
                <p style={{ fontSize: 11, color: '#9b9890', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Deals</p>
                <p style={{ fontSize: 20, fontWeight: 600, color: '#1a1a18', margin: 0 }}>{deals.length}</p>
              </div>
            </div>
          )}
        </div>

        {/* Details card */}
        <div style={{ background: 'white', borderRadius: 16, border: '0.5px solid rgba(0,0,0,0.07)', padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <p style={{ fontSize: 11, color: '#9b9890', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Details</p>
            <button
              onClick={() => setEditing(e => !e)}
              style={{ fontSize: 13, color: '#1a1a18', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}
            >
              {editing ? 'Cancel' : 'Edit'}
            </button>
          </div>

          {editing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input placeholder="Company name" value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
              <input placeholder="Industry" value={industry} onChange={e => setIndustry(e.target.value)} style={inputStyle} />
              <input placeholder="Website (https://...)" value={website} onChange={e => setWebsite(e.target.value)} style={inputStyle} />
              <button
                onClick={saveCompany}
                disabled={saving}
                style={{
                  marginTop: 4, padding: '12px', borderRadius: 20, background: '#1a1a18',
                  color: 'white', fontWeight: 600, fontSize: 14, border: 'none', cursor: 'pointer',
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {company.industry && <DetailRow label="Industry" value={company.industry} />}
              {company.website && <DetailRow label="Website" value={company.website.replace(/^https?:\/\//, '')} href={company.website} />}
              {saved && <p style={{ fontSize: 12, color: '#1D9E75', textAlign: 'center' }}>Saved ✓</p>}
              {!company.industry && !company.website && (
                <p style={{ fontSize: 13, color: '#9b9890', textAlign: 'center', padding: '8px 0' }}>No details yet — tap Edit to add</p>
              )}
            </div>
          )}
        </div>

        {/* Contacts */}
        {contacts.length > 0 && (
          <div style={{ background: 'white', borderRadius: 16, border: '0.5px solid rgba(0,0,0,0.07)', padding: 16 }}>
            <p style={{ fontSize: 11, color: '#9b9890', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
              People · {contacts.length}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {contacts.map((c, i) => {
                const palette = avatarPalette[i % avatarPalette.length]
                return (
                  <Link key={c.id} href={`/contacts/${c.id}`} style={{ textDecoration: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%',
                        background: palette.bg, display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontSize: 12, fontWeight: 500, color: palette.color, flexShrink: 0,
                      }}>
                        {getInitials(c.full_name ?? '?')}
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 14, fontWeight: 500, color: '#1a1a18', margin: 0 }}>{c.full_name}</p>
                        {c.role && <p style={{ fontSize: 12, color: '#6b6960', margin: 0 }}>{c.role}</p>}
                      </div>
                      <div style={{ display: 'flex', gap: 10 }}>
                        {c.email && (
                          <a href={`mailto:${c.email}`} onClick={e => e.stopPropagation()} style={{ color: '#9b9890' }}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 7 10 7 10-7"/>
                            </svg>
                          </a>
                        )}
                        {c.phone && (
                          <a href={`tel:${c.phone}`} onClick={e => e.stopPropagation()} style={{ color: '#9b9890' }}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3-8.59A2 2 0 0 1 3.62 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6 6l.92-.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                            </svg>
                          </a>
                        )}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {/* Deals */}
        {deals.length > 0 && (
          <div style={{ background: 'white', borderRadius: 16, border: '0.5px solid rgba(0,0,0,0.07)', padding: 16 }}>
            <p style={{ fontSize: 11, color: '#9b9890', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Deals</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {deals.map((d: any) => {
                const stageColor = STAGE_COLORS[d.stage] ?? STAGE_COLORS.lead
                return (
                  <Link key={d.id} href={`/tracking/deals/${d.id}`} style={{ textDecoration: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '0.5px solid rgba(0,0,0,0.05)' }}>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 500, color: '#1a1a18', margin: '0 0 3px' }}>{d.name}</p>
                        <span style={{
                          fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 20,
                          background: stageColor.bg, color: stageColor.text,
                        }}>
                          {STAGE_LABELS[d.stage] ?? d.stage}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {d.value && <p style={{ fontSize: 14, fontWeight: 500, color: '#1a1a18', margin: 0 }}>{formatCurrency(d.value)}</p>}
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                          <path d="M6 4l4 4-4 4" stroke="#c8c5be" strokeWidth="1.3" strokeLinecap="round"/>
                        </svg>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {/* Activity */}
        <div style={{ background: 'white', borderRadius: 16, border: '0.5px solid rgba(0,0,0,0.07)', padding: 16 }}>
          <p style={{ fontSize: 11, color: '#9b9890', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Activity</p>
          {events.length === 0 ? (
            <p style={{ fontSize: 14, color: '#9b9890', textAlign: 'center', padding: '12px 0' }}>No activity yet</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {events.map((ev: any, i: number) => (
                <div key={ev.id} style={{ display: 'flex', gap: 12, paddingBottom: i < events.length - 1 ? 14 : 0 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#1a1a18', marginTop: 4, flexShrink: 0 }} />
                    {i < events.length - 1 && <div style={{ width: 1, flex: 1, background: 'rgba(0,0,0,0.07)', marginTop: 4 }} />}
                  </div>
                  <div style={{ flex: 1, paddingBottom: i < events.length - 1 ? 4 : 0 }}>
                    <p style={{ fontSize: 13, color: '#1a1a18', marginBottom: 2 }}>
                      {ev.metadata?.summary ?? ev.summary ?? ev.event_type ?? 'Event'}
                    </p>
                    <p style={{ fontSize: 11, color: '#9b9890' }}>{timeAgo(ev.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

function DetailRow({ label, value, href }: { label: string; value?: string | null; href?: string }) {
  if (!value) return null
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 13, color: '#6b6960' }}>{label}</span>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" style={{ fontSize: 13, fontWeight: 500, color: '#1a1a18', textDecoration: 'none' }}>{value}</a>
      ) : (
        <span style={{ fontSize: 13, fontWeight: 500, color: '#1a1a18' }}>{value}</span>
      )}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 10,
  border: '0.5px solid rgba(0,0,0,0.12)', fontSize: 14,
  color: '#1a1a18', background: '#f5f4f0', outline: 'none',
  boxSizing: 'border-box',
}
