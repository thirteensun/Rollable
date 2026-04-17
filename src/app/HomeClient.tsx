'use client'

import Link from 'next/link'
import { useState, useEffect, useMemo } from 'react'
import AIProactiveNudges from '@/components/AIProactiveNudges'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Task {
  id: string
  title: string
  due_date: string | null
  contacts: { full_name: string } | null
  deals: { name: string } | null
}

interface Event {
  id: string
  type: string
  created_at: string
}

interface Deal {
  id: string
  name: string
  stage: string
  value?: number
  last_activity_at?: string
}

interface Props {
  name: string
  initials: string
  tasks: Task[]
  events: Event[]
  deals: Deal[]
  orgName: string | null
  userRole: string
}

// ─── Constants ────────────────────────────────────────────────────────────────
const C = {
  bg: '#f5f4f0', dark: '#1a1a18', muted: '#6b6960', faint: '#9b9890',
  border: 'rgba(0,0,0,0.07)', red: '#E24B4A', amber: '#EF9F27', green: '#1D9E75', card: 'white',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (v?: number) => {
  if (!v) return '—'
  if (v >= 1000000) return `€${(v / 1000000).toFixed(1)}m`
  if (v >= 1000) return `€${(v / 1000).toFixed(0)}k`
  return `€${v}`
}

function getTaskUrgency(task: Task): string {
  if (!task.due_date) return C.faint
  const due = new Date(task.due_date)
  const now = new Date()
  if (due < now) return C.red
  const hours = (due.getTime() - now.getTime()) / 3600000
  if (hours < 24) return C.amber
  return C.green
}

function daysSince(d?: string) {
  if (!d) return 999
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000)
}

