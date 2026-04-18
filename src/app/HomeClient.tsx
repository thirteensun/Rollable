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

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getTaskUrgency(task: Task): string {
  if (!task.due_date) return '#9b9890'
  const due = new Date(task.due_date)
  const now = new Date()
  if (due < now) return '#E24B4A'
  const hours = (due.getTime() - now.getTime()) / 3600000
  if (hours < 24) return '#EF9F27'
  return '#1D9E75'
}

// ─── Activity Chart ───────────────────────────────────────────────────────────
// Color drawn from project image: deep slate teal from the ocean
const CHART_COLOR = '#4a7a8a'

function ActivityChart({ events }: { events: Event[] }) {
  const countByDate = useMemo(() => {
    const map: Record<string, number> = {}
    events.forEach(e => {
      const date = e.created_at.split('T')[0]
      map[date] = (map[date] || 0) + 1
    })
    return map
  }, [events])

  // Always show exactly 16 weeks ending today — fills the card reliably
  const { cells, monthLabels } = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = today.toISOString().split('T')[0]
    const WEEKS = 16

    // Start 16 weeks ago aligned to Monday
    const start = new Date(today)
    start.setDate(start.getDate() - WEEKS * 7)
    const dow = start.getDay()
    start.setDate(start.getDate() - (dow === 0 ? 6 : dow - 1))

    const grid: { date: string; count: number; isToday: boolean; isFuture: boolean }[][] = []
    const cur = new Date(start)

    for (let w = 0; w < WEEKS; w++) {
      const col = []
      for (let d = 0; d < 7; d++) {
        const dateStr = cur.toISOString().split('T')[0]
        col.push({
          date: dateStr,
          count: countByDate[dateStr] || 0,
          isToday: dateStr === todayStr,
          isFuture: cur > today,
        })
        cur.setDate(cur.getDate() + 1)
      }
      grid.push(col)
    }

    // Month labels
    const labels: { label: string; col: number }[] = []
    let lastMonth = -1
    grid.forEach((col, ci) => {
      const month = new Date(col[0].date + 'T12:00:00').getMonth()
      if (month !== lastMonth) {
        labels.push({ label: new Date(col[0].date + 'T12:00:00').toLocaleString('default', { month: 'short' }), col: ci })
        lastMonth = month
      }
    })

    return { cells: grid, monthLabels: labels }
  }, [countByDate])

  const maxCount = useMemo(() => Math.max(...Object.values(countByDate), 1), [countByDate])
  const totalEvents = events.length
  const activeDays = Object.keys(countByDate).length

  // Use SVG for precise, responsive rendering — no flex width issues
  const COLS = cells.length
  const ROWS = 7
  const CELL = 11
  const GAP = 3
  const LABEL_W = 12
  const LABEL_H = 14
  const W = LABEL_W + COLS * (CELL + GAP) - GAP
  const H = LABEL_H + ROWS * (CELL + GAP) - GAP

  return (
    <div style={{ background: 'white', borderRadius: '14px', border: '0.5px solid rgba(0,0,0,0.07)', padding: '16px 18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <p style={{ margin: 0, fontSize: '12px', fontWeight: 500, color: '#9b9890', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Activity
        </p>
        <span style={{ fontSize: 11, color: '#9b9890' }}>{totalEvents} actions · {activeDays} active days</span>
      </div>

      <svg
        width="100%"
        viewBox={`0 0 ${W} ${H}`}
        style={{ display: 'block', overflow: 'visible' }}
      >
        {/* Month labels */}
        {monthLabels.map(({ label, col }) => (
          <text
            key={col}
            x={LABEL_W + col * (CELL + GAP)}
            y={10}
            fontSize={8}
            fill="#9b9890"
          >{label}</text>
        ))}

        {/* Day labels: Mon, Wed, Fri */}
        {['M','','W','','F','',''].map((d, i) => d ? (
          <text
            key={i}
            x={LABEL_W - 3}
            y={LABEL_H + i * (CELL + GAP) + CELL * 0.75}
            fontSize={7}
            fill="#9b9890"
            textAnchor="end"
          >{d}</text>
        ) : null)}

        {/* Cells */}
        {cells.map((col, ci) =>
          col.map((cell, ri) => {
            const x = LABEL_W + ci * (CELL + GAP)
            const y = LABEL_H + ri * (CELL + GAP)
            const intensity = cell.isFuture || cell.count === 0
              ? 0
              : Math.max(0.18, Math.min(1, cell.count / maxCount))

            let fill = 'rgba(0,0,0,0.05)'
            if (cell.isFuture) fill = 'none'
            else if (cell.count > 0) {
              // Interpolate from light teal to deep teal
              const r = Math.round(74 + (1 - intensity) * 160)
              const g = Math.round(122 + (1 - intensity) * 100)
              const b = Math.round(138 + (1 - intensity) * 80)
              fill = `rgb(${r},${g},${b})`
            }

            return (
              <g key={`${ci}-${ri}`}>
                <rect
                  x={x} y={y}
                  width={CELL} height={CELL}
                  rx={2.5}
                  fill={fill}
                  stroke={cell.isToday ? CHART_COLOR : 'none'}
                  strokeWidth={cell.isToday ? 1.5 : 0}
                />
                {cell.count > 0 && (
                  <title>{cell.date}: {cell.count} action{cell.count !== 1 ? 's' : ''}</title>
                )}
              </g>
            )
          })
        )}
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6, justifyContent: 'flex-end' }}>
        <span style={{ fontSize: 8, color: '#9b9890' }}>Less</span>
        {[0, 0.2, 0.45, 0.7, 1].map((intensity, i) => {
          const r = Math.round(74 + (1 - intensity) * 160)
          const g = Math.round(122 + (1 - intensity) * 100)
          const b = Math.round(138 + (1 - intensity) * 80)
          const bg = intensity === 0 ? 'rgba(0,0,0,0.05)' : `rgb(${r},${g},${b})`
          return <div key={i} style={{ width: 9, height: 9, borderRadius: 2, background: bg }} />
        })}
        <span style={{ fontSize: 8, color: '#9b9890' }}>More</span>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function HomeClient({ name, initials, tasks, events, deals, orgName, userRole }: Props) {
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

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '24px' }}>
        <div>
          <p style={{ margin: 0, fontSize: '13px', color: '#9b9890' }} suppressHydrationWarning>
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: '22px', fontWeight: 500, color: '#1a1a18', lineHeight: 1.3 }} suppressHydrationWarning>
            {greeting()}
          </p>
          {orgName && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
              <p style={{ margin: 0, fontSize: '13px', color: '#9b9890' }}>{orgName}</p>
              <span style={{
                fontSize: '10px', color: '#9b9890',
                background: 'rgba(0,0,0,0.06)', borderRadius: '4px',
                padding: '1px 6px', textTransform: 'capitalize',
              }}>
                {userRole}
              </span>
            </div>
          )}
        </div>
        <Link href="/settings" style={{ textDecoration: 'none' }}>
          <div style={{
            width: '38px', height: '38px', borderRadius: '50%',
            background: '#1a1a18', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '13px', fontWeight: 500,
            color: '#f5f4f0', cursor: 'pointer',
          }}>
            {initials}
          </div>
        </Link>
      </div>

      {/* AI Nudges */}
      <AIProactiveNudges />

      {/* Quick shortcuts — ElevenLabs style square cards */}
      <div style={{ marginBottom: 28 }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          gap: 10,
        }} className="shortcuts-grid">
          {[
            {
              href: '/capture',
              label: 'Capture',
              bg: '#c8dfe6',
              icon: (
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                  <circle cx="14" cy="14" r="11" stroke="#2e6878" strokeWidth="1.6"/>
                  <path d="M14 8v12M8 14h12" stroke="#2e6878" strokeWidth="1.6" strokeLinecap="round"/>
                </svg>
              ),
            },
            {
              href: '/tracking',
              label: 'Pipeline',
              bg: '#d6e8ed',
              icon: (
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                  <rect x="2" y="5" width="7" height="18" rx="2.5" fill="#2e6878" opacity="0.6"/>
                  <rect x="11" y="5" width="7" height="12" rx="2.5" fill="#2e6878" opacity="0.8"/>
                  <rect x="20" y="5" width="6" height="15" rx="2.5" fill="#2e6878"/>
                </svg>
              ),
            },
            {
              href: '/tasks',
              label: 'Tasks',
              bg: '#d8ebe4',
              icon: (
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                  <rect x="3" y="3" width="22" height="22" rx="5" stroke="#4a8a6a" strokeWidth="1.6"/>
                  <path d="M9 14l4 4 7-7" stroke="#4a8a6a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ),
            },
            {
              href: '/ai-sandbox',
              label: 'AI Sandbox',
              bg: '#eee5d0',
              icon: (
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                  <path d="M3 14h4l3-7 4 14 3-7h4l3 4" stroke="#a08840" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ),
            },
            {
              href: '/analytics',
              label: 'Analytics',
              bg: '#dce8ed',
              icon: (
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                  <path d="M4 22L10 14l5 4 5-9 4 5" stroke="#a06050" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ),
            },
            {
              href: '/contacts',
              label: 'Contacts',
              bg: '#e2ddd4',
              icon: (
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                  <circle cx="14" cy="10" r="5" stroke="#7a6aaa" strokeWidth="1.6"/>
                  <path d="M4 25c0-5.5 4.5-9 10-9s10 3.5 10 9" stroke="#7a6aaa" strokeWidth="1.6" strokeLinecap="round"/>
                </svg>
              ),
            },
          ].map((s) => (
            <Link key={s.href} href={s.href} style={{ textDecoration: 'none' }}>
              <div style={{
                background: s.bg,
                borderRadius: 16,
                padding: '20px 14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                cursor: 'pointer',
                transition: 'transform 0.15s, box-shadow 0.15s',
                border: '0.5px solid rgba(0,0,0,0.06)',
                aspectRatio: '1',
                justifyContent: 'space-between',
              }} className="shortcut-card">
                <div>{s.icon}</div>
                <span style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: '#1a1a18',
                  lineHeight: 1.2,
                }}>{s.label}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Desktop: two columns / Mobile: single column */}
      <div className="md:grid md:grid-cols-2 md:gap-8">

        {/* Today's focus */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <p style={{ margin: 0, fontSize: '12px', fontWeight: 500, color: '#9b9890', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Today's focus
            </p>
            <Link href="/tasks" style={{ fontSize: '13px', color: '#9b9890', textDecoration: 'none' }}>
              See all
            </Link>
          </div>

          {tasks.length === 0 ? (
            <div style={{
              background: 'white', borderRadius: '14px',
              border: '0.5px solid rgba(0,0,0,0.07)',
              padding: '20px', textAlign: 'center',
            }}>
              <p style={{ margin: 0, fontSize: '14px', color: '#9b9890' }}>All caught up — nothing due today</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {tasks.map((task, i) => (
                <Link key={task.id} href={`/tasks/${task.id}`} style={{ textDecoration: 'none' }}>
                  <div style={{
                    background: 'white', borderRadius: '14px',
                    border: '0.5px solid rgba(0,0,0,0.07)',
                    padding: '13px 14px', display: 'flex',
                    alignItems: 'center', gap: '12px', cursor: 'pointer',
                  }}>
                    <div style={{
                      width: '8px', height: '8px', borderRadius: '50%',
                      background: getTaskUrgency(task), flexShrink: 0,
                    }} />
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: '#1a1a18' }}>{task.title}</p>
                      <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#9b9890' }}>
                        {task.contacts?.full_name || task.deals?.name || ''}
                        {task.due_date && ` · ${new Date(task.due_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}`}
                      </p>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <path d="M6 4l4 4-4 4" stroke="#c8c5be" strokeWidth="1.3" strokeLinecap="round" />
                    </svg>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Activity chart — replaces recent activity */}
        <div style={{ marginBottom: '24px' }}>
          <ActivityChart events={events} />
        </div>

      </div>
    <style>{`
      .shortcut-card:hover { transform: translateY(-2px); box-shadow: 0 4px 16px rgba(0,0,0,0.08) !important; }
      @media (max-width: 768px) { .shortcuts-grid { grid-template-columns: repeat(3, 1fr) !important; } }
    `}</style>
    </div>
  )
}