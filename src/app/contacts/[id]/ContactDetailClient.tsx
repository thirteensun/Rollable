'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '@/lib/supabase'
import FieldGrid from '@/components/FieldGrid'
import { CONTACT_FIELDS } from '@/lib/entity-fields'

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

const PRIORITY_COLOR: Record<string, string> = {
  high: '#E24B4A', medium: '#EF9F27', low: '#9b9890',
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
  return `${Math.floor(hrs / 24)}d ago`
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

interface Props {
  contact: any
  events: any[]
  deals: any[]
  tasks: any[]
  visibleFields: string[]
}

export default function ContactDetailClient({ contact, events, deals, tasks, visibleFields }: Props) {
  const router = useRouter()
  const supabase = createBrowserSupabaseClient()

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Record<string, any>>(() =>
    Object.fromEntries(CONTACT_FIELDS.map(f => [f.key, contact[f.key] ?? null]))
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const timeline = [
    ...events.map(e => ({ ...e, _type: 'event' as const })),
    ...tasks.map(t => ({ ...t, _type: 'task' as const })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  function startEdit() {
    setDraft(Object.fromEntries(CONTACT_FIELDS.map(f => [f.key, contact[f.key] ?? null])))
    setEditing(true)
    setError('')
  }

  function cancelEdit() {
    setEditing(false)
    setError('')
  }

  async function saveContact() {
    setSaving(true)
    setError('')

    // Only persist visible fields — hidden fields stay untouched in DB
    const update: Record<string, any> = {}
    for (const key of visibleFields) {
      if (key in draft) update[key] = draft[key]
    }

    const { error: err } = await supabase
      .from('contacts')
      .update(update)
      .eq('id', contact.id)

    setSaving(false)

    if (err) {
      setError(err.message)
      return
    }

    setEditing(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    router.refresh()
  }

  return (
    <div style={{ background: '#f5f4f0', minHeight: '100dvh', paddingBottom: 100 }}>
      <div style={{ padding: '56px 20px 12px' }}>
        <button onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#9b9890', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          Back
        </button>
      </div>

      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Header */}
        <div style={{ background: 'white', borderRadius: 16, border: '0.5px solid rgba(0,0,0,0.07)', padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#1a1a18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 600, color: 'white', flexShrink: 0 }}>
              {getInitials(contact.full_name ?? '?')}
            </div>
            <div style={{ flex: 1 }}>
              <h1 style={{ fontSize: 20, fontWeight: 600, color: '#1a1a18', margin: '0 0 2px' }}>{contact.full_name}</h1>
              {contact.role && <p style={{ fontSize: 13, color: '#6b6960', margin: 0 }}>{contact.role}</p>}
              {contact.companies?.name && (
                <Link href={`/companies/${contact.companies.id}`} style={{ fontSize: 13, color: '#9b9890', textDecoration: 'none' }}>
                  {contact.companies.name}
                </Link>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <ActionButton
              href={contact.email ? `mailto:${contact.email}` : undefined}
              label="Email"
              icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 7 10 7 10-7"/></svg>}
            />
            <ActionButton
              href={contact.phone ? `tel:${contact.phone}` : undefined}
              label="Call"
              icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3-8.59A2 2 0 0 1 3.62 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6 6l.92-.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>}
            />
            <ActionButton
              href={contact.phone ? `https://wa.me/${contact.phone.replace(/\D/g, '')}` : undefined}
              externalLink
              label="WhatsApp"
              icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>}
            />
          </div>
        </div>

        {/* Field grid (replaces hardcoded Details block) */}
        <div style={{ background: 'white', borderRadius: 16, border: '0.5px solid rgba(0,0,0,0.07)', padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <p style={{ fontSize: 11, color: '#9b9890', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
              Contact info
            </p>
            {!editing ? (
              <button onClick={startEdit} style={editBtn}>Edit</button>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={cancelEdit} style={editBtn}>Cancel</button>
                <button onClick={saveContact} disabled={saving} style={{ ...editBtn, color: '#1a1a18', fontWeight: 600, opacity: saving ? 0.5 : 1 }}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            )}
          </div>

          <FieldGrid
            entity="contacts"
            values={editing ? draft : contact}
            visibleFields={visibleFields}
            editing={editing}
            onChange={(key, v) => setDraft(d => ({ ...d, [key]: v }))}
          />

          {error && <p style={{ fontSize: 12, color: '#E24B4A', marginTop: 10 }}>{error}</p>}
          {saved && !editing && <p style={{ fontSize: 12, color: '#1D9E75', textAlign: 'center', marginTop: 10 }}>Saved ✓</p>}
        </div>

        {/* Deals */}
        {deals.length > 0 && (
          <div style={{ background: 'white', borderRadius: 16, border: '0.5px solid rgba(0,0,0,0.07)', padding: 16 }}>
            <p style={{ fontSize: 11, color: '#9b9890', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Deals</p>
            {deals.map((d: any) => {
              const sc = STAGE_COLORS[d.stage] ?? STAGE_COLORS.lead
              return (
                <Link key={d.id} href={`/deals/${d.id}`} style={{ textDecoration: 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '0.5px solid rgba(0,0,0,0.05)' }}>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 500, color: '#1a1a18', margin: '0 0 3px' }}>{d.name}</p>
                      <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 20, background: sc.bg, color: sc.text }}>{STAGE_LABELS[d.stage] ?? d.stage}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {d.value && <p style={{ fontSize: 14, fontWeight: 500, color: '#1a1a18', margin: 0 }}>{formatCurrency(d.value)}</p>}
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="#c8c5be" strokeWidth="1.3" strokeLinecap="round"/></svg>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        {/* Merged timeline */}
        <div style={{ background: 'white', borderRadius: 16, border: '0.5px solid rgba(0,0,0,0.07)', padding: 16 }}>
          <p style={{ fontSize: 11, color: '#9b9890', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Activity & Tasks</p>
          {timeline.length === 0 ? (
            <p style={{ fontSize: 14, color: '#9b9890', textAlign: 'center', padding: '12px 0' }}>No activity yet</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {timeline.map((item, i) => (
                <div key={item.id} style={{ display: 'flex', gap: 12, paddingBottom: i < timeline.length - 1 ? 14 : 0 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', marginTop: 4, flexShrink: 0, background: item._type === 'task' ? (item.done ? '#1D9E75' : item.priority ? PRIORITY_COLOR[item.priority] : '#EF9F27') : '#1a1a18' }} />
                    {i < timeline.length - 1 && <div style={{ width: 1, flex: 1, background: 'rgba(0,0,0,0.07)', marginTop: 4 }} />}
                  </div>
                  <div style={{ flex: 1, paddingBottom: i < timeline.length - 1 ? 4 : 0 }}>
                    {item._type === 'task' ? (
                      <Link href={`/tasks/${item.id}`} style={{ textDecoration: 'none' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                          <div style={{ width: 12, height: 12, borderRadius: 3, flexShrink: 0, border: item.done ? 'none' : '1.5px solid rgba(0,0,0,0.2)', background: item.done ? '#1D9E75' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {item.done && <svg width="7" height="7" viewBox="0 0 8 8" fill="none"><path d="M1.5 4L3 5.5L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>}
                          </div>
                          <p style={{ fontSize: 13, color: item.done ? '#9b9890' : '#1a1a18', margin: 0, textDecoration: item.done ? 'line-through' : 'none' }}>{item.title ?? 'Task'}</p>
                          {item.priority && !item.done && <span style={{ fontSize: 10, fontWeight: 500, padding: '1px 6px', borderRadius: 4, background: `${PRIORITY_COLOR[item.priority]}18`, color: PRIORITY_COLOR[item.priority] }}>{item.priority}</span>}
                        </div>
                        <p style={{ fontSize: 11, color: '#9b9890', margin: 0 }}>Task · {item.due_date ? `Due ${new Date(item.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : timeAgo(item.created_at)}</p>
                      </Link>
                    ) : (
                      <>
                        <p style={{ fontSize: 13, color: '#1a1a18', margin: '0 0 2px' }}>{item.metadata?.summary ?? item.summary ?? item.type ?? 'Event'}</p>
                        <p style={{ fontSize: 11, color: '#9b9890', margin: 0 }}>{timeAgo(item.created_at)}</p>
                      </>
                    )}
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

function ActionButton({
  href, label, icon, externalLink,
}: {
  href?: string
  label: string
  icon: React.ReactNode
  externalLink?: boolean
}) {
  const disabled = !href
  const baseStyle: React.CSSProperties = {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: 6, padding: '10px 0', borderRadius: 12,
    background: '#f5f4f0',
    textDecoration: 'none',
    color: disabled ? '#c8c5be' : '#1a1a18',
    fontSize: 13, fontWeight: 500,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.55 : 1,
    border: 'none',
    fontFamily: 'inherit',
  }

  if (disabled) {
    return (
      <button disabled style={baseStyle} aria-label={`${label} (not available)`}>
        {icon}
        {label}
      </button>
    )
  }

  return (
    <a
      href={href}
      target={externalLink ? '_blank' : undefined}
      rel={externalLink ? 'noreferrer' : undefined}
      style={baseStyle}
    >
      {icon}
      {label}
    </a>
  )
}

const editBtn: React.CSSProperties = {
  fontSize: 13, color: '#6b6960', background: 'none',
  border: 'none', cursor: 'pointer', fontWeight: 500, padding: 0,
}
