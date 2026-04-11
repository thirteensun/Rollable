'use client'

import { useState, useEffect, useOptimistic, useTransition } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  if (!task.due_date || task.status === 'done') return false
  return task.due_date.slice(0, 10) < dateKey(new Date())
}

function fmt(d: Date) {
  return d.toLocaleDateString('en-US', { weekday: 'short' })
}

function fmtNum(d: Date) {
  return d.getDate()
}

function fmtMonth(d: Date) {
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

const PRIORITY_COLOR: Record<string, string> = {
  high: '#E24B4A',
  medium: '#EF9F27',
  low: '#9b9890',
}

// ─── Task chip ────────────────────────────────────────────────────────────────

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
  const overdue = isOverdue(task)
  const priorityColor = task.priority ? PRIORITY_COLOR[task.priority] : undefined

  return (
    <div
      onClick={() => onToggle(task.id, !done)}
      style={{
        background: overdue ? '#fdeaea' : done ? 'transparent' : '#f5f4f0',
        borderRadius: 8,
        padding: compact ? '5px 8px' : '7px 9px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 7,
        borderLeft: priorityColor && !done ? `2px solid ${priorityColor}` : '2px solid transparent',
        opacity: done ? 0.5 : 1,
        transition: 'opacity 0.2s, background 0.15s',
        marginBottom: 4,
      }}
      className="task-chip"
    >
      {/* Checkbox */}
      <div style={{
        width: 14, height: 14, borderRadius: 4, flexShrink: 0, marginTop: 1,
        border: done ? 'none' : '1.5px solid rgba(0,0,0,0.2)',
        background: done ? '#1D9E75' : 'white',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {done && (
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <path d="M1.5 4L3 5.5L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>
      <span style={{
        fontSize: 11,
        color: overdue ? '#E24B4A' : done ? '#9b9890' : '#1a1a18',
        textDecoration: done ? 'line-through' : 'none',
        lineHeight: 1.4,
        flex: 1,
      }}>
        {task.title ?? 'Untitled task'}
      </span>
    </div>
  )
}

// ─── Desktop week view ────────────────────────────────────────────────────────

function WeekView({
  tasks,
  weekOffset,
  onToggle,
  onAddTask,
}: {
  tasks: Task[]
  weekOffset: number
  onToggle: (id: string, done: boolean) => void
  onAddTask: (date: string) => void
}) {
  const days = getWeekDays(weekOffset)
  const overdueTasks = tasks.filter(isOverdue)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Week label */}
      <div style={{
        padding: '10px 16px 8px',
        fontSize: 12,
        color: '#9b9890',
        flexShrink: 0,
      }} suppressHydrationWarning>
        {fmtMonth(days[0])}
      </div>

      {/* Overdue banner */}
      {overdueTasks.length > 0 && weekOffset === 0 && (
        <div style={{
          margin: '0 16px 10px',
          background: '#fdeaea',
          border: '0.5px solid rgba(226,75,74,0.2)',
          borderRadius: 12,
          padding: '10px 14px',
          flexShrink: 0,
        }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: '#E24B4A', marginBottom: 6 }}>
            Overdue · {overdueTasks.length} task{overdueTasks.length > 1 ? 's' : ''}
          </div>
          {overdueTasks.map(t => (
            <TaskChip key={t.id} task={t} onToggle={onToggle} compact />
          ))}
        </div>
      )}

      {/* Day columns */}
      <div style={{
        display: 'flex',
        gap: 8,
        padding: '0 16px 16px',
        flex: 1,
        overflow: 'hidden',
      }}>
        {days.map(day => {
          const key = dateKey(day)
          const dayTasks = tasks.filter(t => taskDateKey(t) === key && !isOverdue(t))
          const today = isToday(day)
          const past = isPast(day)

          return (
            <div
              key={key}
              style={{
                flex: 1,
                background: today ? 'white' : 'transparent',
                border: today
                  ? '0.5px solid rgba(0,0,0,0.1)'
                  : '0.5px solid rgba(0,0,0,0.06)',
                borderRadius: 14,
                padding: '12px 10px',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                opacity: past && !today ? 0.6 : 1,
              }}
            >
              {/* Day header */}
              <div style={{ marginBottom: 10, flexShrink: 0 }}>
                <div style={{
                  fontSize: 10, fontWeight: 500, color: '#9b9890',
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                  marginBottom: 2,
                }} suppressHydrationWarning>
                  {fmt(day)}
                </div>
                <div style={{
                  fontSize: 20, fontWeight: 500,
                  color: today ? '#1D9E75' : '#1a1a18',
                }} suppressHydrationWarning>
                  {fmtNum(day)}
                </div>
              </div>

              {/* Tasks */}
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {dayTasks.map(t => (
                  <TaskChip key={t.id} task={t} onToggle={onToggle} compact />
                ))}
              </div>

              {/* Add task */}
              <button
                onClick={() => onAddTask(key)}
                style={{
                  background: 'none', border: 'none',
                  cursor: 'pointer', fontSize: 10,
                  color: '#9b9890', textAlign: 'left',
                  padding: '4px 0', marginTop: 4,
                  flexShrink: 0,
                }}
                className="add-task-btn"
              >
                + Add
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Mobile urgency list ──────────────────────────────────────────────────────

function UrgencyList({ tasks, onToggle }: { tasks: Task[]; onToggle: (id: string, done: boolean) => void }) {
  const overdue = tasks.filter(isOverdue)
  const today = tasks.filter(t => taskDateKey(t) === dateKey(new Date()) && !isOverdue(t))
  const upcoming = tasks.filter(t => {
    const k = taskDateKey(t)
    if (!k) return false
    return k > dateKey(new Date()) && t.status !== 'done'
  })
  const noDue = tasks.filter(t => !t.due_date && t.status !== 'done')

  function Section({ title, items, color }: { title: string; items: Task[]; color?: string }) {
    if (items.length === 0) return null
    return (
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: color ?? '#6b6960', marginBottom: 8, padding: '0 16px' }}>
          {title} · {items.length}
        </div>
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {items.map(t => (
            <div key={t.id} style={{
              background: 'white', border: '0.5px solid rgba(0,0,0,0.07)',
              borderRadius: 14, padding: '12px 14px',
            }}>
              <TaskChip task={t} onToggle={onToggle} />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{ paddingTop: 16 }}>
      <div style={{ padding: '0 16px 16px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 500, color: '#1a1a18' }}>Tasks</h1>
      </div>
      <Section title="Overdue" items={overdue} color="#E24B4A" />
      <Section title="Today" items={today} color="#1a1a18" />
      <Section title="Upcoming" items={upcoming} />
      <Section title="No date" items={noDue} />
    </div>
  )
}

// ─── Add task modal (simple) ──────────────────────────────────────────────────

function AddTaskModal({
  date,
  deals,
  contacts,
  onClose,
  onSave,
}: {
  date: string
  deals: Deal[]
  contacts: Contact[]
  onClose: () => void
  onSave: (task: Partial<Task>) => void
}) {
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState('medium')
  const [dealId, setDealId] = useState('')

  function handleSave() {
    if (!title.trim()) return
    onSave({ title, priority, due_date: date, deal_id: dealId || undefined })
    onClose()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.3)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div style={{
        background: 'white', borderRadius: 20,
        padding: '24px', width: 360,
        display: 'flex', flexDirection: 'column', gap: 14,
      }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 15, fontWeight: 500, color: '#1a1a18' }}>
          Add task · {new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
        </div>

        <input
          autoFocus
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          placeholder="Task title…"
          style={{
            background: '#f5f4f0', border: 'none',
            borderRadius: 10, padding: '10px 14px',
            fontSize: 13, color: '#1a1a18', outline: 'none',
          }}
        />

        <div style={{ display: 'flex', gap: 6 }}>
          {['high', 'medium', 'low'].map(p => (
            <button
              key={p}
              onClick={() => setPriority(p)}
              style={{
                flex: 1, padding: '7px 0',
                borderRadius: 9, border: 'none',
                background: priority === p ? PRIORITY_COLOR[p] : '#f5f4f0',
                color: priority === p ? 'white' : '#6b6960',
                fontSize: 11, fontWeight: 500, cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {p}
            </button>
          ))}
        </div>

        {deals.length > 0 && (
          <select
            value={dealId}
            onChange={e => setDealId(e.target.value)}
            style={{
              background: '#f5f4f0', border: 'none',
              borderRadius: 10, padding: '10px 14px',
              fontSize: 13, color: dealId ? '#1a1a18' : '#9b9890',
              outline: 'none',
            }}
          >
            <option value="">Link to deal (optional)</option>
            {deals.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            background: '#f5f4f0', border: 'none', borderRadius: 10,
            padding: '9px 16px', fontSize: 13, color: '#6b6960', cursor: 'pointer',
          }}>
            Cancel
          </button>
          <button onClick={handleSave} style={{
            background: '#1a1a18', border: 'none', borderRadius: 10,
            padding: '9px 16px', fontSize: 13, fontWeight: 500,
            color: 'white', cursor: 'pointer',
          }}>
            Add task
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function TaskSchedulerClient({ tasks, deals, contacts }: Props) {
  const isDesktop = useIsDesktop()
  const [weekOffset, setWeekOffset] = useState(0)
  const [localTasks, setLocalTasks] = useState<Task[]>(tasks)
  const [addingFor, setAddingFor] = useState<string | null>(null)

  async function toggleTask(id: string, done: boolean) {
    // Optimistic update
    setLocalTasks(prev =>
      prev.map(t => t.id === id ? { ...t, status: done ? 'done' : 'pending' } : t)
    )
    // Persist
    try {
      await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: done ? 'done' : 'pending' }),
      })
    } catch {
      // Revert on failure
      setLocalTasks(prev =>
        prev.map(t => t.id === id ? { ...t, status: done ? 'pending' : 'done' } : t)
      )
    }
  }

  async function addTask(taskData: Partial<Task>) {
    const tempId = `temp-${Date.now()}`
    const newTask: Task = {
      id: tempId,
      title: taskData.title,
      status: 'pending',
      due_date: taskData.due_date,
      priority: taskData.priority,
      deal_id: taskData.deal_id,
      created_at: new Date().toISOString(),
    }
    setLocalTasks(prev => [...prev, newTask])

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData),
      })
      const saved = await res.json()
      setLocalTasks(prev => prev.map(t => t.id === tempId ? { ...t, id: saved.id } : t))
    } catch {
      setLocalTasks(prev => prev.filter(t => t.id !== tempId))
    }
  }

  const doneTasks = localTasks.filter(t => t.status === 'done').length
  const totalTasks = localTasks.length

  // ── Desktop ────────────────────────────────────────────────────────────────
  if (isDesktop) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden' }}>

        {/* Top bar */}
        <div style={{
          height: 50, flexShrink: 0,
          background: 'white',
          borderBottom: '0.5px solid rgba(0,0,0,0.07)',
          display: 'flex', alignItems: 'center',
          padding: '0 20px', gap: 12,
        }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: '#1a1a18', flex: 1 }}>Tasks</span>

          {/* Progress */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 80, height: 4, background: '#f5f4f0', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: totalTasks > 0 ? `${Math.round((doneTasks / totalTasks) * 100)}%` : '0%',
                background: '#1D9E75', borderRadius: 2,
                transition: 'width 0.3s ease',
              }} />
            </div>
            <span style={{ fontSize: 12, color: '#9b9890' }}>
              {doneTasks}/{totalTasks}
            </span>
          </div>

          {/* Week nav */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              onClick={() => setWeekOffset(w => w - 1)}
              style={{
                background: '#f5f4f0', border: 'none', borderRadius: 8,
                width: 28, height: 28, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#6b6960" strokeWidth="1.5">
                <path d="M7.5 2L3.5 6l4 4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <button
              onClick={() => setWeekOffset(0)}
              style={{
                background: weekOffset === 0 ? '#1a1a18' : '#f5f4f0',
                border: 'none', borderRadius: 8,
                padding: '4px 10px',
                fontSize: 11,
                color: weekOffset === 0 ? 'white' : '#6b6960',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              Today
            </button>
            <button
              onClick={() => setWeekOffset(w => w + 1)}
              style={{
                background: '#f5f4f0', border: 'none', borderRadius: 8,
                width: 28, height: 28, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#6b6960" strokeWidth="1.5">
                <path d="M4.5 2l4 4-4 4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Week grid */}
        <div style={{ flex: 1, overflow: 'hidden', background: '#f5f4f0' }}>
          <WeekView
            tasks={localTasks}
            weekOffset={weekOffset}
            onToggle={toggleTask}
            onAddTask={date => setAddingFor(date)}
          />
        </div>

        {/* Add task modal */}
        {addingFor && (
          <AddTaskModal
            date={addingFor}
            deals={deals}
            contacts={contacts}
            onClose={() => setAddingFor(null)}
            onSave={addTask}
          />
        )}

        <style>{`
          .add-task-btn:hover { color: #1a1a18 !important; }
          .task-chip:hover { opacity: 0.8; }
        `}</style>
      </div>
    )
  }

  // ── Mobile ─────────────────────────────────────────────────────────────────
  return <UrgencyList tasks={localTasks} onToggle={toggleTask} />
}
