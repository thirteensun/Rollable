'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface Task {
  id: string
  title: string
  due_date: string | null
  contacts: { full_name: string } | null
  deals: { name: string } | null
}

interface Props {
  overdue: Task[]
  today: Task[]
  thisWeek: Task[]
  noDueDate: Task[]
}

function TaskItem({ task, onDone }: { task: Task; onDone: (id: string) => void }) {
  const [done, setDone] = useState(false)

  const handleDone = async () => {
    setDone(true)
    const supabase = createClient()
    await supabase.from('tasks').update({ done: true, done_at: new Date().toISOString() }).eq('id', task.id)
    setTimeout(() => onDone(task.id), 300)
  }

  const sub = [task.contacts?.full_name, task.deals?.name].filter(Boolean).join(' · ')

  return (
    <div style={{
      background: 'white', borderRadius: '14px',
      border: '0.5px solid rgba(0,0,0,0.07)',
      padding: '13px 16px', display: 'flex',
      alignItems: 'center', gap: '12px',
      opacity: done ? 0.4 : 1,
      transition: 'opacity 0.3s ease',
    }}>
      <button onClick={handleDone} style={{
        width: '22px', height: '22px', borderRadius: '50%',
        border: done ? 'none' : '1.5px solid rgba(0,0,0,0.15)',
        background: done ? '#1D9E75' : 'transparent',
        flexShrink: 0, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {done && <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        </svg>}
      </button>
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: '#1a1a18', textDecoration: done ? 'line-through' : 'none' }}>
          {task.title}
        </p>
        {sub && <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#9b9890' }}>{sub}</p>}
      </div>
      {task.due_date && (
        <span style={{ fontSize: '12px', color: '#9b9890', flexShrink: 0 }}>
          {new Date(task.due_date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
        </span>
      )}
    </div>
  )
}

function Section({ title, tasks, color, onDone }: { title: string; tasks: Task[]; color?: string; onDone: (id: string) => void }) {
  if (tasks.length === 0) return null
  return (
    <div style={{ padding: '0 24px 16px' }}>
      <p style={{ margin: '0 0 12px', fontSize: '12px', fontWeight: 500, color: color || '#9b9890', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        {title}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {tasks.map(task => <TaskItem key={task.id} task={task} onDone={onDone} />)}
      </div>
    </div>
  )
}

export default function PlanningClient({ overdue, today, thisWeek, noDueDate }: Props) {
  const [overdueList, setOverdue] = useState(overdue)
  const [todayList, setToday] = useState(today)
  const [weekList, setWeek] = useState(thisWeek)
  const [noDueDateList, setNoDueDate] = useState(noDueDate)

  const removeTask = (list: Task[], setList: (t: Task[]) => void) => (id: string) => {
    setList(list.filter(t => t.id !== id))
  }

  const total = overdueList.length + todayList.length + weekList.length + noDueDateList.length

  return (
    <main style={{ background: '#f5f4f0', paddingBottom: 0 }}>
      <div style={{ padding: '56px 24px 20px' }}>
        <p style={{ margin: 0, fontSize: '13px', color: '#9b9890' }}>
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}
        </p>
        <p style={{ margin: '4px 0 0', fontSize: '26px', fontWeight: 500, color: '#1a1a18' }}>Planning</p>
        {total > 0 && <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#9b9890' }}>{total} tasks open</p>}
      </div>

      {total === 0 ? (
        <div style={{ padding: '0 24px' }}>
          <div style={{
            background: 'white', borderRadius: '18px',
            border: '0.5px solid rgba(0,0,0,0.07)',
            padding: '32px', textAlign: 'center',
          }}>
            <p style={{ margin: '0 0 8px', fontSize: '17px', fontWeight: 500, color: '#1a1a18' }}>All clear</p>
            <p style={{ margin: 0, fontSize: '14px', color: '#9b9890' }}>No tasks due. Tap Capture to log something new.</p>
          </div>
        </div>
      ) : (
        <>
          <Section title="Overdue" tasks={overdueList} color="#E24B4A" onDone={removeTask(overdueList, setOverdue)} />
          <Section title="Today" tasks={todayList} onDone={removeTask(todayList, setToday)} />
          <Section title="This week" tasks={weekList} onDone={removeTask(weekList, setWeek)} />
          <Section title="No due date" tasks={noDueDateList} onDone={removeTask(noDueDateList, setNoDueDate)} />
        </>
      )}

    </main>
  )
}