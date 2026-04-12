'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '@/lib/supabase'

const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  high:   { bg: 'rgba(226,75,74,0.1)',   text: '#E24B4A' },
  medium: { bg: 'rgba(239,159,39,0.1)',  text: '#EF9F27' },
  low:    { bg: 'rgba(155,152,144,0.1)', text: '#9b9890' },
}

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  pending:     { bg: 'rgba(155,152,144,0.1)', text: '#9b9890',  label: 'Pending' },
  in_progress: { bg: 'rgba(239,159,39,0.1)',  text: '#EF9F27',  label: 'In Progress' },
  done:        { bg: 'rgba(29,158,117,0.1)',  text: '#1D9E75',  label: 'Done' },
}

const STAGE_LABELS: Record<string, string> = {
  lead: 'Lead', qualified: 'Qualified', demo: 'Demo',
  proposal: 'Proposal', negotiation: 'Negotiation',
  closed_won: 'Won', closed_lost: 'Lost',
}

function formatDate(val?: string | null) {
  if (!val) return '—'
  return new Date(val).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
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

export default function TaskDetailClient({ task, allDeals, allContacts }: {
  task: any
  allDeals: any[]
  allContacts: any[]
}) {
  const router = useRouter()
  const supabase = createBrowserSupabaseClient()

  const [status, setStatus] = useState(task.status ?? 'pending')
  const [priority, setPriority] = useState(task.priority ?? 'medium')
  const [title, setTitle] = useState(task.title ?? '')
  const [dueDate, setDueDate] = useState(task.due_date ? task.due_date.slice(0, 10) : '')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Link state
  const [linkedDeal, setLinkedDeal] = useState<any>(task.deals ?? null)
  const [linkedContact, setLinkedContact] = useState<any>(task.contacts ?? null)
  const [showDealPicker, setShowDealPicker] = useState(false)
  const [showContactPicker, setShowContactPicker] = useState(false)
  const [dealSearch, setDealSearch] = useState('')
  const [contactSearch, setContactSearch] = useState('')
  const [linking, setLinking] = useState(false)

  const statusInfo = STATUS_COLORS[status] ?? STATUS_COLORS.pending
  const priorityInfo = PRIORITY_COLORS[priority] ?? PRIORITY_COLORS.medium

  async function updateStatus(newStatus: string) {
    setStatus(newStatus)
    await supabase.from('tasks').update({
      status: newStatus,
      done: newStatus === 'done',
      done_at: newStatus === 'done' ? new Date().toISOString() : null,
    }).eq('id', task.id)
  }

  async function saveTask() {
    setSaving(true)
    await supabase.from('tasks').update({ title, priority, due_date: dueDate || null }).eq('id', task.id)
    setSaving(false)
    setEditing(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function linkDeal(deal: any) {
    setLinking(true)
    await supabase.from('tasks').update({ deal_id: deal.id }).eq('id', task.id)
    setLinkedDeal(deal)
    setShowDealPicker(false)
    setDealSearch('')
    setLinking(false)
  }

  async function unlinkDeal() {
    await supabase.from('tasks').update({ deal_id: null }).eq('id', task.id)
    setLinkedDeal(null)
  }

  async function linkContact(contact: any) {
    setLinking(true)
    await supabase.from('tasks').update({ contact_id: contact.id }).eq('id', task.id)
    setLinkedContact(contact)
    setShowContactPicker(false)
    setContactSearch('')
    setLinking(false)
  }

  async function unlinkContact() {
    await supabase.from('tasks').update({ contact_id: null }).eq('id', task.id)
    setLinkedContact(null)
  }

  const filteredDeals = allDeals.filter(d => d.name.toLowerCase().includes(dealSearch.toLowerCase()))
  const filteredContacts = allContacts.filter(c => c.full_name.toLowerCase().includes(contactSearch.toLowerCase()))

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
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
            <h1 style={{ fontSize: 20, fontWeight: 600, color: '#1a1a18', margin: 0, flex: 1 }}>{task.title}</h1>
            <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500, flexShrink: 0, background: statusInfo.bg, color: statusInfo.text }}>
              {statusInfo.label}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500, background: priorityInfo.bg, color: priorityInfo.text }}>
              {priority} priority
            </span>
            {task.due_date && (
              <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, background: 'rgba(0,0,0,0.05)', color: '#6b6960' }}>
                Due {formatDate(task.due_date)}
              </span>
            )}
          </div>
        </div>

        {/* Status */}
        <div style={{ background: 'white', borderRadius: 16, border: '0.5px solid rgba(0,0,0,0.07)', padding: 16 }}>
          <p style={{ fontSize: 11, color: '#9b9890', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px' }}>Status</p>
          <div style={{ display: 'flex', gap: 8 }}>
            {Object.entries(STATUS_COLORS).map(([s, info]) => (
              <button key={s} onClick={() => updateStatus(s)} style={{
                flex: 1, padding: '8px 0', borderRadius: 10, fontSize: 12, fontWeight: 500,
                border: status === s ? 'none' : '0.5px solid rgba(0,0,0,0.1)',
                background: status === s ? info.bg : 'transparent',
                color: status === s ? info.text : '#6b6960', cursor: 'pointer',
              }}>{info.label}</button>
            ))}
          </div>
        </div>

        {/* Details */}
        <div style={{ background: 'white', borderRadius: 16, border: '0.5px solid rgba(0,0,0,0.07)', padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <p style={{ fontSize: 11, color: '#9b9890', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Details</p>
            <button onClick={() => setEditing(e => !e)} style={{ fontSize: 13, color: '#1a1a18', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>
              {editing ? 'Cancel' : 'Edit'}
            </button>
          </div>
          {editing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input placeholder="Task title" value={title} onChange={e => setTitle(e.target.value)} style={inputStyle} />
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={inputStyle} />
              <div style={{ display: 'flex', gap: 6 }}>
                {['high', 'medium', 'low'].map(p => (
                  <button key={p} onClick={() => setPriority(p)} style={{
                    flex: 1, padding: '8px 0', borderRadius: 10, fontSize: 12, fontWeight: 500,
                    border: priority === p ? 'none' : '0.5px solid rgba(0,0,0,0.1)',
                    background: priority === p ? PRIORITY_COLORS[p].bg : 'transparent',
                    color: priority === p ? PRIORITY_COLORS[p].text : '#6b6960',
                    cursor: 'pointer', textTransform: 'capitalize',
                  }}>{p}</button>
                ))}
              </div>
              <button onClick={saveTask} disabled={saving} style={{ marginTop: 4, padding: 12, borderRadius: 20, background: '#1a1a18', color: 'white', fontWeight: 600, fontSize: 14, border: 'none', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Row label="Due date" value={formatDate(task.due_date)} />
              <Row label="Priority" value={priority} />
              <Row label="Created" value={timeAgo(task.created_at)} />
              {saved && <p style={{ fontSize: 12, color: '#1D9E75', textAlign: 'center' }}>Saved ✓</p>}
            </div>
          )}
        </div>

        {/* Linked Deal */}
        <div style={{ background: 'white', borderRadius: 16, border: '0.5px solid rgba(0,0,0,0.07)', padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: linkedDeal ? 12 : 0 }}>
            <p style={{ fontSize: 11, color: '#9b9890', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Linked Deal</p>
            <button onClick={() => { setShowDealPicker(v => !v); setShowContactPicker(false) }} style={{ fontSize: 13, color: '#1a1a18', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>
              {linkedDeal ? 'Change' : '+ Link'}
            </button>
          </div>

          {showDealPicker && (
            <div style={{ marginTop: 10 }}>
              <input
                autoFocus
                placeholder="Search deals…"
                value={dealSearch}
                onChange={e => setDealSearch(e.target.value)}
                style={{ ...inputStyle, marginBottom: 8 }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflowY: 'auto' }}>
                {filteredDeals.map(d => (
                  <button key={d.id} onClick={() => linkDeal(d)} style={{
                    padding: '9px 12px', borderRadius: 10, background: '#f5f4f0',
                    border: 'none', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: '#1a1a18' }}>{d.name}</span>
                    <span style={{ fontSize: 11, color: '#9b9890' }}>{STAGE_LABELS[d.stage] ?? d.stage}</span>
                  </button>
                ))}
                {filteredDeals.length === 0 && <p style={{ fontSize: 13, color: '#9b9890', textAlign: 'center', padding: 8 }}>No deals found</p>}
              </div>
            </div>
          )}

          {linkedDeal && !showDealPicker && (
            <Link href={`/tracking/deals/${linkedDeal.id}`} style={{ textDecoration: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 500, color: '#1a1a18', margin: '0 0 3px' }}>{linkedDeal.name}</p>
                  <span style={{ fontSize: 11, background: '#f5f4f0', color: '#6b6960', padding: '2px 8px', borderRadius: 6 }}>
                    {STAGE_LABELS[linkedDeal.stage] ?? linkedDeal.stage}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <button onClick={e => { e.preventDefault(); unlinkDeal() }} style={{ fontSize: 11, color: '#E24B4A', background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="#c8c5be" strokeWidth="1.3" strokeLinecap="round"/></svg>
                </div>
              </div>
            </Link>
          )}

          {!linkedDeal && !showDealPicker && (
            <p style={{ fontSize: 13, color: '#9b9890', margin: '8px 0 0' }}>No deal linked</p>
          )}
        </div>

        {/* Linked Contact */}
        <div style={{ background: 'white', borderRadius: 16, border: '0.5px solid rgba(0,0,0,0.07)', padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: linkedContact ? 12 : 0 }}>
            <p style={{ fontSize: 11, color: '#9b9890', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Linked Contact</p>
            <button onClick={() => { setShowContactPicker(v => !v); setShowDealPicker(false) }} style={{ fontSize: 13, color: '#1a1a18', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>
              {linkedContact ? 'Change' : '+ Link'}
            </button>
          </div>

          {showContactPicker && (
            <div style={{ marginTop: 10 }}>
              <input
                autoFocus
                placeholder="Search contacts…"
                value={contactSearch}
                onChange={e => setContactSearch(e.target.value)}
                style={{ ...inputStyle, marginBottom: 8 }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflowY: 'auto' }}>
                {filteredContacts.map(c => (
                  <button key={c.id} onClick={() => linkContact(c)} style={{
                    padding: '9px 12px', borderRadius: 10, background: '#f5f4f0',
                    border: 'none', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10,
                  }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#1a1a18', color: 'white', fontSize: 10, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {getInitials(c.full_name)}
                    </div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 500, color: '#1a1a18', margin: 0 }}>{c.full_name}</p>
                      {c.role && <p style={{ fontSize: 11, color: '#9b9890', margin: 0 }}>{c.role}</p>}
                    </div>
                  </button>
                ))}
                {filteredContacts.length === 0 && <p style={{ fontSize: 13, color: '#9b9890', textAlign: 'center', padding: 8 }}>No contacts found</p>}
              </div>
            </div>
          )}

          {linkedContact && !showContactPicker && (
            <Link href={`/contacts/${linkedContact.id}`} style={{ textDecoration: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#1a1a18', color: 'white', fontSize: 12, fontWeight: 600, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {getInitials(linkedContact.full_name ?? '')}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 500, color: '#1a1a18', margin: 0 }}>{linkedContact.full_name}</p>
                  {linkedContact.role && <p style={{ fontSize: 12, color: '#6b6960', margin: 0 }}>{linkedContact.role}</p>}
                </div>
                <button onClick={e => { e.preventDefault(); unlinkContact() }} style={{ fontSize: 11, color: '#E24B4A', background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>
              </div>
            </Link>
          )}

          {!linkedContact && !showContactPicker && (
            <p style={{ fontSize: 13, color: '#9b9890', margin: '8px 0 0' }}>No contact linked</p>
          )}
        </div>

      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value || value === '—') return null
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 13, color: '#6b6960' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: '#1a1a18' }}>{value}</span>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 10,
  border: '0.5px solid rgba(0,0,0,0.12)', fontSize: 14,
  color: '#1a1a18', background: '#f5f4f0', outline: 'none',
  boxSizing: 'border-box',
}
