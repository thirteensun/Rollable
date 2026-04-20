'use client'

import Link from 'next/link'
import { useState, useMemo, useRef, useEffect } from 'react'
import AIProactiveNudges from '@/components/AIProactiveNudges'
import { type HomePriority } from '@/lib/stage-templates'

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
  summary: string | null
  created_at: string
  contacts: { full_name: string }[] | null
  deals: { name: string }[] | null
  companies: { name: string }[] | null
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
  atRiskDeals: Deal[]
  orgName: string | null
  userRole: string
  homePriority: HomePriority
}

function getTaskUrgency(task: Task): string {
  if (!task.due_date) return '#9b9890'
  const due = new Date(task.due_date)
  const now = new Date()
  if (due < now) return '#E24B4A'
  const hours = (due.getTime() - now.getTime()) / 3600000
  if (hours < 24) return '#EF9F27'
  return '#1D9E75'
}

const EVENT_LABEL: Record<string, string> = {
  meeting: 'Meeting', call: 'Call', email: 'Email',
  whatsapp: 'WhatsApp', note: 'Note', card_scan: 'Card scan',
  voice_memo: 'Voice memo', other: 'Activity',
}

function formatValue(v?: number) {
  if (!v) return '—'
  if (v >= 1000) return `€${(v / 1000).toFixed(0)}k`
  return `€${v}`
}

function timeAgo(dateStr?: string) {
  if (!dateStr) return '—'
  const d = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
  if (d === 0) return 'Today'
  if (d === 1) return 'Yesterday'
  return `${d}d ago`
}

