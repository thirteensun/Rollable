'use client'

import Link from 'next/link'
import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { type HomePriority } from '@/lib/stage-templates'

// ─── Nudge types (inline — no longer needs separate component) ────────────────
interface Nudge {
  id: string
  type: 'stalled_deal' | 'overdue_followup' | 'closing_soon' | 'uninvoiced_won' | 'relationship_decay'
  urgency: 'high' | 'medium' | 'low'
  title: string
  body: string
  deal?: { id: string; name: string; value: number | null; stage: string; currency?: string }
  contact?: { id: string; full_name: string; role: string | null }
  company?: { id: string; name: string } | null
  days: number
  action_label: string
  action_href: string
}

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
  avatar?: string
  tasks: Task[]
  events: Event[]
  deals: Deal[]
  atRiskDeals: Deal[]
  orgName: string | null
  userRole: string
  homePriority: HomePriority
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getTaskUrgency(task: Task): { color: string; label: string } {
  if (!task.due_date) return { color: '#c8c5be', label: 'No date' }
  const due = new Date(task.due_date)
  const now = new Date()
  if (due < now) return { color: '#E24B4A', label: 'Overdue' }
  const hours = (due.getTime() - now.getTime()) / 3600000
  if (hours < 24) return { color: '#EF9F27', label: 'Due today' }
  return { color: '#1D9E75', label: 'Upcoming' }
}

const EVENT_LABEL: Record<string, string> = {
  meeting: 'Meeting', call: 'Call', email: 'Email',
  whatsapp: 'WhatsApp', note: 'Note', card_scan: 'Card scan',
  voice_memo: 'Voice memo', other: 'Activity',
}

function formatValue(v?: number | null, currency = 'EUR') {
  if (!v) return null
  return new Intl.NumberFormat('en', {
    style: 'currency', currency,
    maximumFractionDigits: 0, notation: 'compact',
  }).format(v)
}

const NUDGE_META: Record<Nudge['type'], { label: string; icon: React.ReactNode }> = {
  stalled_deal: {
    label: 'Stalled',
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  },
  overdue_followup: {
    label: 'Follow-up due',
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  },
  closing_soon: {
    label: 'Closing soon',
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  },
  uninvoiced_won: {
    label: 'Invoice needed',
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  },
  relationship_decay: {
    label: 'Gone quiet',
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  },
}

const URGENCY_STYLE: Record<Nudge['urgency'], { accent: string; bg: string; border: string }> = {
  high:   { accent: '#E24B4A', bg: 'rgba(226,75,74,0.06)',  border: 'rgba(226,75,74,0.15)' },
  medium: { accent: '#EF9F27', bg: 'rgba(239,159,39,0.06)', border: 'rgba(239,159,39,0.2)' },
  low:    { accent: '#9b9890', bg: 'rgba(0,0,0,0.02)',      border: 'rgba(0,0,0,0.07)' },
}

const CHART_COLOR_BASE = [74, 122, 138]
const TOTAL_WEEKS = 52

function activityColor(intensity: number): string {
  if (intensity === 0) return 'rgba(0,0,0,0.055)'
  const [r, g, b] = CHART_COLOR_BASE
  return `rgb(${Math.round(r + (1 - intensity) * 148)},${Math.round(g + (1 - intensity) * 98)},${Math.round(b + (1 - intensity) * 80)})`
}

