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
function ActivityChart({ events }: { events: Event[] }) {
  const countByDate = useMemo(() => {
    const map: Record<string, number> = {}
    events.forEach(e => {
      const date = e.created_at.split('T')[0]
      map[date] = (map[date] || 0) + 1
    })
    return map
  }, [events])

  const cells = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = today.toISOString().split('T')[0]

    // Go back 13 weeks, aligned to Monday
    const start = new Date(today)
    start.setDate(start.getDate() - 90)
    const dow = start.getDay()
    start.setDate(start.getDate() - (dow === 0 ? 6 : dow - 1))

    const grid: { date: string; count: number; isToday: boolean; isFuture: boolean }[][] = []
    const current = new Date(start)

    for (let week = 0; week < 14; week++) {
      const col = []
      for (let day = 0; day < 7; day++) {
        const dateStr = current.toISOString().split('T')[0]
        col.push({
          date: dateStr,
          count: countByDate[dateStr] || 0,
          isToday: dateStr === todayStr,
          isFuture: new Date(dateStr) > today,
        })
        current.setDate(current.getDate() + 1)
      }
      grid.push(col)
    }
    return grid
  }, [countByDate])

  const maxCount = useMemo(() => Math.max(...Object.values(countByDate), 1), [countByDate])
  const totalEvents = events.length
  const activeDays = Object.keys(countByDate).length

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
    <div style={{ background: 'white', borderRadius: '14px', border: '0.5px solid rgba(0,0,0,0.07)', padding: '16px 18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <p style={{ margin: 0, fontSize: '12px', fontWeight: 500, color: '#9b9890', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Activity
        </p>
        <span style={{ fontSize: 11, color: '#9b9890' }}>{totalEvents} actions · {activeDays} active days</span>
      </div>

      {/* Month labels */}
      <div style={{ display: 'flex', marginBottom: 4, paddingLeft: 16 }}>
        {cells.map((_, ci) => {
          const label = monthLabels.find(m => m.col === ci)
          return (
            <div key={ci} style={{ width: cellSize + gap, flexShrink: 0 }}>
              {label && <span style={{ fontSize: 8, color: '#9b9890' }}>{label.label}</span>}
            </div>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap, alignItems: 'flex-start' }}>
        {/* Day labels */}
        <div style={{ display: 'flex', flexDirection: 'column', gap, marginRight: 2 }}>
          {['M', '', 'W', '', 'F', '', ''].map((d, i) => (
            <div key={i} style={{ width: 10, height: cellSize, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
              <span style={{ fontSize: 7, color: '#9b9890' }}>{d}</span>
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
                    width: cellSize, height: cellSize, borderRadius: 3,
                    background: bg,
                    border: cell.isToday ? '1.5px solid #1a1a18' : 'none',
                    boxSizing: 'border-box',
                  }}
                />
              )
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8, justifyContent: 'flex-end' }}>
        <span style={{ fontSize: 8, color: '#9b9890' }}>Less</span>
        {[0, 0.15, 0.35, 0.6, 0.9].map((op, i) => (
          <div key={i} style={{ width: 9, height: 9, borderRadius: 2, background: op === 0 ? 'rgba(0,0,0,0.05)' : `rgba(26,26,24,${op})` }} />
        ))}
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
    </div>
  )
}