const SHORTCUTS = [
  { href: '/capture', label: 'Capture', color: '#4a7a8a', icon: <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><circle cx="11" cy="11" r="9" stroke="currentColor" strokeWidth="1.5"/><path d="M11 6v10M6 11h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
  { href: '/tracking', label: 'Pipeline', color: '#4a7a8a', icon: <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><rect x="1.5" y="4" width="5.5" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/><rect x="8.5" y="4" width="5.5" height="9" rx="2" stroke="currentColor" strokeWidth="1.5"/><rect x="15.5" y="4" width="5" height="11" rx="2" stroke="currentColor" strokeWidth="1.5"/></svg> },
  { href: '/tasks', label: 'Tasks', color: '#4a8a6a', icon: <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><rect x="2" y="2" width="18" height="18" rx="4" stroke="currentColor" strokeWidth="1.5"/><path d="M7 11l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  { href: '/ai-sandbox', label: 'AI Sandbox', color: '#a08840', icon: <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M2 11h3.5L8 5l4 12 3-6h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  { href: '/analytics', label: 'Analytics', color: '#a06050', icon: <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M2 17L7 10l4.5 3.5L16 6l4 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  { href: '/contacts', label: 'Contacts', color: '#7a6aaa', icon: <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><circle cx="11" cy="8" r="4" stroke="currentColor" strokeWidth="1.5"/><path d="M3 20c0-4.4 3.6-7 8-7s8 2.6 8 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
]

const CHART_COLOR_BASE = [74, 122, 138]
const TOTAL_WEEKS = 52

function activityColor(intensity: number): string {
  if (intensity === 0) return 'rgba(0,0,0,0.06)'
  const [r, g, b] = CHART_COLOR_BASE
  return `rgb(${Math.round(r + (1 - intensity) * 148)},${Math.round(g + (1 - intensity) * 98)},${Math.round(b + (1 - intensity) * 80)})`
}

function ActivityChart({ events }: { events: Event[] }) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollLeft = scrollRef.current.scrollWidth
  }, [])

  const countByDate = useMemo(() => {
    const map: Record<string, number> = {}
    events.forEach(e => { const d = e.created_at.split('T')[0]; map[d] = (map[d] || 0) + 1 })
    return map
  }, [events])

  const eventsByDate = useMemo(() => {
    const map: Record<string, Event[]> = {}
    events.forEach(e => { const d = e.created_at.split('T')[0]; if (!map[d]) map[d] = []; map[d].push(e) })
    return map
  }, [events])

  const { weeks, monthLabels } = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0)
    const todayStr = today.toISOString().split('T')[0]
    const start = new Date(today); start.setDate(start.getDate() - TOTAL_WEEKS * 7)
    const dow = start.getDay(); start.setDate(start.getDate() - (dow === 0 ? 6 : dow - 1))
    const cur = new Date(start)
    const weeksArr: { date: string; count: number; isToday: boolean }[][] = []
    for (let w = 0; w < TOTAL_WEEKS; w++) {
      const col = []
      for (let d = 0; d < 7; d++) {
        const dateStr = cur.toISOString().split('T')[0]
        if (cur <= today) col.push({ date: dateStr, count: countByDate[dateStr] || 0, isToday: dateStr === todayStr })
        cur.setDate(cur.getDate() + 1)
      }
      weeksArr.push(col)
    }
    const labels: { label: string; col: number }[] = []
    let lastMonth = -1
    weeksArr.forEach((col, ci) => {
      if (!col[0]) return
      const month = new Date(col[0].date + 'T12:00:00').getMonth()
      if (month !== lastMonth) { labels.push({ label: new Date(col[0].date + 'T12:00:00').toLocaleString('default', { month: 'short' }), col: ci }); lastMonth = month }
    })
    return { weeks: weeksArr, monthLabels: labels }
  }, [countByDate])

  const maxCount = useMemo(() => Math.max(...Object.values(countByDate), 1), [countByDate])
  const selectedEvents = selectedDate ? (eventsByDate[selectedDate] || []) : []
  const CELL = 13; const GAP = 3

  return (
    <div style={{ background: 'white', borderRadius: 14, border: '0.5px solid rgba(0,0,0,0.07)', overflow: 'hidden' }}>
      <div style={{ padding: '16px 18px 12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: '#9b9890', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Activity</p>
          <span style={{ fontSize: 11, color: '#9b9890' }}>{events.length} actions · {Object.keys(countByDate).length} active days</span>
        </div>
        <div ref={scrollRef} style={{ overflowX: 'auto', overflowY: 'hidden', paddingBottom: 4 }}>
          <div style={{ width: 'max-content' }}>
            <div style={{ display: 'flex', marginBottom: 4, paddingLeft: 20 }}>
              {weeks.map((col, ci) => {
                const ml = monthLabels.find(m => m.col === ci)
                return <div key={ci} style={{ width: CELL + GAP, flexShrink: 0, fontSize: 9, color: '#9b9890' }}>{ml ? ml.label : ''}</div>
              })}
            </div>
            <div style={{ display: 'flex', gap: GAP }}>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', paddingTop: 1, paddingBottom: 1, width: 16, flexShrink: 0 }}>
                {['M','','W','','F','',''].map((d, i) => <div key={i} style={{ height: CELL, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 3 }}><span style={{ fontSize: 8, color: '#9b9890' }}>{d}</span></div>)}
              </div>
              {weeks.map((col, ci) => (
                <div key={ci} style={{ display: 'flex', flexDirection: 'column', gap: GAP }}>
                  {col.map((cell, ri) => {
                    const intensity = cell.count === 0 ? 0 : Math.max(0.2, Math.min(1, cell.count / maxCount))
                    const isSelected = selectedDate === cell.date
                    return (
                      <div key={ri} onClick={() => setSelectedDate(isSelected ? null : cell.date)} title={`${cell.date}: ${cell.count} action${cell.count !== 1 ? 's' : ''}`}
                        style={{ width: CELL, height: CELL, borderRadius: 3, background: activityColor(intensity), border: cell.isToday ? '1.5px solid #4a7a8a' : isSelected ? '1.5px solid #1a1a18' : 'none', boxSizing: 'border-box', cursor: cell.count > 0 ? 'pointer' : 'default', flexShrink: 0 }} />
                    )
                  })}
                  {Array.from({ length: 7 - col.length }).map((_, i) => <div key={`pad-${i}`} style={{ width: CELL, height: CELL, flexShrink: 0 }} />)}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 10, justifyContent: 'flex-end' }}>
          <span style={{ fontSize: 8, color: '#9b9890' }}>Less</span>
          {[0, 0.2, 0.45, 0.7, 1].map((v, i) => <div key={i} style={{ width: 10, height: 10, borderRadius: 2, background: activityColor(v) }} />)}
          <span style={{ fontSize: 8, color: '#9b9890' }}>More</span>
        </div>
      </div>
      {selectedDate && (
        <div style={{ borderTop: '0.5px solid rgba(0,0,0,0.07)', padding: '12px 18px' }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: '#9b9890', marginBottom: 8 }}>
            {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}
            {selectedEvents.length === 0 && <span style={{ fontWeight: 400, marginLeft: 8 }}>No activity</span>}
          </div>
          {selectedEvents.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {selectedEvents.map(e => {
                const who = e.contacts?.[0]?.full_name || e.companies?.[0]?.name || e.deals?.[0]?.name || null
                return (
                  <div key={e.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4a7a8a', flexShrink: 0, marginTop: 5 }} />
                    <div>
                      <span style={{ fontSize: 12, color: '#1a1a18', fontWeight: 500 }}>{EVENT_LABEL[e.type] || 'Activity'}</span>
                      {who && <span style={{ fontSize: 12, color: '#6b6960' }}> — {who}</span>}
                      {e.summary && <div style={{ fontSize: 11, color: '#9b9890', marginTop: 2, lineHeight: 1.4 }}>{e.summary.slice(0, 120)}{e.summary.length > 120 ? '…' : ''}</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Priority sections ─────────────────────────────────────────────────────────

function TasksSection({ tasks }: { tasks: Task[] }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: '#9b9890', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Today's focus</p>
        <Link href="/tasks" style={{ fontSize: 13, color: '#9b9890', textDecoration: 'none' }}>See all</Link>
      </div>
      {tasks.length === 0 ? (
        <div style={{ background: 'white', borderRadius: 14, border: '0.5px solid rgba(0,0,0,0.07)', padding: 20, textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 14, color: '#9b9890' }}>All caught up — nothing due today</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tasks.map(task => (
            <Link key={task.id} href={`/tasks/${task.id}`} style={{ textDecoration: 'none' }}>
              <div style={{ background: 'white', borderRadius: 14, border: '0.5px solid rgba(0,0,0,0.07)', padding: '13px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: getTaskUrgency(task), flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: '#1a1a18' }}>{task.title}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: '#9b9890' }}>
                    {task.contacts?.full_name || task.deals?.name || ''}
                    {task.due_date && ` · ${new Date(task.due_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}`}
                  </p>
                </div>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="#c8c5be" strokeWidth="1.3" strokeLinecap="round"/></svg>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function PipelineSection({ deals }: { deals: Deal[] }) {
  const byStage = deals.reduce<Record<string, number>>((acc, d) => {
    acc[d.stage] = (acc[d.stage] || 0) + (d.value || 0)
    return acc
  }, {})
  const total = deals.reduce((s, d) => s + (d.value || 0), 0)

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: '#9b9890', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Pipeline</p>
        <Link href="/tracking" style={{ fontSize: 13, color: '#9b9890', textDecoration: 'none' }}>Open board</Link>
      </div>
      <div style={{ background: 'white', borderRadius: 14, border: '0.5px solid rgba(0,0,0,0.07)', padding: '16px 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
          <span style={{ fontSize: 22, fontWeight: 500, color: '#1a1a18' }}>{formatValue(total)}</span>
          <span style={{ fontSize: 12, color: '#9b9890' }}>{deals.length} active deals</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {Object.entries(byStage).map(([stage, value]) => (
            <div key={stage} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#6b6960', textTransform: 'capitalize' }}>{stage.replace('_', ' ')}</span>
              <span style={{ fontSize: 12, fontWeight: 500, color: '#1a1a18' }}>{formatValue(value)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function AtRiskSection({ deals }: { deals: Deal[] }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: '#9b9890', letterSpacing: '0.04em', textTransform: 'uppercase' }}>At-risk deals</p>
        <Link href="/tracking" style={{ fontSize: 13, color: '#9b9890', textDecoration: 'none' }}>See all</Link>
      </div>
      {deals.length === 0 ? (
        <div style={{ background: 'white', borderRadius: 14, border: '0.5px solid rgba(0,0,0,0.07)', padding: 20, textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 14, color: '#9b9890' }}>No at-risk deals right now</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {deals.map(deal => (
            <Link key={deal.id} href={`/tracking/deals/${deal.id}`} style={{ textDecoration: 'none' }}>
              <div style={{ background: 'white', borderRadius: 14, border: '0.5px solid rgba(0,0,0,0.07)', borderLeft: '2.5px solid #EF9F27', padding: '13px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: '#1a1a18' }}>{deal.name}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: '#9b9890' }}>Last activity {timeAgo(deal.last_activity_at)} · {formatValue(deal.value)}</p>
                </div>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="#c8c5be" strokeWidth="1.3" strokeLinecap="round"/></svg>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function RevenueSection({ deals }: { deals: Deal[] }) {
  const won = deals.filter(d => d.stage === 'closed_won').reduce((s, d) => s + (d.value || 0), 0)
  const pipeline = deals.filter(d => d.stage !== 'closed_won' && d.stage !== 'closed_lost').reduce((s, d) => s + (d.value || 0), 0)

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: '#9b9890', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Revenue</p>
        <Link href="/analytics" style={{ fontSize: 13, color: '#9b9890', textDecoration: 'none' }}>Full analytics</Link>
      </div>
      <div style={{ background: 'white', borderRadius: 14, border: '0.5px solid rgba(0,0,0,0.07)', padding: '16px 18px', display: 'flex', gap: 0 }}>
        {[
          { label: 'Closed', value: formatValue(won), color: '#1D9E75' },
          { label: 'Pipeline', value: formatValue(pipeline), color: '#1a1a18' },
        ].map((item, i) => (
          <div key={item.label} style={{ flex: 1, paddingLeft: i > 0 ? 16 : 0, borderLeft: i > 0 ? '0.5px solid rgba(0,0,0,0.07)' : 'none' }}>
            <p style={{ margin: '0 0 4px', fontSize: 12, color: '#9b9890' }}>{item.label}</p>
            <p style={{ margin: 0, fontSize: 20, fontWeight: 500, color: item.color }}>{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function HomeClient({ name, initials, tasks, events, deals, atRiskDeals, orgName, userRole, homePriority }: Props) {
  const greeting = () => {
    const messages = [
      'Tap Capture and sell with total freedom.',
      'Your AI is ready. Go close something.',
      'Snap, speak, screenshot — AI handles the rest.',
      'No forms. No friction. Just results.',
      'Liberate your sales day.',
    ]
    return messages[new Date().getDay() % messages.length]
  }

  // Build priority section order — priority section first, rest follow
  const prioritySections = {
    tasks:    <TasksSection tasks={tasks} />,
    pipeline: <PipelineSection deals={deals} />,
    at_risk:  <AtRiskSection deals={atRiskDeals} />,
    revenue:  <RevenueSection deals={deals} />,
  }

  const sectionOrder: HomePriority[] = [
    homePriority,
    ...(['tasks', 'pipeline', 'at_risk', 'revenue'] as HomePriority[]).filter(k => k !== homePriority),
  ]

  // On desktop show priority + activity chart side by side, rest below
  const [primarySection, ...restSections] = sectionOrder

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 }}>
        <div>
          <p style={{ margin: 0, fontSize: 13, color: '#9b9890' }} suppressHydrationWarning>
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 500, color: '#1a1a18', lineHeight: 1.3 }} suppressHydrationWarning>
            {greeting()}
          </p>
          {orgName && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <p style={{ margin: 0, fontSize: 13, color: '#9b9890' }}>{orgName}</p>
              <span style={{ fontSize: 10, color: '#9b9890', background: 'rgba(0,0,0,0.06)', borderRadius: 4, padding: '1px 6px', textTransform: 'capitalize' }}>{userRole}</span>
            </div>
          )}
        </div>
        <Link href="/settings" style={{ textDecoration: 'none' }}>
          <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#1a1a18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 500, color: '#f5f4f0', cursor: 'pointer' }}>
            {initials}
          </div>
        </Link>
      </div>

      {/* AI Nudges */}
      <AIProactiveNudges />

      {/* Shortcuts */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-7">
        {SHORTCUTS.map(s => (
          <Link key={s.href} href={s.href} style={{ textDecoration: 'none' }}>
            <div style={{ background: 'white', border: '0.5px solid rgba(0,0,0,0.07)', borderRadius: 14, padding: '16px 12px 14px', display: 'flex', flexDirection: 'column', gap: 10, cursor: 'pointer' }} className="shortcut-card">
              <div style={{ color: s.color }}>{s.icon}</div>
              <span style={{ fontSize: 12, fontWeight: 500, color: '#1a1a18' }}>{s.label}</span>
            </div>
          </Link>
        ))}
      </div>

      {/* Priority section + activity chart side by side on desktop */}
      <div className="md:grid md:grid-cols-2 md:gap-8">
        <div>{prioritySections[primarySection]}</div>
        <div style={{ marginBottom: 24 }}><ActivityChart events={events} /></div>
      </div>

      {/* Remaining sections — 2 col on desktop */}
      <div className="md:grid md:grid-cols-2 md:gap-8">
        {restSections.map(key => (
          <div key={key}>{prioritySections[key]}</div>
        ))}
      </div>

      <style>{`.shortcut-card:hover { box-shadow: 0 2px 12px rgba(0,0,0,0.08) !important; transform: translateY(-1px); }`}</style>
    </div>
  )
}