// ─── Shared shell components ──────────────────────────────────────────────────
function CollapseBtn({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <motion.button
      onClick={onToggle}
      whileTap={{ scale: 0.85 }}
      style={{
        width: 24, height: 24, borderRadius: 7,
        border: '0.5px solid rgba(0,0,0,0.08)',
        background: 'rgba(0,0,0,0.03)',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}
    >
      <motion.svg width="10" height="10" viewBox="0 0 10 10"
        animate={{ rotate: collapsed ? 180 : 0 }}
        transition={{ type: 'spring', stiffness: 420, damping: 28 }}
      >
        <path d="M2 3.5L5 6.5L8 3.5" stroke="#9b9890" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      </motion.svg>
    </motion.button>
  )
}

function SlideBody({ visible, children }: { visible: boolean; children: React.ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {visible && (
        <motion.div
          key="body"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ height: { duration: 0.26, ease: [0.4, 0, 0.2, 1] }, opacity: { duration: 0.16 } }}
          style={{ overflow: 'hidden' }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function SectionShell({
  label, badge, badgeColor, link, linkLabel, collapsed, onToggle, children, stretch,
}: {
  label: string
  badge?: string
  badgeColor?: string
  link?: string
  linkLabel?: string
  collapsed: boolean
  onToggle: () => void
  children: React.ReactNode
  stretch?: boolean
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      style={{
        background: 'white',
        borderRadius: 16,
        border: '0.5px solid rgba(0,0,0,0.07)',
        overflow: 'hidden',
        marginBottom: 16,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        ...(stretch ? { flex: 1, display: 'flex', flexDirection: 'column' } : {}),
      }}
    >
      <div style={{
        padding: '13px 16px',
        borderBottom: collapsed ? 'none' : '0.5px solid rgba(0,0,0,0.06)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        {/* Label */}
        <span style={{ fontSize: 11, fontWeight: 600, color: '#9b9890', letterSpacing: '0.06em', textTransform: 'uppercase', flex: 1 }}>
          {label}
        </span>

        {/* Badge — mini stat when expanded, full stat when collapsed */}
        <AnimatePresence mode="wait">
          {badge && (
            <motion.span
              key={badge}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.12 }}
              style={{
                fontSize: 12, fontWeight: 500,
                color: badgeColor || '#6b6960',
              }}
            >
              {badge}
            </motion.span>
          )}
        </AnimatePresence>

        {link && linkLabel && !collapsed && (
          <Link href={link} style={{ fontSize: 11, color: '#9b9890', textDecoration: 'none', fontWeight: 500 }}>
            {linkLabel} →
          </Link>
        )}
        <CollapseBtn collapsed={collapsed} onToggle={onToggle} />
      </div>
      <SlideBody visible={!collapsed}>
        <div style={{ padding: '14px 16px 16px' }}>
          {children}
        </div>
      </SlideBody>
    </motion.div>
  )
}

// ─── AI Signals section ───────────────────────────────────────────────────────
function AISignalsSection({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const [nudges, setNudges] = useState<Nudge[]>([])
  const [loading, setLoading] = useState(true)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch('/api/nudges')
      .then(r => r.json())
      .then(data => { setNudges(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const visible = nudges.filter(n => !dismissed.has(n.id))
  const dismiss = (id: string) => setDismissed(prev => new Set([...Array.from(prev), id]))

  if (!loading && visible.length === 0) return null

  const badge = loading ? '…' : `${visible.length} signal${visible.length !== 1 ? 's' : ''}`
  const badgeColor = visible.some(n => n.urgency === 'high') ? '#E24B4A' : '#EF9F27'

  return (
    <SectionShell
      label="AI Signals"
      badge={badge}
      badgeColor={badgeColor}
      collapsed={collapsed}
      onToggle={onToggle}
      stretch
    >
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1, 2].map(i => (
            <div key={i} style={{ height: 64, borderRadius: 12, background: 'rgba(0,0,0,0.04)', animation: 'pulse 1.6s ease-in-out infinite' }} />
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {visible.map((nudge, idx) => {
            const meta = NUDGE_META[nudge.type]
            const style = URGENCY_STYLE[nudge.urgency]
            const value = formatValue(nudge.deal?.value, nudge.deal?.currency)
            const subName = nudge.contact?.full_name ?? nudge.company?.name ?? null
            const initials = subName
              ? subName.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
              : null

            return (
              <motion.div
                key={nudge.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05, duration: 0.2 }}
                style={{
                  borderRadius: 12,
                  border: `0.5px solid ${style.border}`,
                  background: style.bg,
                  overflow: 'hidden',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'stretch' }}>
                  {/* Urgency stripe */}
                  <div style={{ width: 3, background: style.accent, flexShrink: 0, borderRadius: '12px 0 0 12px' }} />

                  <div style={{ flex: 1, padding: '10px 12px', minWidth: 0 }}>
                    {/* Top row: type tag + value */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: style.accent }}>
                        {meta.icon}
                        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: style.accent }}>
                          {meta.label}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {value && (
                          <span style={{
                            fontSize: 11, fontWeight: 600, color: '#1a1a18',
                            background: 'rgba(0,0,0,0.06)', borderRadius: 5,
                            padding: '2px 7px',
                          }}>
                            {value}
                          </span>
                        )}
                        <button
                          onClick={() => dismiss(nudge.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#c8c5be', display: 'flex', lineHeight: 1 }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                        </button>
                      </div>
                    </div>

                    {/* Title + body */}
                    <Link href={nudge.action_href} style={{ textDecoration: 'none', display: 'block' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a18', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {nudge.title}
                      </div>
                      <div style={{ fontSize: 12, color: '#6b6960', lineHeight: 1.4, marginBottom: subName ? 7 : 0 }}>
                        {nudge.body}
                      </div>

                      {/* Sub-entity row */}
                      {subName && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{
                            width: 18, height: 18, borderRadius: '50%',
                            background: 'rgba(0,0,0,0.08)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 9, fontWeight: 600, color: '#6b6960', flexShrink: 0,
                          }}>
                            {initials}
                          </div>
                          <span style={{ fontSize: 11, color: '#9b9890' }}>
                            {subName}{nudge.contact?.role ? ` · ${nudge.contact.role}` : ''}
                          </span>
                          <span style={{ fontSize: 11, color: style.accent, marginLeft: 'auto', fontWeight: 500 }}>
                            {nudge.action_label} →
                          </span>
                        </div>
                      )}
                      {!subName && (
                        <span style={{ fontSize: 11, color: style.accent, fontWeight: 500 }}>
                          {nudge.action_label} →
                        </span>
                      )}
                    </Link>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </SectionShell>
  )
}

// ─── Tasks section ────────────────────────────────────────────────────────────
function TasksSection({ tasks, collapsed, onToggle }: { tasks: Task[]; collapsed: boolean; onToggle: () => void }) {
  const overdue = tasks.filter(t => t.due_date && new Date(t.due_date) < new Date()).length
  const badge = tasks.length === 0 ? 'all clear' : overdue > 0 ? `${overdue} overdue` : `${tasks.length} due`
  const badgeColor = overdue > 0 ? '#E24B4A' : tasks.length > 0 ? '#1D9E75' : '#9b9890'

  return (
    <SectionShell label="Today's focus" badge={badge} badgeColor={badgeColor} link="/tasks" linkLabel="All tasks" collapsed={collapsed} onToggle={onToggle}>
      {tasks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '12px 0' }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(29,158,117,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: '#9b9890' }}>All caught up</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {tasks.map((task, idx) => {
            const urgency = getTaskUrgency(task)
            return (
              <Link key={task.id} href={`/tasks/${task.id}`} style={{ textDecoration: 'none' }}>
                <motion.div
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.04 }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '9px 10px', borderRadius: 10,
                    transition: 'background 0.15s ease',
                  }}
                  whileHover={{ backgroundColor: 'rgba(0,0,0,0.025)' }}
                >
                  {/* Urgency dot */}
                  <div style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: urgency.color, flexShrink: 0,
                    boxShadow: `0 0 0 2px ${urgency.color}22`,
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: '#1a1a18', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {task.title}
                    </p>
                    <p style={{ margin: '1px 0 0', fontSize: 11, color: '#9b9890' }}>
                      {[task.contacts?.full_name || task.deals?.name, task.due_date && new Date(task.due_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="#c8c5be" strokeWidth="1.4" strokeLinecap="round"/></svg>
                </motion.div>
              </Link>
            )
          })}
        </div>
      )}
    </SectionShell>
  )
}

// ─── Activity chart ───────────────────────────────────────────────────────────
function ActivitySection({ events, collapsed, onToggle }: { events: Event[]; collapsed: boolean; onToggle: () => void }) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    // setTimeout gives React time to finish rendering the full grid width
    const t = setTimeout(() => { el.scrollLeft = el.scrollWidth }, 50)
    return () => clearTimeout(t)
  }, [events])

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
    const today = new Date(); today.setHours(0, 0, 0, 0)
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
  const activeDays = Object.keys(countByDate).length
  const badge = `${events.length} logged · ${activeDays}d active`
  const CELL = 12; const GAP = 3

  return (
    <SectionShell label="Activity" badge={badge} badgeColor="#6b6960" collapsed={collapsed} onToggle={onToggle}>
      <div ref={scrollRef} style={{ overflowX: 'auto', overflowY: 'hidden', paddingBottom: 2, marginBottom: 2 }}>
        <div style={{ width: 'max-content' }}>
          {/* Month labels */}
          <div style={{ display: 'flex', marginBottom: 3, paddingLeft: 18 }}>
            {weeks.map((col, ci) => {
              const ml = monthLabels.find(m => m.col === ci)
              return <div key={ci} style={{ width: CELL + GAP, flexShrink: 0, fontSize: 8.5, color: '#b5b2aa' }}>{ml ? ml.label : ''}</div>
            })}
          </div>
          <div style={{ display: 'flex', gap: GAP }}>
            {/* Day labels */}
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: 14, flexShrink: 0, paddingTop: 1 }}>
              {['M', '', 'W', '', 'F', '', ''].map((d, i) => (
                <div key={i} style={{ height: CELL, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 2 }}>
                  <span style={{ fontSize: 7.5, color: '#b5b2aa' }}>{d}</span>
                </div>
              ))}
            </div>
            {weeks.map((col, ci) => (
              <div key={ci} style={{ display: 'flex', flexDirection: 'column', gap: GAP }}>
                {col.map((cell, ri) => {
                  const intensity = cell.count === 0 ? 0 : Math.max(0.18, Math.min(1, cell.count / maxCount))
                  const isSelected = selectedDate === cell.date
                  return (
                    <div
                      key={ri}
                      onClick={() => setSelectedDate(isSelected ? null : cell.date)}
                      style={{
                        width: CELL, height: CELL, borderRadius: 3,
                        background: activityColor(intensity),
                        border: cell.isToday ? '1.5px solid #4a7a8a' : isSelected ? '1.5px solid #1a1a18' : 'none',
                        boxSizing: 'border-box',
                        cursor: cell.count > 0 ? 'pointer' : 'default',
                        flexShrink: 0,
                        transition: 'transform 0.1s ease',
                      }}
                    />
                  )
                })}
                {Array.from({ length: 7 - col.length }).map((_, i) => (
                  <div key={`pad-${i}`} style={{ width: CELL, height: CELL, flexShrink: 0 }} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 3, justifyContent: 'flex-end', marginTop: 8 }}>
        <span style={{ fontSize: 8, color: '#b5b2aa' }}>Less</span>
        {[0, 0.2, 0.45, 0.7, 1].map((v, i) => (
          <div key={i} style={{ width: 9, height: 9, borderRadius: 2, background: activityColor(v) }} />
        ))}
        <span style={{ fontSize: 8, color: '#b5b2aa' }}>More</span>
      </div>

      {/* Selected date events */}
      <AnimatePresence>
        {selectedDate && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ height: { duration: 0.2 }, opacity: { duration: 0.14 } }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ borderTop: '0.5px solid rgba(0,0,0,0.06)', paddingTop: 12, marginTop: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#9b9890', marginBottom: 8, letterSpacing: '0.02em' }}>
                {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}
              </div>
              {(eventsByDate[selectedDate] || []).length === 0 ? (
                <p style={{ margin: 0, fontSize: 12, color: '#9b9890' }}>No activity logged</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {(eventsByDate[selectedDate] || []).map(e => {
                    const who = e.contacts?.[0]?.full_name || e.companies?.[0]?.name || e.deals?.[0]?.name || null
                    return (
                      <div key={e.id} style={{ display: 'flex', gap: 9 }}>
                        <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#4a7a8a', flexShrink: 0, marginTop: 5 }} />
                        <div>
                          <span style={{ fontSize: 12, fontWeight: 500, color: '#1a1a18' }}>{EVENT_LABEL[e.type] || 'Activity'}</span>
                          {who && <span style={{ fontSize: 12, color: '#6b6960' }}> · {who}</span>}
                          {e.summary && <div style={{ fontSize: 11, color: '#9b9890', marginTop: 2, lineHeight: 1.4 }}>{e.summary.slice(0, 120)}{e.summary.length > 120 ? '…' : ''}</div>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </SectionShell>
  )
}

// ─── Shortcuts ────────────────────────────────────────────────────────────────
const SHORTCUTS = [
  { href: '/capture',    label: 'Capture',    color: '#4a7a8a', icon: <svg width="20" height="20" viewBox="0 0 22 22" fill="none"><circle cx="11" cy="11" r="9" stroke="currentColor" strokeWidth="1.5"/><path d="M11 6v10M6 11h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
  { href: '/tasks',      label: 'Tasks',      color: '#4a8a6a', icon: <svg width="20" height="20" viewBox="0 0 22 22" fill="none"><rect x="2" y="2" width="18" height="18" rx="4" stroke="currentColor" strokeWidth="1.5"/><path d="M7 11l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  { href: '/analytics',  label: 'Analytics',  color: '#8a5040', icon: <svg width="20" height="20" viewBox="0 0 22 22" fill="none"><path d="M2 17L7 10l4.5 3.5L16 6l4 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  { href: '/contacts',   label: 'Contacts',   color: '#6a5aaa', icon: <svg width="20" height="20" viewBox="0 0 22 22" fill="none"><circle cx="11" cy="8" r="4" stroke="currentColor" strokeWidth="1.5"/><path d="M3 20c0-4.4 3.6-7 8-7s8 2.6 8 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
  { href: '/companies',  label: 'Companies',  color: '#5a7a5a', icon: <svg width="20" height="20" viewBox="0 0 22 22" fill="none"><rect x="2" y="7" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M15 7V5a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v2" stroke="currentColor" strokeWidth="1.5"/></svg> },
  { href: '/deals',      label: 'Deals',      color: '#7a5a8a', icon: <svg width="20" height="20" viewBox="0 0 22 22" fill="none"><path d="M11 2L2 6.5l9 4.5 9-4.5L11 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M2 15.5l9 4.5 9-4.5M2 11l9 4.5 9-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg> },
]

// ─── Greetings ────────────────────────────────────────────────────────────────
const GREETINGS = [
  'Tap Capture and sell with total freedom.',
  'Your AI is ready. Go close something.',
  'Snap, speak, screenshot — AI handles the rest.',
  'No forms. No friction. Just results.',
  'Liberate your sales day.',
]

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function HomeClient({ name, initials, avatar, tasks, events, deals, atRiskDeals, orgName, userRole, homePriority }: Props) {
  const greeting = GREETINGS[new Date().getDay() % GREETINGS.length]

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    signals: false, tasks: false, activity: false,
  })
  const toggle = useCallback((key: string) => {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }))
  }, [])

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <p style={{ margin: 0, fontSize: 12, color: '#9b9890', letterSpacing: '0.02em' }} suppressHydrationWarning>
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}
          </p>
          <p style={{ margin: '5px 0 0', fontSize: 21, fontWeight: 500, color: '#1a1a18', lineHeight: 1.25 }} suppressHydrationWarning>
            {greeting}
          </p>
          {orgName && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
              <span style={{ fontSize: 12, color: '#9b9890' }}>{orgName}</span>
              <span style={{
                fontSize: 9, fontWeight: 600, color: '#9b9890',
                background: 'rgba(0,0,0,0.06)', borderRadius: 4,
                padding: '2px 6px', textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>
                {userRole}
              </span>
            </div>
          )}
        </div>
        <Link href="/settings" style={{ textDecoration: 'none', flexShrink: 0 }}>
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            style={{
              width: 38, height: 38, borderRadius: '50%',
              background: '#1a1a18',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 600, color: '#f5f4f0',
              cursor: 'pointer', overflow: 'hidden',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            }}
          >
            {avatar
              ? <img src={avatar} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
              : initials
            }
          </motion.div>
        </Link>
      </div>

      {/* ── Shortcuts ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 20 }} className="md:grid-cols-6">
        {SHORTCUTS.map((s, i) => (
          <Link key={s.href} href={s.href} style={{ textDecoration: 'none' }}>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              whileHover={{ y: -2, boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}
              whileTap={{ scale: 0.97 }}
              style={{
                background: 'white',
                border: '0.5px solid rgba(0,0,0,0.07)',
                borderRadius: 14,
                padding: '14px 12px 12px',
                display: 'flex', flexDirection: 'column', gap: 8,
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}
            >
              <div style={{ color: s.color }}>{s.icon}</div>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#1a1a18', letterSpacing: '0.01em' }}>{s.label}</span>
            </motion.div>
          </Link>
        ))}
      </div>

      {/* ── Two-column layout on desktop ── */}
      <div className="md:flex md:gap-5 md:items-start">
        {/* Left — Tasks + Activity */}
        <div className="md:flex-1 md:min-w-0">
          <TasksSection
            tasks={tasks}
            collapsed={collapsed.tasks}
            onToggle={() => toggle('tasks')}
          />
          <ActivitySection
            events={events}
            collapsed={collapsed.activity}
            onToggle={() => toggle('activity')}
          />
        </div>

        {/* Right — Signals alone, stretches to match left height */}
        <div className="md:flex-1 md:min-w-0 md:self-stretch md:flex md:flex-col">
          <AISignalsSection
            collapsed={collapsed.signals}
            onToggle={() => toggle('signals')}
          />
        </div>
      </div>

      <style>{`
        @media (min-width: 768px) {
          .md\\:grid-cols-6 { grid-template-columns: repeat(6, 1fr) !important; }
          .md\\:flex { display: flex !important; }
          .md\\:gap-5 { gap: 20px !important; }
          .md\\:items-start { align-items: flex-start !important; }
          .md\\:flex-1 { flex: 1 !important; }
          .md\\:min-w-0 { min-width: 0 !important; }
          .md\\:self-stretch { align-self: stretch !important; }
          .md\\:flex-col { flex-direction: column !important; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        button { font-family: inherit; }
      `}</style>
    </div>
  )
}