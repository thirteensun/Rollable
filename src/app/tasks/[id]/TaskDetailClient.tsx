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

export default function TaskDetailClient({ task, events }: { task: any; events: any[] }) {
  const router = useRouter()
  const supabase = createBrowserSupabaseClient()

  const [status, setStatus] = useState(task.status ?? 'pending')
  const [priority, setPriority] = useState(task.priority ?? 'medium')
  const [title, setTitle] = useState(task.title ?? '')
  const [dueDate, setDueDate] = useState(task.due_date ? task.due_date.slice(0, 10) : '')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

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
    await supabase.from('tasks').update({
      title,
      priority,
      due_date: dueDate || null,
    }).eq('id', task.id)
    setSaving(false)
    setEditing(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const statusInfo = STATUS_COLORS[status] ?? STATUS_COLORS.pending
  const priorityInfo = PRIORITY_COLORS[priority] ?? PRIORITY_COLORS.medium

  return (
    <div style={{ background: '#f5f4f0', minHeight: '100dvh', paddingBottom: 100 }}>

      {/* Back */}
      <div style={{ padding: '56px 20px 12px' }}>
        <button onClick={() => router.back()} style={{
          display: 'flex', alignItems: 'center', gap: 6, color: '#9b9890',
          fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Back
        </button>
      </div>

      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Header card */}
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

        {/* Status card */}
        <div style={{ background: 'white', borderRadius: 16, border: '0.5px solid rgba(0,0,0,0.07)', padding: 16 }}>
          <p style={{ fontSize: 11, color: '#9b9890', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12, margin: '0 0 12px' }}>Status</p>
          <div style={{ display: 'flex', gap: 8 }}>
            {Object.entries(STATUS_COLORS).map(([s, info]) => (
              <button key={s} onClick={() => updateStatus(s)} style={{
                flex: 1, padding: '8px 0', borderRadius: 10, fontSize: 12, fontWeight: 500,
                border: status === s ? 'none' : '0.5px solid rgba(0,0,0,0.1)',
                background: status === s ? info.bg : 'transparent',
                color: status === s ? info.text : '#6b6960',
                cursor: 'pointer',
              }}>
                {info.label}
              </button>
            ))}
          </div>
        </div>

        {/* Details card */}
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
              <button onClick={saveTask} disabled={saving} style={{
                marginTop: 4, padding: '12px', borderRadius: 20, background: '#1a1a18',
                color: 'white', fontWeight: 600, fontSize: 14, border: 'none', cursor: 'pointer',
                opacity: saving ? 0.6 : 1,
              }}>
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

        {/* Linked deal */}
        {task.deals && (
          <div style={{ background: 'white', borderRadius: 16, border: '0.5px solid rgba(0,0,0,0.07)', padding: 16 }}>
            <p style={{ fontSize: 11, color: '#9b9890', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px' }}>Linked Deal</p>
            <Link href={`/tracking/deals/${task.deals.id}`} style={{ textDecoration: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 500, color: '#1a1a18', margin: '0 0 3px' }}>{task.deals.name}</p>
                  <span style={{ fontSize: 11, background: '#f5f4f0', color: '#6b6960', padding: '2px 8px', borderRadius: 6 }}>
                    {task.deals.stage}
                  </span>
                </div>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M6 4l4 4-4 4" stroke="#c8c5be" strokeWidth="1.3" strokeLinecap="round"/>
                </svg>
              </div>
            </Link>
          </div>
        )}

        {/* Linked contact */}
        {task.contacts && (
          <div style={{ background: 'white', borderRadius: 16, border: '0.5px solid rgba(0,0,0,0.07)', padding: 16 }}>
            <p style={{ fontSize: 11, color: '#9b9890', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px' }}>Linked Contact</p>
            <Link href={`/contacts/${task.contacts.id}`} style={{ textDecoration: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', background: '#1a1a18',
                  color: 'white', fontSize: 12, fontWeight: 600, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {getInitials(task.contacts.full_name ?? '')}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 500, color: '#1a1a18', margin: 0 }}>{task.contacts.full_name}</p>
                  {task.contacts.role && <p style={{ fontSize: 12, color: '#6b6960', margin: 0 }}>{task.contacts.role}</p>}
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  {task.contacts.email && (
                    <a href={`mailto:${task.contacts.email}`} onClick={e => e.stopPropagation()} style={{ color: '#6b6960' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 7 10 7 10-7"/>
                      </svg>
                    </a>
                  )}
                  {task.contacts.phone && (
                    <a href={`tel:${task.contacts.phone}`} onClick={e => e.stopPropagation()} style={{ color: '#6b6960' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3-8.59A2 2 0 0 1 3.62 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6 6l.92-.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                      </svg>
                    </a>
                  )}
                </div>
              </div>
            </Link>
          </div>
        )}

        {/* Activity */}
        <div style={{ background: 'white', borderRadius: 16, border: '0.5px solid rgba(0,0,0,0.07)', padding: 16 }}>
          <p style={{ fontSize: 11, color: '#9b9890', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px' }}>Activity</p>
          {events.length === 0 ? (
            <p style={{ fontSize: 14, color: '#9b9890', textAlign: 'center', padding: '12px 0' }}>No activity yet</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {events.map((ev: any, i: number) => (
                <div key={ev.id} style={{ display: 'flex', gap: 12, paddingBottom: i < events.length - 1 ? 14 : 0 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#1a1a18', marginTop: 4 }} />
                    {i < events.length - 1 && <div style={{ width: 1, flex: 1, background: 'rgba(0,0,0,0.07)', marginTop: 4 }} />}
                  </div>
                  <div style={{ flex: 1, paddingBottom: i < events.length - 1 ? 4 : 0 }}>
                    <p style={{ fontSize: 13, color: '#1a1a18', margin: '0 0 2px' }}>{ev.summary ?? ev.type ?? 'Event'}</p>
                    <p style={{ fontSize: 11, color: '#9b9890', margin: 0 }}>{timeAgo(ev.created_at)}</p>
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
