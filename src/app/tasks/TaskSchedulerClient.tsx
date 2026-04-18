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

function dateKey(d: Date) {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function isToday(d: Date) {
  return dateKey(d) === dateKey(new Date())
}

function isPast(d: Date) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const compare = new Date(d)
  compare.setHours(0, 0, 0, 0)

  return compare < today
}

function taskDateKey(task: Task) {
  return task.due_date ? task.due_date.slice(0, 10) : null
}

// Exclude cancelled/postponed from overdue
function isOverdue(task: Task) {
  if (!task.due_date) return false
  if (['done', 'cancelled', 'postponed'].includes(task.status ?? '')) return false
  return task.due_date.slice(0, 10) < dateKey(new Date())
}

// Active = not cancelled (done and postponed still show)
function isActive(task: Task) {
  return task.status !== 'cancelled'
}

function getWeekDays(offset = 0): Date[] {
  const now = new Date()
  const monday = new Date(now)
  const day = now.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day

  monday.setDate(now.getDate() + diffToMonday + offset * 7)
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
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(0,0,0,0.22)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: 'white',
          borderRadius: 20,
          padding: 24,
          width: 320,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          border: '0.5px solid rgba(0,0,0,0.07)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 500,
              color: '#1a1a18',
              marginBottom: 6,
            }}
          >
            Add task
          </div>
          <div style={{ fontSize: 13, color: '#6b6960', lineHeight: 1.45 }}>
            Go to Capture to add a new task for <strong>{formatted}</strong>?
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              background: '#f5f4f0',
              border: 'none',
              borderRadius: 10,
              padding: '9px 16px',
              fontSize: 13,
              color: '#6b6960',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>

          <button
            onClick={onConfirm}
            style={{
              background: '#1a1a18',
              border: 'none',
              borderRadius: 10,
              padding: '9px 16px',
              fontSize: 13,
              fontWeight: 500,
              color: 'white',
              cursor: 'pointer',
            }}
          >
            Go to Capture
          </button>
        </div>
      </div>
    </div>
  )
}

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

  const textColor = cancelled
    ? '#9b9890'
    : postponed
      ? '#6b6960'
      : overdue
        ? '#C45857'
        : done
          ? '#9b9890'
          : '#1a1a18'

  const background = overdue
    ? 'rgba(226,75,74,0.06)'
    : compact
      ? 'transparent'
      : '#f8f7f4'

  return (
    <div
      style={{
        background,
        borderRadius: compact ? 0 : 8,
        padding: compact ? '4px 0 4px 8px' : '7px 8px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        borderLeft:
          priorityColor && !done && !cancelled ? `1.5px solid ${priorityColor}` : '1.5px solid transparent',
        opacity: done || cancelled ? 0.56 : 1,
        transition: 'opacity 0.2s',
        marginBottom: 3,
      }}
    >
      <div
        onClick={() => !cancelled && !postponed && onToggle(task.id, !done)}
        style={{
          width: 13,
          height: 13,
          borderRadius: 4,
          flexShrink: 0,
          marginTop: 2,
          border: done
            ? 'none'
            : cancelled
              ? '1.5px solid rgba(0,0,0,0.1)'
              : '1.5px solid rgba(0,0,0,0.18)',
          background: done ? '#1a1a18' : cancelled ? 'rgba(0,0,0,0.05)' : 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: cancelled || postponed ? 'default' : 'pointer',
        }}
      >
        {done && (
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <path
              d="M1.5 4L3 5.5L6.5 2"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
        {cancelled && (
          <svg width="7" height="7" viewBox="0 0 7 7" fill="none">
            <path
              d="M1.5 1.5l4 4M5.5 1.5l-4 4"
              stroke="#9b9890"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
        )}
      </div>

      <Link
        href={`/tasks/${task.id}`}
        style={{
          fontSize: compact ? 12 : 13,
          lineHeight: 1.45,
          flex: 1,
          color: textColor,
          textDecoration: done || cancelled ? 'line-through' : 'none',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {task.title ?? 'Untitled'}
        {postponed && (
          <span style={{ fontSize: 10, marginLeft: 5, color: '#9b9890', fontWeight: 500 }}>
            postponed
          </span>
        )}
      </Link>
    </div>
  )
}

function WeekView({
  tasks,
  weekOffset,
  onToggle,
  onDayClick,
}: {
  tasks: Task[]
  weekOffset: number
  onToggle: (id: string, done: boolean) => void
  onDayClick: (date: string) => void
}) {
  const days = getWeekDays(weekOffset)
  const overdueTasks = tasks.filter(isOverdue)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div
        style={{
          padding: '14px 18px 8px',
          fontSize: 12,
          color: '#9b9890',
          flexShrink: 0,
          letterSpacing: '0.01em',
        }}
        suppressHydrationWarning
      >
        {days[0].toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
      </div>

      {overdueTasks.length > 0 && weekOffset === 0 && (
        <div
          style={{
            margin: '0 18px 12px',
            background: 'rgba(226,75,74,0.05)',
            border: '0.5px solid rgba(226,75,74,0.12)',
            borderRadius: 16,
            padding: '12px 14px',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: '#C45857',
              marginBottom: 8,
              letterSpacing: '0.01em',
            }}
          >
            Overdue · {overdueTasks.length}
          </div>
          {overdueTasks.map((t) => (
            <TaskChip key={t.id} task={t} onToggle={onToggle} compact />
          ))}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          gap: 10,
          padding: '0 18px 18px',
          flex: 1,
          overflow: 'hidden',
        }}
      >
        {days.map((day) => {
          const key = dateKey(day)
          const dayTasks = tasks.filter((t) => taskDateKey(t) === key && !isOverdue(t))
          const today = isToday(day)
          const past = isPast(day)

          return (
            <div
              key={key}
              onClick={() => onDayClick(key)}
              style={{
                flex: 1,
                background: '#ffffff',
                border: today ? '1px solid rgba(0,0,0,0.12)' : '0.5px solid rgba(0,0,0,0.06)',
                borderRadius: 16,
                padding: '14px 12px',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                opacity: past && !today ? 0.68 : 1,
                cursor: 'pointer',
              }}
            >
              <div style={{ marginBottom: 12, flexShrink: 0 }}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 500,
                    color: '#9b9890',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    marginBottom: 4,
                  }}
                  suppressHydrationWarning
                >
                  {day.toLocaleDateString('en-US', { weekday: 'short' })}
                </div>

                <div
                  style={{
                    fontSize: 20,
                    fontWeight: today ? 600 : 500,
                    color: '#1a1a18',
                    letterSpacing: '-0.02em',
                  }}
                  suppressHydrationWarning
                >
                  {day.getDate()}
                </div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto' }}>
                {dayTasks.map((t) => (
                  <TaskChip key={t.id} task={t} onToggle={onToggle} compact />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div
        style={{
          padding: '14px 18px 10px',
          fontSize: 12,
          color: '#9b9890',
          flexShrink: 0,
          letterSpacing: '0.01em',
        }}
      >
        {date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 6,
          padding: '0 18px 8px',
          flexShrink: 0,
        }}
      >
        {weekDays.map((d) => (
          <div
            key={d}
            style={{
              fontSize: 10,
              fontWeight: 500,
              color: '#9b9890',
              textAlign: 'center',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            {d}
          </div>
        ))}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 6,
          padding: '0 18px 18px',
          flex: 1,
          overflow: 'hidden',
        }}
      >
        {days.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} />

          const key = dateKey(day)
          const dayTasks = tasks.filter((t) => taskDateKey(t) === key)
          const activeDayTasks = dayTasks.filter(isActive)
          const today = isToday(day)
          const past = isPast(day)

          return (
            <div
              key={key}
              onClick={() => onDayClick(key)}
              style={{
                background: '#ffffff',
                border: today ? '1px solid rgba(0,0,0,0.12)' : '0.5px solid rgba(0,0,0,0.05)',
                borderRadius: 12,
                padding: '10px 8px',
                display: 'flex',
                flexDirection: 'column',
                opacity: past && !today ? 0.58 : 1,
                cursor: 'pointer',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: today ? 600 : 500,
                  color: '#1a1a18',
                  marginBottom: 6,
                  letterSpacing: '-0.01em',
                }}
                suppressHydrationWarning
              >
                {day.getDate()}
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                  flex: 1,
                  overflow: 'hidden',
                }}
              >
                {activeDayTasks.slice(0, 2).map((t) => (
                  <Link
                    key={t.id}
                    href={`/tasks/${t.id}`}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      fontSize: 11,
                      padding: '3px 6px',
                      borderRadius: 6,
                      background: isOverdue(t) ? 'rgba(226,75,74,0.06)' : '#f8f7f4',
                      color: isOverdue(t)
                        ? '#C45857'
                        : t.status === 'done'
                          ? '#9b9890'
                          : t.status === 'postponed'
                            ? '#6b6960'
                            : '#1a1a18',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      textDecoration: t.status === 'done' ? 'line-through' : 'none',
                    }}
                  >
                    {t.title ?? 'Task'}
                  </Link>
                ))}

                {activeDayTasks.length > 2 && (
                  <div style={{ fontSize: 11, color: '#9b9890', paddingLeft: 4 }}>
                    +{activeDayTasks.length - 2} more
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

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
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 500,
                color: '#9b9890',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
              suppressHydrationWarning
            >
              {day.toLocaleDateString('en-US', { weekday: 'short' })}
            </div>

            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                background: selected ? '#1a1a18' : today ? '#ffffff' : 'transparent',
                border: today && !selected ? '1px solid rgba(0,0,0,0.1)' : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                fontWeight: selected || today ? 600 : 400,
                color: selected ? 'white' : '#1a1a18',
                transition: 'all 0.15s',
              }}
              suppressHydrationWarning
            >
              {day.getDate()}
            </div>

            {count > 0 ? (
              <div
                style={{
                  minWidth: 18,
                  height: 18,
                  borderRadius: 9,
                  background: hasOverdue ? '#C45857' : selected ? '#1a1a18' : '#dcd9d1',
                  color: hasOverdue || selected ? 'white' : '#6b6960',
                  fontSize: 10,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 5px',
                }}
              >
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
          <div
            key={i}
            style={{
              fontSize: 10,
              fontWeight: 500,
              color: '#9b9890',
              textAlign: 'center',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
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
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 3,
                padding: '4px 0',
                cursor: 'pointer',
                opacity: past && !today && !selected ? 0.45 : 1,
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: selected ? '#1a1a18' : today ? '#ffffff' : 'transparent',
                  border: today && !selected ? '1px solid rgba(0,0,0,0.1)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  fontWeight: selected || today ? 600 : 400,
                  color: selected ? 'white' : '#1a1a18',
                  transition: 'all 0.15s',
                }}
                suppressHydrationWarning
              >
                {day.getDate()}
              </div>

              {count > 0 ? (
                <div
                  style={{
                    minWidth: 16,
                    height: 16,
                    borderRadius: 8,
                    background: hasOverdue ? '#C45857' : selected ? '#6b6960' : '#dcd9d1',
                    color: hasOverdue || selected ? 'white' : '#6b6960',
                    fontSize: 9,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 4px',
                  }}
                >
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
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div>
      {isSelectedToday && overdueTasks.length > 0 && (
        <div
          style={{
            background: 'rgba(226,75,74,0.05)',
            border: '0.5px solid rgba(226,75,74,0.12)',
            borderRadius: 14,
            padding: '12px 14px',
            marginBottom: 12,
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: '#C45857',
              marginBottom: 8,
            }}
          >
            Overdue · {overdueTasks.length}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {overdueTasks.map((t) => (
              <TaskChip key={t.id} task={t} onToggle={onToggle} />
            ))}
          </div>
        </div>
      )}

      <div
        style={{
          background: 'white',
          border: '0.5px solid rgba(0,0,0,0.07)',
          borderRadius: 16,
          padding: '14px',
          marginBottom: 12,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 500, color: '#1a1a18' }}>{formatted}</div>

          <button
            onClick={() => onAddTask(selectedDate)}
            style={{
              background: '#f5f4f0',
              border: 'none',
              borderRadius: 8,
              padding: '5px 10px',
              fontSize: 11,
              color: '#6b6960',
              cursor: 'pointer',
            }}
          >
            Add
          </button>
        </div>

        {dayTasks.length === 0 ? (
          <div
            style={{
              fontSize: 13,
              color: '#9b9890',
              textAlign: 'center',
              padding: '12px 0',
            }}
          >
            No tasks for this day
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {dayTasks.map((t) => (
              <TaskChip key={t.id} task={t} onToggle={onToggle} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

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
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 500, color: '#1a1a18', margin: 0 }}>Tasks</h1>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              display: 'flex',
              gap: 2,
              background: '#f5f4f0',
              borderRadius: 9,
              padding: 3,
            }}
          >
            {(['week', 'month'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                style={{
                  background: view === v ? 'white' : 'transparent',
                  border: 'none',
                  borderRadius: 7,
                  padding: '4px 10px',
                  fontSize: 11,
                  fontWeight: view === v ? 500 : 400,
                  color: view === v ? '#1a1a18' : '#6b6960',
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {v}
              </button>
            ))}
          </div>

          <Link
            href="/capture"
            style={{
              background: '#1a1a18',
              color: 'white',
              borderRadius: 10,
              padding: '7px 14px',
              fontSize: 12,
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            + Add
          </Link>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 500, color: '#1a1a18' }} suppressHydrationWarning>
          {view === 'week'
            ? getWeekDays(weekOffset)[0].toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
            : monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            onClick={() => (view === 'week' ? setWeekOffset((w) => w - 1) : setMonthOffset((m) => m - 1))}
            style={{
              background: '#f5f4f0',
              border: 'none',
              borderRadius: 8,
              width: 28,
              height: 28,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#6b6960" strokeWidth="1.5">
              <path d="M7.5 2L3.5 6l4 4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <button
            onClick={() => {
              setWeekOffset(0)
              setMonthOffset(0)
              setSelectedDate(dateKey(new Date()))
            }}
            style={{
              background: (view === 'week' ? weekOffset : monthOffset) === 0 ? '#1a1a18' : '#f5f4f0',
              border: 'none',
              borderRadius: 8,
              padding: '4px 10px',
              fontSize: 11,
              fontWeight: 500,
              color: (view === 'week' ? weekOffset : monthOffset) === 0 ? 'white' : '#6b6960',
              cursor: 'pointer',
            }}
          >
            Today
          </button>

          <button
            onClick={() => (view === 'week' ? setWeekOffset((w) => w + 1) : setMonthOffset((m) => m + 1))}
            style={{
              background: '#f5f4f0',
              border: 'none',
              borderRadius: 8,
              width: 28,
              height: 28,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#6b6960" strokeWidth="1.5">
              <path d="M4.5 2l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      {view === 'week' ? (
        <MobileWeekCalendar
          tasks={tasks}
          weekOffset={weekOffset}
          selectedDate={selectedDate}
          onSelectDay={setSelectedDate}
        />
      ) : (
        <MobileMonthCalendar
          tasks={tasks}
          monthOffset={monthOffset}
          selectedDate={selectedDate}
          onSelectDay={setSelectedDate}
        />
      )}

      <MobileDayList
        tasks={tasks}
        selectedDate={selectedDate}
        onToggle={onToggle}
        onAddTask={(date) => setConfirmDate(date)}
      />

      {confirmDate && (
        <ConfirmCaptureModal
          date={confirmDate}
          onConfirm={() => {
            setConfirmDate(null)
            router.push('/capture')
          }}
          onCancel={() => setConfirmDate(null)}
        />
      )}
    </div>
  )
}

export default function TaskSchedulerClient({ tasks, deals, contacts }: Props) {
  const isDesktop = useIsDesktop()
  const router = useRouter()
  const [view, setView] = useState<'week' | 'month'>('month')
  const [weekOffset, setWeekOffset] = useState(0)
  const [monthOffset, setMonthOffset] = useState(0)
  const [localTasks, setLocalTasks] = useState<Task[]>(tasks)
  const [confirmDate, setConfirmDate] = useState<string | null>(null)

  useEffect(() => {
    setLocalTasks(tasks)
  }, [tasks])

  async function toggleTask(id: string, done: boolean) {
    setLocalTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: done ? 'done' : 'todo' } : t)),
    )

    try {
      await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: done ? 'done' : 'todo', done }),
      })
    } catch {
      setLocalTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, status: done ? 'todo' : 'done' } : t)),
      )
    }
  }

  function handleDayClick(date: string) {
    setConfirmDate(date)
  }

  const activeTasks = localTasks.filter((t) => t.status !== 'cancelled')
  const doneTasks = activeTasks.filter((t) => t.status === 'done').length
  const totalTasks = activeTasks.length

  if (!isDesktop) {
    return <MobileCalendarView tasks={localTasks} onToggle={toggleTask} />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden' }}>
      <div
        style={{
          height: 56,
          flexShrink: 0,
          background: 'white',
          borderBottom: '0.5px solid rgba(0,0,0,0.06)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 20px',
          gap: 12,
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 500, color: '#1a1a18', flex: 1 }}>Tasks</span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 80,
              height: 4,
              background: '#f1efea',
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                borderRadius: 2,
                background: '#1a1a18',
                transition: 'width 0.3s',
                width: totalTasks > 0 ? `${Math.round((doneTasks / totalTasks) * 100)}%` : '0%',
              }}
            />
          </div>
          <span style={{ fontSize: 12, color: '#9b9890' }}>
            {doneTasks}/{totalTasks}
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 2,
            background: '#f5f4f0',
            borderRadius: 9,
            padding: 3,
          }}
        >
          {(['week', 'month'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                background: view === v ? 'white' : 'transparent',
                border: 'none',
                borderRadius: 7,
                padding: '4px 10px',
                fontSize: 12,
                fontWeight: view === v ? 500 : 400,
                color: view === v ? '#1a1a18' : '#6b6960',
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {v}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            onClick={() => (view === 'week' ? setWeekOffset((w) => w - 1) : setMonthOffset((m) => m - 1))}
            style={{
              background: '#f5f4f0',
              border: 'none',
              borderRadius: 8,
              width: 28,
              height: 28,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#6b6960" strokeWidth="1.5">
              <path d="M7.5 2L3.5 6l4 4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <button
            onClick={() => {
              setWeekOffset(0)
              setMonthOffset(0)
            }}
            style={{
              background: (view === 'week' ? weekOffset : monthOffset) === 0 ? '#1a1a18' : '#f5f4f0',
              border: 'none',
              borderRadius: 8,
              padding: '4px 10px',
              fontSize: 11,
              fontWeight: 500,
              color: (view === 'week' ? weekOffset : monthOffset) === 0 ? 'white' : '#6b6960',
              cursor: 'pointer',
            }}
          >
            Today
          </button>

          <button
            onClick={() => (view === 'week' ? setWeekOffset((w) => w + 1) : setMonthOffset((m) => m + 1))}
            style={{
              background: '#f5f4f0',
              border: 'none',
              borderRadius: 8,
              width: 28,
              height: 28,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#6b6960" strokeWidth="1.5">
              <path d="M4.5 2l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <Link
          href="/capture"
          style={{
            background: '#1a1a18',
            color: 'white',
            borderRadius: 10,
            padding: '7px 14px',
            fontSize: 12,
            fontWeight: 500,
            textDecoration: 'none',
          }}
        >
          + Add Task
        </Link>
      </div>

      <div style={{ flex: 1, overflow: 'hidden', background: '#f5f4f0' }}>
        {view === 'week' ? (
          <WeekView tasks={localTasks} weekOffset={weekOffset} onToggle={toggleTask} onDayClick={handleDayClick} />
        ) : (
          <MonthView
            tasks={localTasks}
            monthOffset={monthOffset}
            onToggle={toggleTask}
            onDayClick={handleDayClick}
          />
        )}
      </div>

      {confirmDate && (
        <ConfirmCaptureModal
          date={confirmDate}
          onConfirm={() => {
            setConfirmDate(null)
            router.push('/capture')
          }}
          onCancel={() => setConfirmDate(null)}
        />
      )}
    </div>
  )
}