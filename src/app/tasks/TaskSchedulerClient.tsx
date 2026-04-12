'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

type Task = {
  id: string
  title?: string
  status?: string
  due_date?: string
  priority?: string
  deal_id?: string
  contact_id?: string
  created_at: string
}

type Deal = { id: string; name: string; stage: string }
type Contact = { id: string; full_name: string }

type Props = {
  tasks: Task[]
  deals: Deal[]
  contacts: Contact[]
}

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    setIsDesktop(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return isDesktop
}

function dateKey(d: Date) { return d.toISOString().slice(0, 10) }
function isToday(d: Date) { return dateKey(d) === dateKey(new Date()) }
function isPast(d: Date) {
  const today = new Date(); today.setHours(0,0,0,0); return d < today
}
function taskDateKey(task: Task) { return task.due_date ? task.due_date.slice(0, 10) : null }
function isOverdue(task: Task) {
  if (!task.due_date || task.status === 'done') return false
  return task.due_date.slice(0, 10) < dateKey(new Date())
}

function getWeekDays(offset = 0): Date[] {
  const now = new Date()
  const monday = new Date(now)
  monday.setDate(now.getDate() - now.getDay() + 1 + offset * 7)
  monday.setHours(0, 0, 0, 0)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

function getMonthDays(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  const startPad = (first.getDay() + 6) % 7
  const days: (Date | null)[] = []
  for (let i = 0; i < startPad; i++) days.push(null)
  for (let d = 1; d <= last.getDate(); d++) days.push(new Date(year, month, d))
  while (days.length % 7 !== 0) days.push(null)
  return days
}

const PRIORITY_COLOR: Record<string, string> = {
  high: '#E24B4A', medium: '#EF9F27', low: '#9b9890',
}

// ── Confirm Modal ──────────────────────────────────────────────────────────────
function ConfirmCaptureModal({ date, onConfirm, onCancel }: {
  date: string
  onConfirm: () => void
  onCancel: () => void
}) {
  const formatted = new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric'
  })
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.3)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onCancel}>
      <div style={{
        background: 'white', borderRadius: 20, padding: 24, width: 320,
        display: 'flex', flexDirection: 'column', gap: 16,
      }} onClick={e => e.stopPropagation()}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 500, color: '#1a1a18', marginBottom: 6 }}>Add task</div>
          <div style={{ fontSize: 13, color: '#6b6960' }}>
            Go to Capture to add a new task for <strong>{formatted}</strong>?
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{
            background: '#f5f4f0', border: 'none', borderRadius: 10,
            padding: '9px 16px', fontSize: 13, color: '#6b6960', cursor: 'pointer',
          }}>Cancel</button>
          <button onClick={onConfirm} style={{
            background: '#1a1a18', border: 'none', borderRadius: 10,
            padding: '9px 16px', fontSize: 13, fontWeight: 500, color: 'white', cursor: 'pointer',
          }}>Go to Capture</button>
        </div>
      </div>
    </div>
  )
}