// ─── Activity contribution chart ──────────────────────────────────────────────
function ActivityChart({ events }: { events: Event[] }) {
  // Build a map of date → count
  const countByDate = useMemo(() => {
    const map: Record<string, number> = {}
    events.forEach(e => {
      const date = e.created_at.split('T')[0]
      map[date] = (map[date] || 0) + 1
    })
    return map
  }, [events])

  // Build 13 weeks × 7 days grid, ending today
  const cells = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    // Start from 13 weeks ago, aligned to Monday
    const start = new Date(today)
    start.setDate(start.getDate() - 90)
    // Go back to Monday
    const dow = start.getDay()
    start.setDate(start.getDate() - (dow === 0 ? 6 : dow - 1))

    const grid: { date: string; count: number; isToday: boolean; isFuture: boolean }[][] = []
    let current = new Date(start)

    for (let week = 0; week < 14; week++) {
      const col = []
      for (let day = 0; day < 7; day++) {
        const dateStr = current.toISOString().split('T')[0]
        const todayStr = today.toISOString().split('T')[0]
        col.push({
          date: dateStr,
          count: countByDate[dateStr] || 0,
          isToday: dateStr === todayStr,
          isFuture: current > today,
        })
        current = new Date(current)
        current.setDate(current.getDate() + 1)
      }
      grid.push(col)
    }
    return grid
  }, [countByDate])

  const maxCount = useMemo(() => Math.max(...Object.values(countByDate), 1), [countByDate])
  const totalDays = useMemo(() => Object.keys(countByDate).length, [countByDate])
  const totalEvents = useMemo(() => events.length, [events])

  // Month labels
  const monthLabels = useMemo(() => {
    const labels: { label: string; col: number }[] = []
    let lastMonth = -1
    cells.forEach((col, ci) => {
      const month = new Date(col[0].date).getMonth()
      if (month !== lastMonth) {
        labels.push({ label: new Date(col[0].date).toLocaleString('default', { month: 'short' }), col: ci })
        lastMonth = month
      }
    })
    return labels
  }, [cells])

  const cellSize = 11
  const gap = 3

  return (
    <div style={{ background: C.card, border: `0.5px solid ${C.border}`, borderRadius: 16, padding: '16px 18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: C.dark }}>Activity</span>
        <span style={{ fontSize: 11, color: C.faint }}>{totalEvents} actions · {totalDays} active days</span>
      </div>

      {/* Month labels */}
      <div style={{ display: 'flex', marginBottom: 4, paddingLeft: 16 }}>
        {cells.map((_, ci) => {
          const label = monthLabels.find(m => m.col === ci)
          return (
            <div key={ci} style={{ width: cellSize + gap, flexShrink: 0 }}>
              {label && <span style={{ fontSize: 8, color: C.faint }}>{label.label}</span>}
            </div>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: gap, alignItems: 'flex-start' }}>
        {/* Day labels */}
        <div style={{ display: 'flex', flexDirection: 'column', gap, marginRight: 2 }}>
          {['M', '', 'W', '', 'F', '', ''].map((d, i) => (
            <div key={i} style={{ width: 10, height: cellSize, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
              <span style={{ fontSize: 7, color: C.faint }}>{d}</span>
            </div>
          ))}
        </div>

        {/* Grid */}
        {cells.map((col, ci) => (
          <div key={ci} style={{ display: 'flex', flexDirection: 'column', gap }}>
            {col.map((cell, ri) => {
              const intensity = cell.isFuture ? 0 : cell.count === 0 ? 0 : Math.max(0.15, cell.count / maxCount)
              const bg = cell.isFuture
                ? 'transparent'
                : cell.count === 0
                  ? 'rgba(0,0,0,0.05)'
                  : `rgba(26,26,24,${intensity})`
              return (
                <div
                  key={ri}
                  title={`${cell.date}: ${cell.count} action${cell.count !== 1 ? 's' : ''}`}
                  style={{
                    width: cellSize, height: cellSize,
                    borderRadius: 3,
                    background: bg,
                    border: cell.isToday ? `1.5px solid ${C.dark}` : 'none',
                    boxSizing: 'border-box',
                    cursor: cell.count > 0 ? 'default' : 'default',
                  }}
                />
              )
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8, justifyContent: 'flex-end' }}>
        <span style={{ fontSize: 8, color: C.faint }}>Less</span>
        {[0, 0.15, 0.35, 0.6, 0.9].map((op, i) => (
          <div key={i} style={{ width: 9, height: 9, borderRadius: 2, background: op === 0 ? 'rgba(0,0,0,0.05)' : `rgba(26,26,24,${op})` }} />
        ))}
        <span style={{ fontSize: 8, color: C.faint }}>More</span>
      </div>
    </div>
  )
}

// ─── Quick shortcuts ──────────────────────────────────────────────────────────
const SHORTCUTS = [
  {
    href: '/capture',
    label: 'Capture',
    sub: 'Log interaction',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.4"/>
        <path d="M10 6v8M6 10h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    ),
    accent: C.dark,
  },
  {
    href: '/tracking',
    label: 'Pipeline',
    sub: 'View deals',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="1.5" y="3" width="5" height="14" rx="2" stroke="currentColor" strokeWidth="1.4"/>
        <rect x="8" y="3" width="5" height="9" rx="2" stroke="currentColor" strokeWidth="1.4"/>
        <rect x="14.5" y="3" width="4" height="11" rx="2" stroke="currentColor" strokeWidth="1.4"/>
      </svg>
    ),
    accent: '#3d7de4',
  },
  {
    href: '/tasks',
    label: 'Tasks',
    sub: 'Manage follow-ups',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="2" y="2" width="16" height="16" rx="3.5" stroke="currentColor" strokeWidth="1.4"/>
        <path d="M6 10l3 3 5-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    accent: C.green,
  },
  {
    href: '/ai-sandbox',
    label: 'AI Sandbox',
    sub: 'Ask anything',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M2 10h3l2-5 3 10 2-5H18" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    accent: C.amber,
  },
  {
    href: '/analytics',
    label: 'Analytics',
    sub: 'Performance',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M2 15L6.5 9.5l4 3 4-7 3.5 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    accent: C.red,
  },
  {
    href: '/contacts',
    label: 'Contacts',
    sub: 'People & companies',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="6.5" r="4" stroke="currentColor" strokeWidth="1.4"/>
        <path d="M2 18c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    ),
    accent: C.muted,
  },
]

// ─── Onboarding card ──────────────────────────────────────────────────────────
function OnboardingCard() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const dismissed = localStorage.getItem('sdm_onboarding_dismissed')
    if (!dismissed) setVisible(true)
  }, [])

  if (!visible) return null

  const pillars = [
    { icon: '📸', label: 'Capture', desc: 'Photo, voice, or text — AI extracts contacts, deals, and tasks automatically.' },
    { icon: '📋', label: 'Plan', desc: 'Tasks and follow-ups organised by urgency. Never drop the ball.' },
    { icon: '📊', label: 'Track', desc: 'Pipeline, analytics, and AI signals keep you ahead of every deal.' },
  ]

  return (
    <div style={{
      background: C.dark, borderRadius: 18, padding: '18px 20px', marginBottom: 20,
      position: 'relative',
    }}>
      <button
        onClick={() => { localStorage.setItem('sdm_onboarding_dismissed', '1'); setVisible(false) }}
        style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: 18, lineHeight: 1, padding: 0, fontFamily: 'inherit' }}
      >×</button>

      <div style={{ fontSize: 13, fontWeight: 500, color: 'white', marginBottom: 4 }}>Welcome to SDM</div>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 16 }}>Three things to know</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {pillars.map((p, i) => (
          <div key={i} style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 12, padding: '12px 12px' }}>
            <div style={{ fontSize: 18, marginBottom: 6 }}>{p.icon}</div>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'white', marginBottom: 4 }}>{p.label}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>{p.desc}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Pipeline pulse ───────────────────────────────────────────────────────────
function PipelinePulse({ deals }: { deals: Deal[] }) {
  const total = deals.length
  const value = deals.reduce((s, d) => s + (d.value || 0), 0)
  const atRisk = deals.filter(d => daysSince(d.last_activity_at) >= 14).length

  const stats = [
    { label: 'Active deals', value: String(total), color: C.dark, href: '/tracking' },
    { label: 'Pipeline value', value: fmt(value), color: C.dark, href: '/tracking' },
    { label: 'At risk', value: String(atRisk), color: atRisk > 0 ? C.red : C.green, href: '/tracking' },
  ]

  return (
    <Link href="/tracking" style={{ textDecoration: 'none' }}>
      <div style={{
        background: C.card, border: `0.5px solid ${C.border}`, borderRadius: 16,
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 20,
        overflow: 'hidden',
      }}>
        {stats.map((s, i) => (
          <div key={i} style={{
            padding: '14px 16px',
            borderRight: i < stats.length - 1 ? `0.5px solid ${C.border}` : 'none',
          }}>
            <div style={{ fontSize: 10, color: C.faint, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 500, color: s.color, letterSpacing: '-0.02em' }}>{s.value}</div>
          </div>
        ))}
      </div>
    </Link>
  )
}

// ─── What's next banner ───────────────────────────────────────────────────────
function WhatsNext({ tasks, deals }: { tasks: Task[]; deals: Deal[] }) {
  const overdue = tasks.filter(t => t.due_date && new Date(t.due_date) < new Date())
  const atRisk = deals.filter(d => daysSince(d.last_activity_at) >= 14)
  const dueToday = tasks.filter(t => {
    if (!t.due_date) return false
    const due = new Date(t.due_date)
    const now = new Date()
    return due >= now && due.toDateString() === now.toDateString()
  })

  let message = ''
  let color = C.green
  let icon = '✓'

  if (overdue.length > 0 && atRisk.length > 0) {
    message = `${overdue.length} overdue task${overdue.length > 1 ? 's' : ''} and ${atRisk.length} at-risk deal${atRisk.length > 1 ? 's' : ''}. Start with your oldest task.`
    color = C.red; icon = '⚠'
  } else if (overdue.length > 0) {
    message = `${overdue.length} overdue task${overdue.length > 1 ? 's' : ''}. Clear ${overdue.length === 1 ? 'it' : 'these'} first.`
    color = C.red; icon = '⚠'
  } else if (atRisk.length > 0) {
    message = `${atRisk.length} deal${atRisk.length > 1 ? 's' : ''} at risk — no activity in 14+ days. Time to check in.`
    color = C.amber; icon = '!'
  } else if (dueToday.length > 0) {
    message = `${dueToday.length} task${dueToday.length > 1 ? 's' : ''} due today. You're on track.`
    color = C.amber; icon = '→'
  } else if (tasks.length === 0 && deals.length === 0) {
    message = 'Nothing captured yet. Tap Capture to log your first interaction.'
    color = C.faint; icon = '+'
  } else {
    message = 'All caught up. Keep the momentum going.'
    color = C.green; icon = '✓'
  }

  return (
    <div style={{
      background: C.card, border: `0.5px solid ${C.border}`,
      borderLeft: `3px solid ${color}`,
      borderRadius: 14, padding: '12px 14px',
      display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20,
    }}>
      <div style={{
        width: 24, height: 24, borderRadius: '50%', background: `${color}18`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 700, color, flexShrink: 0,
      }}>{icon}</div>
      <p style={{ margin: 0, fontSize: 13, color: C.muted, lineHeight: 1.5 }}>{message}</p>
    </div>
  )
}

// ─── Today's focus ────────────────────────────────────────────────────────────
function TodayFocus({ tasks }: { tasks: Task[] }) {
  const overdue = tasks.filter(t => t.due_date && new Date(t.due_date) < new Date())
  const dueToday = tasks.filter(t => {
    if (!t.due_date) return false
    const due = new Date(t.due_date)
    const now = new Date()
    return due >= now
  })
  const display = [...overdue, ...dueToday].slice(0, 5)

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: C.faint, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Due today{overdue.length > 0 ? ` · ${overdue.length} overdue` : ''}
        </span>
        <Link href="/tasks" style={{ fontSize: 12, color: C.faint, textDecoration: 'none' }}>See all</Link>
      </div>

      {display.length === 0 ? (
        <div style={{ background: C.card, borderRadius: 14, border: `0.5px solid ${C.border}`, padding: '18px', textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 13, color: C.faint }}>All caught up — nothing due today</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {display.map((task) => {
            const urgencyColor = getTaskUrgency(task)
            const isOverdue = task.due_date && new Date(task.due_date) < new Date()
            return (
              <Link key={task.id} href={`/tasks/${task.id}`} style={{ textDecoration: 'none' }}>
                <div style={{
                  background: C.card, borderRadius: 14,
                  border: `0.5px solid ${C.border}`,
                  borderLeft: isOverdue ? `3px solid ${C.red}` : `0.5px solid ${C.border}`,
                  padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: urgencyColor, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: C.dark }}>{task.title}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: C.faint }}>
                      {task.contacts?.full_name || task.deals?.name || ''}
                      {task.due_date && ` · ${new Date(task.due_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}`}
                    </p>
                  </div>
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                    <path d="M6 4l4 4-4 4" stroke={C.faint} strokeWidth="1.3" strokeLinecap="round"/>
                  </svg>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function HomeClient({ name, initials, tasks, events, deals, orgName, userRole }: Props) {
  const greetings = [
    'Tap Capture and sell with total freedom.',
    'Your AI is ready. Go close something.',
    'Snap, speak, screenshot — AI handles the rest.',
    'No forms. No friction. Just results.',
    'Liberate your sales day.',
  ]
  const greeting = greetings[new Date().getDay() % greetings.length]

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 }}>
        <div>
          <p style={{ margin: 0, fontSize: 12, color: C.faint }} suppressHydrationWarning>
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 500, color: C.dark, lineHeight: 1.3 }} suppressHydrationWarning>
            {greeting}
          </p>
          {orgName && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <p style={{ margin: 0, fontSize: 12, color: C.faint }}>{orgName}</p>
              <span style={{ fontSize: 10, color: C.faint, background: 'rgba(0,0,0,0.06)', borderRadius: 4, padding: '1px 6px', textTransform: 'capitalize' }}>
                {userRole}
              </span>
            </div>
          )}
        </div>
        <Link href="/settings" style={{ textDecoration: 'none' }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%', background: C.dark,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 500, color: '#f5f4f0', cursor: 'pointer',
          }}>
            {initials}
          </div>
        </Link>
      </div>

      {/* Onboarding card — dismissible */}
      <OnboardingCard />

      {/* What's next */}
      <WhatsNext tasks={tasks} deals={deals} />

      {/* Pipeline pulse */}
      <PipelinePulse deals={deals} />

      {/* Quick shortcuts */}
      <div style={{ marginBottom: 24 }}>
        <p style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 500, color: C.faint, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Quick access</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {SHORTCUTS.map((s) => (
            <Link key={s.href} href={s.href} style={{ textDecoration: 'none' }}>
              <div style={{
                background: C.card, border: `0.5px solid ${C.border}`, borderRadius: 14,
                padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 8,
                transition: 'border-color 0.15s',
              }} className="shortcut-card">
                <div style={{ color: s.accent }}>{s.icon}</div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: C.dark }}>{s.label}</div>
                  <div style={{ fontSize: 11, color: C.faint, marginTop: 1 }}>{s.sub}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Desktop: two columns / Mobile: single */}
      <div className="md:grid md:grid-cols-2 md:gap-8">

        {/* Today's focus */}
        <TodayFocus tasks={tasks} />

        {/* Activity chart */}
        <div style={{ marginBottom: 24 }}>
          <ActivityChart events={events} />
        </div>

      </div>

      {/* AI Nudges */}
      <AIProactiveNudges />

      <style>{`
        .shortcut-card:hover { border-color: rgba(0,0,0,0.15) !important; }
      `}</style>
    </div>
  )
}