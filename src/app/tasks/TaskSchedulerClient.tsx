'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

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

function dateKey(d: Date) {
  return d.toISOString().slice(0, 10)
}

function isToday(d: Date) {
  return dateKey(d) === dateKey(new Date())
}

function isPast(d: Date) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return d < today
}

function taskDateKey(task: Task) {
  return task.due_date ? task.due_date.slice(0, 10) : null
}

function isOverdue(task: Task) {
  if (!task.due_date) return false
  if (['done', 'cancelled', 'postponed'].includes(task.status ?? '')) return false
  return task.due_date.slice(0, 10) < dateKey(new Date())
}

function isActive(task: Task) {
  return task.status !== 'cancelled'
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
  high: '#E24B4A',
  medium: '#EF9F27',
  low: '#9b9890',
}

// ── Confirm Modal ──────────────────────────────────────────────────────────────
function ConfirmCaptureModal({
  date,
  onConfirm,
  onCancel,
}: {
  date: string
  onConfirm: () => void
  onCancel: () => void
}) {
  const formatted = new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: 'white', borderRadius: 20, padding: 24, width: 320,
          display: 'flex', flexDirection: 'column', gap: 16,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <div style={{ fontSize: 15, fontWeight: 500, color: '#1a1a18', marginBottom: 6 }}>
            Add task
          </div>
          <div style={{ fontSize: 13, color: '#6b6960' }}>
            Go to Capture to add a new task for <strong>{formatted}</strong>?
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ background: '#f5f4f0', border: 'none', borderRadius: 10, padding: '9px 16px', fontSize: 13, color: '#6b6960', cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={onConfirm} style={{ background: '#1a1a18', border: 'none', borderRadius: 10, padding: '9px 16px', fontSize: 13, fontWeight: 500, color: 'white', cursor: 'pointer' }}>
            Go to Capture
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Task Chip (used in mobile day list) ───────────────────────────────────────
function TaskChip({
  task,
  onToggle,
  compact = false,
}: {
  task: Task
  onToggle: (id: string, done: boolean) => void
  compact?: boolean
}) {
  const done = task.status === 'done'
  const cancelled = task.status === 'cancelled'
  const postponed = task.status === 'postponed'
  const overdue = isOverdue(task)
  const priorityColor = task.priority ? PRIORITY_COLOR[task.priority] : undefined

  const bgColor = cancelled ? 'transparent'
    : postponed ? 'rgba(61,125,228,0.06)'
    : overdue ? '#fdeaea'
    : done ? 'transparent'
    : '#f5f4f0'

  const textColor = cancelled ? '#9b9890'
    : postponed ? '#3d7de4'
    : overdue ? '#E24B4A'
    : done ? '#9b9890'
    : '#1a1a18'

  return (
    <div
      style={{
        background: bgColor, borderRadius: 8,
        padding: compact ? '4px 7px' : '7px 9px',
        display: 'flex', alignItems: 'flex-start', gap: 6,
        borderLeft: priorityColor && !done && !cancelled ? `2px solid ${priorityColor}` : '2px solid transparent',
        opacity: done || cancelled ? 0.5 : 1,
        transition: 'opacity 0.2s', marginBottom: 3,
      }}
    >
      <div
        onClick={() => !cancelled && !postponed && onToggle(task.id, !done)}
        style={{
          width: 13, height: 13, borderRadius: 4, flexShrink: 0, marginTop: 1,
          border: done ? 'none' : cancelled ? '1.5px solid rgba(0,0,0,0.1)' : '1.5px solid rgba(0,0,0,0.2)',
          background: done ? '#1D9E75' : cancelled ? 'rgba(0,0,0,0.06)' : 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: cancelled || postponed ? 'default' : 'pointer',
        }}
      >
        {done && <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4L3 5.5L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
        {cancelled && <svg width="7" height="7" viewBox="0 0 7 7" fill="none"><path d="M1.5 1.5l4 4M5.5 1.5l-4 4" stroke="#9b9890" strokeWidth="1.2" strokeLinecap="round" /></svg>}
      </div>
      <Link
        href={`/tasks/${task.id}`}
        style={{
          fontSize: compact ? 12 : 13, lineHeight: 1.4, flex: 1, color: textColor,
          textDecoration: done || cancelled ? 'line-through' : 'none',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {task.title ?? 'Untitled'}
        {postponed && <span style={{ fontSize: 10, marginLeft: 5, color: '#3d7de4', fontWeight: 500 }}>→ postponed</span>}
      </Link>
    </div>
  )
}

// ── Kanban Card ───────────────────────────────────────────────────────────────
function KanbanCard({
  task,
  onDragStart,
}: {
  task: Task
  onDragStart: (id: string) => void
}) {
  const done = task.status === 'done'
  const overdue = isOverdue(task)
  const inProgress = task.status === 'in_progress'

  const bg = done ? '#E1F5EE'
    : overdue ? '#FCEBEB'
    : inProgress ? '#FAEEDA'
    : '#f5f4f0'

  const titleColor = done ? '#085041'
    : overdue ? '#791F1F'
    : inProgress ? '#854F0B'
    : '#1a1a18'

  const subColor = done ? '#0F6E56'
    : overdue ? '#A32D2D'
    : inProgress ? '#A37510'
    : '#9b9890'

  const sub = overdue
    ? `Overdue · ${task.due_date?.slice(5)}`
    : task.due_date
      ? new Date(task.due_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      : 'No date'

  return (
    <Link
      href={`/tasks/${task.id}`}
      draggable
      onDragStart={() => onDragStart(task.id)}
      style={{
        background: bg, borderRadius: 7, padding: '8px 10px',
        textDecoration: 'none', display: 'block',
        borderLeft: overdue ? '2px solid #E24B4A' : 'none',
        opacity: done ? 0.85 : 1,
        cursor: 'grab',
      }}
    >
      <div style={{
        fontSize: 12, fontWeight: 500, color: titleColor, marginBottom: 2,
        textDecoration: done ? 'line-through' : 'none',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {task.title ?? 'Untitled'}
      </div>
      <div style={{ fontSize: 10, color: subColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {sub}
      </div>
    </Link>
  )
}

// ── Kanban Section ────────────────────────────────────────────────────────────
function KanbanSection({
  tasks,
  onMove,
}: {
  tasks: Task[]
  onMove: (id: string, status: 'todo' | 'in_progress' | 'done') => void
}) {
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null)
  const todo = tasks.filter(t => !t.status || t.status === 'todo')
  const inProgress = tasks.filter(t => t.status === 'in_progress' || (isOverdue(t) && t.status !== 'done'))
  const done = tasks.filter(t => t.status === 'done')

  const columns = [
    { key: 'todo', label: 'To do', dot: 'rgba(0,0,0,0.2)', textColor: '#6b6960', items: todo },
    { key: 'in_progress', label: 'In progress', dot: '#EF9F27', textColor: '#854F0B', items: inProgress },
    { key: 'done', label: 'Done', dot: '#1D9E75', textColor: '#0F6E56', items: done },
  ]

  return (
    <div style={{
      padding: '14px 16px',
      background: '#f5f4f0',
      borderBottom: '0.5px solid rgba(0,0,0,0.06)',
      flexShrink: 0,
    }}>
      <div style={{
        fontSize: 10, fontWeight: 600, color: '#9b9890',
        letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10,
      }}>
        This week
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {columns.map(col => (
          <div
            key={col.key}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              if (!draggingTaskId) return
              onMove(draggingTaskId, col.key as 'todo' | 'in_progress' | 'done')
              setDraggingTaskId(null)
            }}
            style={{
            background: 'white', borderRadius: 10,
            border: '0.5px solid rgba(0,0,0,0.06)', padding: 12,
            display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: col.dot }} />
                <span style={{ fontSize: 10, fontWeight: 600, color: col.textColor, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  {col.label}
                </span>
              </div>
              <span style={{ fontSize: 11, color: '#9b9890', fontWeight: 500 }}>{col.items.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {col.items.length === 0 ? (
                <div style={{ fontSize: 11, color: '#c8c5be', textAlign: 'center', padding: '12px 0' }}>
                  Nothing here
                </div>
              ) : (
                col.items.map((t) => (
                  <KanbanCard
                    key={t.id}
                    task={t}
                    onDragStart={(id) => setDraggingTaskId(id)}
                  />
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Week View (desktop) — kanban on top + schedule below ──────────────────────
function WeekView({
  tasks,
  weekOffset,
  onMoveStatus,
  onDayClick,
}: {
  tasks: Task[]
  weekOffset: number
  onMoveStatus: (id: string, status: 'todo' | 'in_progress' | 'done') => void
  onDayClick: (date: string) => void
}) {
  const days = getWeekDays(weekOffset)
  const weekTasks = tasks.filter(t => {
    const k = taskDateKey(t)
    if (!k) return false
    return k >= dateKey(days[0]) && k <= dateKey(days[6])
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>

      {weekOffset === 0 && <KanbanSection tasks={weekTasks} onMove={onMoveStatus} />}

      <div style={{ padding: '14px 16px 6px', flexShrink: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: '#9b9890', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Schedule
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
        gap: 8,
        padding: '0 16px 16px',
      }}>
        {days.map((day) => {
          const key = dateKey(day)
          const dayTasks = tasks.filter((t) => taskDateKey(t) === key)
          const today = isToday(day)
          const past = isPast(day)

          return (
            <div
              key={key}
              onClick={() => onDayClick(key)}
              style={{
                minWidth: 0,
                background: today ? 'rgba(74,122,138,0.05)' : 'white',
                border: today ? '0.5px solid rgba(74,122,138,0.25)' : '0.5px solid rgba(0,0,0,0.06)',
                borderRadius: 12,
                padding: '12px 8px',
                display: 'flex', flexDirection: 'column',
                minHeight: 200,
                opacity: past && !today ? 0.7 : 1,
                cursor: 'pointer',
              }}
            >
              <div style={{
                marginBottom: 10, flexShrink: 0,
                paddingBottom: 8,
                borderBottom: today ? '0.5px solid rgba(74,122,138,0.2)' : '0.5px solid rgba(0,0,0,0.06)',
                textAlign: 'center',
              }}>
                <div style={{
                  fontSize: 9, fontWeight: today ? 600 : 500,
                  color: today ? '#4a7a8a' : '#9b9890',
                  textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4,
                }} suppressHydrationWarning>
                  {day.toLocaleDateString('en-US', { weekday: 'short' })}
                </div>
                {today ? (
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%',
                    background: '#4a7a8a', color: 'white',
                    fontSize: 13, fontWeight: 600,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  }} suppressHydrationWarning>
                    {day.getDate()}
                  </div>
                ) : (
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#1a1a18' }} suppressHydrationWarning>
                    {day.getDate()}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {dayTasks.map((t) => {
                  const overdue = isOverdue(t)
                  const done = t.status === 'done'
                  const inProgress = t.status === 'in_progress'

                  const bg = overdue ? '#FCEBEB'
                    : inProgress ? '#FAEEDA'
                    : done ? '#E1F5EE'
                    : '#f5f4f0'

                  const color = overdue ? '#791F1F'
                    : inProgress ? '#854F0B'
                    : done ? '#085041'
                    : '#1a1a18'

                  const accent = overdue ? '#E24B4A'
                    : inProgress ? '#EF9F27'
                    : done ? '#1D9E75'
                    : null

                  return (
                    <Link
                      key={t.id}
                      href={`/tasks/${t.id}`}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        display: 'block',
                        minWidth: 0,
                        fontSize: 10, padding: '4px 6px', borderRadius: 5,
                        background: bg, color: color,
                        borderLeft: accent ? `2px solid ${accent}` : 'none',
                        textDecoration: done ? 'line-through' : 'none',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        textDecorationColor: done ? '#1D9E75' : undefined,
                      }}
                    >
                      {t.title ?? 'Task'}
                    </Link>
                  )
                })}
              </div>

              <div style={{ fontSize: 10, color: '#c8c5be', marginTop: 4, flexShrink: 0, textAlign: 'center' }}>
                + Add
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Day Popover (shows all tasks for a clicked "+N more" day) ─────────────────
function DayPopover({
  date,
  tasks,
  anchorRect,
  onClose,
}: {
  date: string
  tasks: Task[]
  anchorRect: DOMRect
  onClose: () => void
}) {
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose])

  const formatted = new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  })
  const today = date === dateKey(new Date())

  // Position the popover near the cell, but keep it on screen
  const POPOVER_WIDTH = 280
  const margin = 12
  let left = anchorRect.left + window.scrollX
  let top = anchorRect.bottom + window.scrollY + 4

  // Flip horizontally if it would overflow the right edge
  if (left + POPOVER_WIDTH > window.innerWidth - margin) {
    left = anchorRect.right + window.scrollX - POPOVER_WIDTH
  }
  // Flip vertically if it would overflow bottom
  const estimatedHeight = Math.min(60 + tasks.length * 40, 360)
  if (top + estimatedHeight > window.innerHeight + window.scrollY - margin) {
    top = anchorRect.top + window.scrollY - estimatedHeight - 4
  }

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'transparent' }}
      />
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          top, left,
          width: POPOVER_WIDTH,
          maxHeight: 360,
          background: 'white',
          borderRadius: 12,
          border: '0.5px solid rgba(0,0,0,0.08)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          zIndex: 91,
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{
          padding: '12px 14px',
          borderBottom: '0.5px solid rgba(0,0,0,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: '#1a1a18' }}>
              {formatted}
            </span>
            {today && (
              <span style={{
                fontSize: 9, fontWeight: 600, color: '#4a7a8a',
                background: 'rgba(74,122,138,0.1)', borderRadius: 4,
                padding: '2px 6px', letterSpacing: '0.05em',
              }}>
                TODAY
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              padding: 4, color: '#9b9890', display: 'flex',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div style={{
          padding: '8px 10px', overflowY: 'auto', flex: 1,
          display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          {tasks.length === 0 ? (
            <div style={{ fontSize: 12, color: '#9b9890', padding: '12px 4px', textAlign: 'center' }}>
              No tasks
            </div>
          ) : (
            tasks.map((t) => {
              const overdue = isOverdue(t)
              const done = t.status === 'done'
              const inProgress = t.status === 'in_progress'

              const bg = overdue ? '#FCEBEB'
                : inProgress ? '#FAEEDA'
                : done ? '#E1F5EE'
                : '#f5f4f0'

              const color = overdue ? '#791F1F'
                : inProgress ? '#854F0B'
                : done ? '#085041'
                : '#1a1a18'

              const accent = overdue ? '#E24B4A'
                : inProgress ? '#EF9F27'
                : done ? '#1D9E75'
                : null

              return (
                <Link
                  key={t.id}
                  href={`/tasks/${t.id}`}
                  style={{
                    fontSize: 12, padding: '8px 10px', borderRadius: 6,
                    background: bg, color: color,
                    borderLeft: accent ? `2px solid ${accent}` : 'none',
                    textDecoration: done ? 'line-through' : 'none',
                    display: 'block',
                  }}
                >
                  {t.title ?? 'Task'}
                </Link>
              )
            })
          )}
        </div>
      </div>
    </>
  )
}

// ── Month View (desktop) — improved calendar ──────────────────────────────────
function MonthView({
  tasks,
  monthOffset,
  onToggle,
  onDayClick,
}: {
  tasks: Task[]
  monthOffset: number
  onToggle: (id: string, done: boolean) => void
  onDayClick: (date: string) => void
}) {
  const now = new Date()
  const date = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1)
  const year = date.getFullYear()
  const month = date.getMonth()
  const days = getMonthDays(year, month)
  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  const [popover, setPopover] = useState<{ date: string; rect: DOMRect } | null>(null)
  const popoverTasks = popover
    ? tasks.filter((t) => taskDateKey(t) === popover.date).filter(isActive)
    : []

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      background: 'white', margin: '14px 16px 16px',
      borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.06)',
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
        background: '#f5f4f0', flexShrink: 0,
      }}>
        {weekDays.map((d) => (
          <div key={d} style={{
            fontSize: 10, fontWeight: 600, color: '#9b9890',
            padding: '10px 12px', letterSpacing: '0.06em', textTransform: 'uppercase',
          }}>
            {d}
          </div>
        ))}
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
        gridAutoRows: '140px',
      }}>
        {days.map((day, i) => {
          if (!day) {
            return (
              <div key={`empty-${i}`} style={{
                background: '#f5f4f0', opacity: 0.5,
                borderRight: (i + 1) % 7 !== 0 ? '0.5px solid rgba(0,0,0,0.06)' : 'none',
                borderBottom: '0.5px solid rgba(0,0,0,0.06)',
              }} />
            )
          }

          const key = dateKey(day)
          const dayTasks = tasks.filter((t) => taskDateKey(t) === key)
          const activeDayTasks = dayTasks.filter(isActive)
          const today = isToday(day)
          const past = isPast(day)
          const isLastRow = i >= days.length - 7
          const isLastCol = (i + 1) % 7 === 0

          return (
            <div
              key={key}
              onClick={() => onDayClick(key)}
              style={{
                background: today ? 'rgba(74,122,138,0.04)' : 'white',
                borderRight: !isLastCol ? '0.5px solid rgba(0,0,0,0.06)' : 'none',
                borderBottom: !isLastRow ? '0.5px solid rgba(0,0,0,0.06)' : 'none',
                padding: '8px 10px',
                display: 'flex', flexDirection: 'column',
                opacity: past && !today ? 0.65 : 1,
                cursor: 'pointer',
                overflow: 'hidden',
                minHeight: 0,
              }}
            >
              <div style={{ marginBottom: 6, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                {today ? (
                  <>
                    <div style={{
                      width: 22, height: 22, borderRadius: '50%',
                      background: '#4a7a8a', color: 'white',
                      fontSize: 12, fontWeight: 600,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }} suppressHydrationWarning>
                      {day.getDate()}
                    </div>
                    <span style={{ fontSize: 9, color: '#4a7a8a', fontWeight: 600, letterSpacing: '0.05em' }}>
                      TODAY
                    </span>
                  </>
                ) : (
                  <div style={{ fontSize: 12, color: '#6b6960', fontWeight: 500 }} suppressHydrationWarning>
                    {day.getDate()}
                  </div>
                )}
              </div>

              <div style={{
                display: 'flex', flexDirection: 'column', gap: 3,
                flex: 1, overflow: 'hidden',
              }}>
                {activeDayTasks.slice(0, 3).map((t) => {
                  const overdue = isOverdue(t)
                  const done = t.status === 'done'
                  const inProgress = t.status === 'in_progress'

                  const bg = overdue ? '#FCEBEB'
                    : inProgress ? '#FAEEDA'
                    : done ? '#E1F5EE'
                    : '#f5f4f0'

                  const color = overdue ? '#791F1F'
                    : inProgress ? '#854F0B'
                    : done ? '#085041'
                    : '#1a1a18'

                  const accent = overdue ? '#E24B4A'
                    : inProgress ? '#EF9F27'
                    : done ? '#1D9E75'
                    : null

                  return (
                    <Link
                      key={t.id}
                      href={`/tasks/${t.id}`}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        fontSize: 10, padding: '3px 6px', borderRadius: 4,
                        background: bg, color: color,
                        borderLeft: accent ? `2px solid ${accent}` : 'none',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        textDecoration: done ? 'line-through' : 'none',
                      }}
                    >
                      {t.title ?? 'Task'}
                    </Link>
                  )
                })}

                {activeDayTasks.length > 3 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                      setPopover({ date: key, rect })
                    }}
                    style={{
                      fontSize: 10, color: '#6b6960', paddingLeft: 6,
                      background: 'transparent', border: 'none',
                      textAlign: 'left', cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    +{activeDayTasks.length - 3} more
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {popover && (
        <DayPopover
          date={popover.date}
          tasks={popoverTasks}
          anchorRect={popover.rect}
          onClose={() => setPopover(null)}
        />
      )}
    </div>
  )
}

// ── Mobile Week Calendar ───────────────────────────────────────────────────────
function MobileWeekCalendar({
  tasks,
  weekOffset,
  selectedDate,
  onSelectDay,
}: {
  tasks: Task[]
  weekOffset: number
  selectedDate: string
  onSelectDay: (date: string) => void
}) {
  const days = getWeekDays(weekOffset)

  return (
    <div style={{ display: 'flex', gap: 6, padding: '0 0 16px' }}>
      {days.map((day) => {
        const key = dateKey(day)
        const dayTasks = tasks.filter((t) => taskDateKey(t) === key).filter(isActive)
        const count = dayTasks.length
        const today = isToday(day)
        const selected = selectedDate === key
        const hasOverdue = dayTasks.some(isOverdue)

        return (
          <div
            key={key}
            onClick={() => onSelectDay(key)}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 4, cursor: 'pointer',
            }}
          >
            <div style={{
              fontSize: 10, fontWeight: 500, color: '#9b9890',
              textTransform: 'uppercase', letterSpacing: '0.04em',
            }} suppressHydrationWarning>
              {day.toLocaleDateString('en-US', { weekday: 'short' })}
            </div>

            <div style={{
              width: 34, height: 34, borderRadius: '50%',
              background: selected ? '#1a1a18' : today ? '#f5f4f0' : 'transparent',
              border: today && !selected ? '1.5px solid rgba(0,0,0,0.12)' : 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: selected || today ? 600 : 400,
              color: selected ? 'white' : today ? '#1D9E75' : '#1a1a18',
              transition: 'all 0.15s',
            }} suppressHydrationWarning>
              {day.getDate()}
            </div>

            {count > 0 ? (
              <div style={{
                minWidth: 18, height: 18, borderRadius: 9,
                background: hasOverdue ? '#E24B4A' : selected ? '#1a1a18' : '#1D9E75',
                color: 'white', fontSize: 10, fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px',
              }}>
                {count}
              </div>
            ) : (
              <div style={{ height: 18 }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Mobile Month Calendar ──────────────────────────────────────────────────────
function MobileMonthCalendar({
  tasks,
  monthOffset,
  selectedDate,
  onSelectDay,
}: {
  tasks: Task[]
  monthOffset: number
  selectedDate: string
  onSelectDay: (date: string) => void
}) {
  const now = new Date()
  const date = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1)
  const year = date.getFullYear()
  const month = date.getMonth()
  const days = getMonthDays(year, month)
  const weekDays = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

  return (
    <div style={{ paddingBottom: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
        {weekDays.map((d, i) => (
          <div key={i} style={{
            fontSize: 10, fontWeight: 500, color: '#9b9890',
            textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.04em',
          }}>
            {d}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px 0' }}>
        {days.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} />

          const key = dateKey(day)
          const dayTasks = tasks.filter((t) => taskDateKey(t) === key).filter(isActive)
          const count = dayTasks.length
          const today = isToday(day)
          const selected = selectedDate === key
          const past = isPast(day)
          const hasOverdue = dayTasks.some(isOverdue)

          return (
            <div
              key={key}
              onClick={() => onSelectDay(key)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                padding: '4px 0', cursor: 'pointer',
                opacity: past && !today && !selected ? 0.45 : 1,
              }}
            >
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: selected ? '#1a1a18' : today ? '#f5f4f0' : 'transparent',
                border: today && !selected ? '1.5px solid rgba(0,0,0,0.12)' : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: selected || today ? 600 : 400,
                color: selected ? 'white' : today ? '#1D9E75' : '#1a1a18',
                transition: 'all 0.15s',
              }} suppressHydrationWarning>
                {day.getDate()}
              </div>

              {count > 0 ? (
                <div style={{
                  minWidth: 16, height: 16, borderRadius: 8,
                  background: hasOverdue ? '#E24B4A' : selected ? '#6b6960' : '#1D9E75',
                  color: 'white', fontSize: 9, fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px',
                }}>
                  {count}
                </div>
              ) : (
                <div style={{ height: 16 }} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Mobile Day Task List ───────────────────────────────────────────────────────
function MobileDayList({
  tasks,
  selectedDate,
  onToggle,
  onAddTask,
}: {
  tasks: Task[]
  selectedDate: string
  onToggle: (id: string, done: boolean) => void
  onAddTask: (date: string) => void
}) {
  const dayTasks = tasks.filter((t) => taskDateKey(t) === selectedDate)
  const overdueTasks = tasks.filter(isOverdue)
  const todayKey = dateKey(new Date())
  const isSelectedToday = selectedDate === todayKey

  const formatted = new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  })

  return (
    <div>
      {isSelectedToday && overdueTasks.length > 0 && (
        <div style={{
          background: '#fdeaea', border: '0.5px solid rgba(226,75,74,0.15)',
          borderRadius: 14, padding: '12px 14px', marginBottom: 12,
        }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: '#E24B4A', marginBottom: 8 }}>
            Overdue · {overdueTasks.length}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {overdueTasks.map((t) => <TaskChip key={t.id} task={t} onToggle={onToggle} />)}
          </div>
        </div>
      )}

      <div style={{
        background: 'white', border: '0.5px solid rgba(0,0,0,0.07)',
        borderRadius: 14, padding: '14px', marginBottom: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#1a1a18' }}>{formatted}</div>
          <button onClick={() => onAddTask(selectedDate)} style={{
            background: '#f5f4f0', border: 'none', borderRadius: 8,
            padding: '5px 10px', fontSize: 11, color: '#6b6960', cursor: 'pointer',
          }}>
            + Add
          </button>
        </div>

        {dayTasks.length === 0 ? (
          <div style={{ fontSize: 13, color: '#9b9890', textAlign: 'center', padding: '12px 0' }}>
            No tasks for this day
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {dayTasks.map((t) => <TaskChip key={t.id} task={t} onToggle={onToggle} />)}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Mobile Calendar View ───────────────────────────────────────────────────────
function MobileCalendarView({
  tasks,
  onToggle,
}: {
  tasks: Task[]
  onToggle: (id: string, done: boolean) => void
}) {
  const router = useRouter()
  const [view, setView] = useState<'week' | 'month'>('month')
  const [weekOffset, setWeekOffset] = useState(0)
  const [monthOffset, setMonthOffset] = useState(0)
  const [selectedDate, setSelectedDate] = useState(dateKey(new Date()))
  const [confirmDate, setConfirmDate] = useState<string | null>(null)

  const now = new Date()
  const monthDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1)

  return (
    <div style={{ paddingTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 500, color: '#1a1a18', margin: 0 }}>Tasks</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', gap: 2, background: '#f5f4f0', borderRadius: 9, padding: 3 }}>
            {(['week', 'month'] as const).map((v) => (
              <button key={v} onClick={() => setView(v)} style={{
                background: view === v ? 'white' : 'transparent',
                border: 'none', borderRadius: 7, padding: '4px 10px',
                fontSize: 11, fontWeight: view === v ? 500 : 400,
                color: view === v ? '#1a1a18' : '#6b6960',
                cursor: 'pointer', textTransform: 'capitalize',
              }}>
                {v}
              </button>
            ))}
          </div>
          <Link href="/capture" style={{
            background: '#1a1a18', color: 'white', borderRadius: 10,
            padding: '7px 14px', fontSize: 12, fontWeight: 500, textDecoration: 'none',
          }}>
            + Add
          </Link>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#1a1a18' }} suppressHydrationWarning>
          {view === 'week'
            ? getWeekDays(weekOffset)[0].toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
            : monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button onClick={() => (view === 'week' ? setWeekOffset((w) => w - 1) : setMonthOffset((m) => m - 1))} style={{
            background: '#f5f4f0', border: 'none', borderRadius: 8, width: 28, height: 28,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#6b6960" strokeWidth="1.5">
              <path d="M7.5 2L3.5 6l4 4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button onClick={() => { setWeekOffset(0); setMonthOffset(0); setSelectedDate(dateKey(new Date())) }} style={{
            background: (view === 'week' ? weekOffset : monthOffset) === 0 ? '#1a1a18' : '#f5f4f0',
            border: 'none', borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 500,
            color: (view === 'week' ? weekOffset : monthOffset) === 0 ? 'white' : '#6b6960', cursor: 'pointer',
          }}>
            Today
          </button>
          <button onClick={() => (view === 'week' ? setWeekOffset((w) => w + 1) : setMonthOffset((m) => m + 1))} style={{
            background: '#f5f4f0', border: 'none', borderRadius: 8, width: 28, height: 28,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#6b6960" strokeWidth="1.5">
              <path d="M4.5 2l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      {view === 'week' ? (
        <MobileWeekCalendar tasks={tasks} weekOffset={weekOffset} selectedDate={selectedDate} onSelectDay={setSelectedDate} />
      ) : (
        <MobileMonthCalendar tasks={tasks} monthOffset={monthOffset} selectedDate={selectedDate} onSelectDay={setSelectedDate} />
      )}

      <MobileDayList tasks={tasks} selectedDate={selectedDate} onToggle={onToggle} onAddTask={(date) => setConfirmDate(date)} />

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

// ── Main ──────────────────────────────────────────────────────────────────────
export default function TaskSchedulerClient({ tasks, deals, contacts }: Props) {
  const isDesktop = useIsDesktop()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [view, setView] = useState<'week' | 'month'>(() => searchParams.get('view') === 'week' ? 'week' : 'month')
  const [weekOffset, setWeekOffset] = useState(() => Number(searchParams.get('week') ?? 0) || 0)
  const [monthOffset, setMonthOffset] = useState(() => Number(searchParams.get('month') ?? 0) || 0)
  const [localTasks, setLocalTasks] = useState<Task[]>(tasks)
  const [confirmDate, setConfirmDate] = useState<string | null>(null)

  useEffect(() => {
    const next = new URLSearchParams(searchParams.toString())
    next.set('view', view)
    next.set('week', String(weekOffset))
    next.set('month', String(monthOffset))
    router.replace(`/tasks?${next.toString()}`, { scroll: false })
  }, [view, weekOffset, monthOffset, router, searchParams])

  async function updateTaskStatus(id: string, status: 'todo' | 'in_progress' | 'done') {
    const previous = localTasks.find((t) => t.id === id)?.status
    setLocalTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)))
    try {
      await fetch(`/api/tasks/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, done: status === 'done' }),
      })
    } catch {
      if (!previous) return
      setLocalTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: previous } : t)))
    }
  }

  async function toggleTask(id: string, done: boolean) {
    await updateTaskStatus(id, done ? 'done' : 'todo')
  }

  function handleDayClick(date: string) {
    setConfirmDate(date)
  }

  const activeTasks = localTasks.filter((t) => t.status !== 'cancelled')
  const doneTasks = activeTasks.filter((t) => t.status === 'done').length
  const totalTasks = activeTasks.length

  const now = new Date()
  const headerDate = view === 'week'
    ? `${getWeekDays(weekOffset)[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${getWeekDays(weekOffset)[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    : new Date(now.getFullYear(), now.getMonth() + monthOffset, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  if (!isDesktop) {
    return <MobileCalendarView tasks={localTasks} onToggle={toggleTask} />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{
        flexShrink: 0, background: 'white',
        borderBottom: '0.5px solid rgba(0,0,0,0.07)',
        display: 'flex', alignItems: 'center', padding: '12px 20px', gap: 12,
        borderRadius: '14px 14px 0 0',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
          <span style={{ fontSize: 15, fontWeight: 500, color: '#1a1a18' }}>Tasks</span>
          <span style={{
            fontSize: 11, color: '#9b9890', padding: '2px 8px',
            background: '#f5f4f0', borderRadius: 6,
          }}>
            {doneTasks} / {totalTasks} done
          </span>
        </div>

        <div style={{ display: 'flex', gap: 2, background: '#f5f4f0', borderRadius: 9, padding: 3 }}>
          {(['week', 'month'] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} style={{
              background: view === v ? 'white' : 'transparent',
              border: view === v ? '0.5px solid rgba(0,0,0,0.06)' : 'none',
              borderRadius: 7, padding: '4px 12px', fontSize: 12,
              fontWeight: view === v ? 500 : 400,
              color: view === v ? '#1a1a18' : '#6b6960',
              cursor: 'pointer', textTransform: 'capitalize',
            }}>
              {v}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onClick={() => (view === 'week' ? setWeekOffset((w) => w - 1) : setMonthOffset((m) => m - 1))} style={{
            background: 'transparent', border: '0.5px solid rgba(0,0,0,0.07)', borderRadius: '50%',
            width: 26, height: 26, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M6.5 2L3.5 5l3 3" stroke="#6b6960" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <span style={{
            fontSize: 13, fontWeight: 500, color: '#1a1a18',
            minWidth: 130, textAlign: 'center',
          }} suppressHydrationWarning>
            {headerDate}
          </span>

          <button onClick={() => (view === 'week' ? setWeekOffset((w) => w + 1) : setMonthOffset((m) => m + 1))} style={{
            background: 'transparent', border: '0.5px solid rgba(0,0,0,0.07)', borderRadius: '50%',
            width: 26, height: 26, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M3.5 2L6.5 5l-3 3" stroke="#6b6960" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <button onClick={() => { setWeekOffset(0); setMonthOffset(0) }} style={{
          background: (view === 'week' ? weekOffset : monthOffset) === 0 ? '#1a1a18' : 'transparent',
          border: (view === 'week' ? weekOffset : monthOffset) === 0 ? 'none' : '0.5px solid rgba(0,0,0,0.07)',
          borderRadius: 18, padding: '6px 14px', fontSize: 12, fontWeight: 500,
          color: (view === 'week' ? weekOffset : monthOffset) === 0 ? 'white' : '#6b6960',
          cursor: 'pointer',
        }}>
          Today
        </button>

        <Link href="/capture" style={{
          background: '#1a1a18', color: 'white', borderRadius: 18,
          padding: '7px 14px', fontSize: 12, fontWeight: 500, textDecoration: 'none',
        }}>
          + Add Task
        </Link>
      </div>

      <div style={{ background: '#f5f4f0', borderRadius: '0 0 14px 14px' }}>
        {view === 'week' ? (
          <WeekView tasks={localTasks} weekOffset={weekOffset} onMoveStatus={updateTaskStatus} onDayClick={handleDayClick} />
        ) : (
          <MonthView tasks={localTasks} monthOffset={monthOffset} onToggle={toggleTask} onDayClick={handleDayClick} />
        )}
      </div>

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