// ── Task Chip ──────────────────────────────────────────────────────────────────
function TaskChip({ task, onToggle, compact = false }: {
  task: Task
  onToggle: (id: string, done: boolean) => void
  compact?: boolean
}) {
  const done = task.status === 'done'
  const overdue = isOverdue(task)
  const priorityColor = task.priority ? PRIORITY_COLOR[task.priority] : undefined

  return (
    <div style={{
      background: overdue ? '#fdeaea' : done ? 'transparent' : '#f5f4f0',
      borderRadius: 8, padding: compact ? '4px 7px' : '7px 9px',
      display: 'flex', alignItems: 'flex-start', gap: 6,
      borderLeft: priorityColor && !done ? `2px solid ${priorityColor}` : '2px solid transparent',
      opacity: done ? 0.5 : 1, transition: 'opacity 0.2s', marginBottom: 3,
    }}>
      {/* Checkbox */}
      <div
        onClick={() => onToggle(task.id, !done)}
        style={{
          width: 13, height: 13, borderRadius: 4, flexShrink: 0, marginTop: 1,
          border: done ? 'none' : '1.5px solid rgba(0,0,0,0.2)',
          background: done ? '#1D9E75' : 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        {done && <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4L3 5.5L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
      </div>
      {/* Title — links to task detail */}
      <Link href={`/tasks/${task.id}`} style={{
        fontSize: compact ? 10 : 11, lineHeight: 1.4, flex: 1,
        color: overdue ? '#E24B4A' : done ? '#9b9890' : '#1a1a18',
        textDecoration: done ? 'line-through' : 'none',
      }} onClick={e => e.stopPropagation()}>
        {task.title ?? 'Untitled'}
      </Link>
    </div>
  )
}

// ── Week View ──────────────────────────────────────────────────────────────────
function WeekView({ tasks, weekOffset, onToggle, onDayClick }: {
  tasks: Task[]; weekOffset: number
  onToggle: (id: string, done: boolean) => void
  onDayClick: (date: string) => void
}) {
  const days = getWeekDays(weekOffset)
  const overdueTasks = tasks.filter(isOverdue)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ padding: '10px 16px 6px', fontSize: 12, color: '#9b9890', flexShrink: 0 }} suppressHydrationWarning>
        {days[0].toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
      </div>

      {overdueTasks.length > 0 && weekOffset === 0 && (
        <div style={{ margin: '0 16px 10px', background: '#fdeaea', border: '0.5px solid rgba(226,75,74,0.2)', borderRadius: 12, padding: '10px 14px', flexShrink: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: '#E24B4A', marginBottom: 6 }}>Overdue · {overdueTasks.length}</div>
          {overdueTasks.map(t => <TaskChip key={t.id} task={t} onToggle={onToggle} compact />)}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, padding: '0 16px 16px', flex: 1, overflow: 'hidden' }}>
        {days.map(day => {
          const key = dateKey(day)
          const dayTasks = tasks.filter(t => taskDateKey(t) === key && !isOverdue(t))
          const today = isToday(day)
          const past = isPast(day)
          return (
            <div key={key} onClick={() => onDayClick(key)} style={{
              flex: 1, background: today ? 'white' : 'transparent',
              border: today ? '0.5px solid rgba(0,0,0,0.1)' : '0.5px solid rgba(0,0,0,0.06)',
              borderRadius: 14, padding: '12px 10px',
              display: 'flex', flexDirection: 'column', overflow: 'hidden',
              opacity: past && !today ? 0.6 : 1, cursor: 'pointer',
            }}>
              <div style={{ marginBottom: 10, flexShrink: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 500, color: '#9b9890', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }} suppressHydrationWarning>
                  {day.toLocaleDateString('en-US', { weekday: 'short' })}
                </div>
                <div style={{ fontSize: 20, fontWeight: 500, color: today ? '#1D9E75' : '#1a1a18' }} suppressHydrationWarning>
                  {day.getDate()}
                </div>
              </div>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {dayTasks.map(t => <TaskChip key={t.id} task={t} onToggle={onToggle} compact />)}
              </div>
              <div style={{ fontSize: 10, color: '#c8c5be', marginTop: 4, flexShrink: 0 }}>+ Add</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Month View ─────────────────────────────────────────────────────────────────
function MonthView({ tasks, monthOffset, onToggle, onDayClick }: {
  tasks: Task[]; monthOffset: number
  onToggle: (id: string, done: boolean) => void
  onDayClick: (date: string) => void
}) {
  const now = new Date()
  const date = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1)
  const year = date.getFullYear()
  const month = date.getMonth()
  const days = getMonthDays(year, month)
  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ padding: '10px 16px 8px', fontSize: 12, color: '#9b9890', flexShrink: 0 }}>
        {date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, padding: '0 16px 6px', flexShrink: 0 }}>
        {weekDays.map(d => (
          <div key={d} style={{ fontSize: 10, fontWeight: 500, color: '#9b9890', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{d}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, padding: '0 16px 16px', flex: 1, overflow: 'hidden' }}>
        {days.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} />
          const key = dateKey(day)
          const dayTasks = tasks.filter(t => taskDateKey(t) === key)
          const today = isToday(day)
          const past = isPast(day)
          return (
            <div key={key} onClick={() => onDayClick(key)} style={{
              background: today ? 'white' : 'transparent',
              border: today ? '0.5px solid rgba(0,0,0,0.1)' : '0.5px solid rgba(0,0,0,0.06)',
              borderRadius: 10, padding: '8px 6px',
              display: 'flex', flexDirection: 'column',
              opacity: past && !today ? 0.5 : 1, cursor: 'pointer', overflow: 'hidden',
            }}>
              <div style={{ fontSize: 12, fontWeight: today ? 600 : 400, color: today ? '#1D9E75' : '#1a1a18', marginBottom: 4 }} suppressHydrationWarning>
                {day.getDate()}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, overflow: 'hidden' }}>
                {dayTasks.slice(0, 3).map(t => (
                  <Link key={t.id} href={`/tasks/${t.id}`} onClick={e => e.stopPropagation()} style={{
                    fontSize: 9, padding: '2px 5px', borderRadius: 4,
                    background: isOverdue(t) ? '#fdeaea' : t.status === 'done' ? '#f5f4f0' : '#e8f5f0',
                    color: isOverdue(t) ? '#E24B4A' : t.status === 'done' ? '#9b9890' : '#1D9E75',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    textDecoration: t.status === 'done' ? 'line-through' : 'none',
                  }}>
                    {t.title ?? 'Task'}
                  </Link>
                ))}
                {dayTasks.length > 3 && (
                  <div style={{ fontSize: 9, color: '#9b9890', paddingLeft: 4 }}>+{dayTasks.length - 3} more</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Mobile urgency list ────────────────────────────────────────────────────────
function UrgencyList({ tasks, onToggle }: { tasks: Task[]; onToggle: (id: string, done: boolean) => void }) {
  const overdue = tasks.filter(isOverdue)
  const today = tasks.filter(t => taskDateKey(t) === dateKey(new Date()) && !isOverdue(t))
  const upcoming = tasks.filter(t => { const k = taskDateKey(t); return k && k > dateKey(new Date()) && t.status !== 'done' })
  const noDue = tasks.filter(t => !t.due_date && t.status !== 'done')

  function Section({ title, items, color }: { title: string; items: Task[]; color?: string }) {
    if (!items.length) return null
    return (
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: color ?? '#6b6960', marginBottom: 8 }}>{title} · {items.length}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {items.map(t => (
            <Link key={t.id} href={`/tasks/${t.id}`} style={{ textDecoration: 'none' }}>
              <div style={{ background: 'white', border: '0.5px solid rgba(0,0,0,0.07)', borderRadius: 14, padding: '12px 14px' }}>
                <TaskChip task={t} onToggle={onToggle} />
              </div>
            </Link>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{ paddingTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 500, color: '#1a1a18', margin: 0 }}>Tasks</h1>
        <Link href="/capture" style={{ background: '#1a1a18', color: 'white', borderRadius: 10, padding: '7px 14px', fontSize: 12, fontWeight: 500, textDecoration: 'none' }}>+ Add</Link>
      </div>
      <Section title="Overdue" items={overdue} color="#E24B4A" />
      <Section title="Today" items={today} color="#1a1a18" />
      <Section title="Upcoming" items={upcoming} />
      <Section title="No date" items={noDue} />
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function TaskSchedulerClient({ tasks, deals, contacts }: Props) {
  const isDesktop = useIsDesktop()
  const router = useRouter()
  const [view, setView] = useState<'week' | 'month'>('month')
  const [weekOffset, setWeekOffset] = useState(0)
  const [monthOffset, setMonthOffset] = useState(0)
  const [localTasks, setLocalTasks] = useState<Task[]>(tasks)
  const [confirmDate, setConfirmDate] = useState<string | null>(null)

  async function toggleTask(id: string, done: boolean) {
    setLocalTasks(prev => prev.map(t => t.id === id ? { ...t, status: done ? 'done' : 'pending' } : t))
    try {
      await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: done ? 'done' : 'pending' }),
      })
    } catch {
      setLocalTasks(prev => prev.map(t => t.id === id ? { ...t, status: done ? 'pending' : 'done' } : t))
    }
  }

  function handleDayClick(date: string) {
    setConfirmDate(date)
  }

  const doneTasks = localTasks.filter(t => t.status === 'done').length
  const totalTasks = localTasks.length

  if (!isDesktop) return <UrgencyList tasks={localTasks} onToggle={toggleTask} />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden' }}>
      {/* Top bar */}
      <div style={{
        height: 50, flexShrink: 0, background: 'white',
        borderBottom: '0.5px solid rgba(0,0,0,0.07)',
        display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12,
      }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: '#1a1a18', flex: 1 }}>Tasks</span>

        {/* Progress */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 80, height: 4, background: '#f5f4f0', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 2, background: '#1D9E75', transition: 'width 0.3s', width: totalTasks > 0 ? `${Math.round((doneTasks / totalTasks) * 100)}%` : '0%' }} />
          </div>
          <span style={{ fontSize: 12, color: '#9b9890' }}>{doneTasks}/{totalTasks}</span>
        </div>

        {/* View toggle */}
        <div style={{ display: 'flex', gap: 2, background: '#f5f4f0', borderRadius: 9, padding: 3 }}>
          {(['week', 'month'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              background: view === v ? 'white' : 'transparent',
              border: 'none', borderRadius: 7, padding: '4px 10px',
              fontSize: 12, fontWeight: view === v ? 500 : 400,
              color: view === v ? '#1a1a18' : '#6b6960', cursor: 'pointer',
              textTransform: 'capitalize',
            }}>{v}</button>
          ))}
        </div>

        {/* Nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button onClick={() => view === 'week' ? setWeekOffset(w => w - 1) : setMonthOffset(m => m - 1)} style={{ background: '#f5f4f0', border: 'none', borderRadius: 8, width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#6b6960" strokeWidth="1.5"><path d="M7.5 2L3.5 6l4 4" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <button onClick={() => { setWeekOffset(0); setMonthOffset(0) }} style={{ background: (view === 'week' ? weekOffset : monthOffset) === 0 ? '#1a1a18' : '#f5f4f0', border: 'none', borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 500, color: (view === 'week' ? weekOffset : monthOffset) === 0 ? 'white' : '#6b6960', cursor: 'pointer' }}>Today</button>
          <button onClick={() => view === 'week' ? setWeekOffset(w => w + 1) : setMonthOffset(m => m + 1)} style={{ background: '#f5f4f0', border: 'none', borderRadius: 8, width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#6b6960" strokeWidth="1.5"><path d="M4.5 2l4 4-4 4" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>

        <Link href="/capture" style={{ background: '#1a1a18', color: 'white', borderRadius: 10, padding: '7px 14px', fontSize: 12, fontWeight: 500, textDecoration: 'none' }}>+ Add Task</Link>
      </div>

      {/* Calendar */}
      <div style={{ flex: 1, overflow: 'hidden', background: '#f5f4f0' }}>
        {view === 'week'
          ? <WeekView tasks={localTasks} weekOffset={weekOffset} onToggle={toggleTask} onDayClick={handleDayClick} />
          : <MonthView tasks={localTasks} monthOffset={monthOffset} onToggle={toggleTask} onDayClick={handleDayClick} />
        }
      </div>

      {/* Confirm modal */}
      {confirmDate && (
        <ConfirmCaptureModal
          date={confirmDate}
          onConfirm={() => { setConfirmDate(null); router.push('/capture') }}
          onCancel={() => setConfirmDate(null)}
        />
      )}
    </div>
  )
}