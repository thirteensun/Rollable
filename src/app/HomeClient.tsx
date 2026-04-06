'use client'

import BottomNav from '@/components/layout/BottomNav'

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
  contacts: { full_name: string } | null
  deals: { name: string } | null
  companies: { name: string } | null
}

interface Props {
  name: string
  initials: string
  tasks: Task[]
  events: Event[]
  orgName: string | null
  userRole: string
}

function getTaskUrgency(task: Task): string {
  if (!task.due_date) return '#9b9890'
  const due = new Date(task.due_date)
  const now = new Date()
  if (due < now) return '#E24B4A'
  const diff = due.getTime() - now.getTime()
  const hours = diff / (1000 * 60 * 60)
  if (hours < 24) return '#EF9F27'
  return '#1D9E75'
}

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days === 1) return 'Yesterday'
  return `${days}d ago`
}

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

const avatarColors = [
  { bg: '#E6F1FB', color: '#185FA5' },
  { bg: '#E1F5EE', color: '#0F6E56' },
  { bg: '#FAEEDA', color: '#854F0B' },
  { bg: '#EEEDFE', color: '#534AB7' },
  { bg: '#FCEBEB', color: '#A32D2D' },
]

const eventTypeLabel: Record<string, string> = {
  meeting: 'Meeting logged',
  call: 'Call logged',
  email: 'Email captured',
  whatsapp: 'WhatsApp captured',
  note: 'Note added',
  card_scan: 'Business card scanned',
  voice_memo: 'Voice memo logged',
  other: 'Activity logged',
}

export default function HomeClient({ name, initials, tasks, events, orgName, userRole }: Props) {



  const greeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }

  return (
    <main style={{ minHeight: '100dvh', background: '#f5f4f0', paddingBottom: '100px' }}>

      {/* Header */}
      <div style={{ padding: '56px 24px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <p style={{ margin: 0, fontSize: '13px', color: '#9b9890' }}>
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: '26px', fontWeight: 500, color: '#1a1a18' }}>
            {greeting()}, {name.split(' ')[0]}
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
        <a href="/settings" style={{ textDecoration: 'none' }}>
          <div style={{
            width: '38px', height: '38px', borderRadius: '50%',
            background: '#1a1a18', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '13px', fontWeight: 500,
            color: '#f5f4f0', cursor: 'pointer',
          }}>
            {initials}
          </div>
        </a>
      </div>

      {/* Search */}
      <div style={{ padding: '0 24px 16px' }}>
        <div style={{
          background: 'white', borderRadius: '16px',
          border: '0.5px solid rgba(0,0,0,0.07)',
          padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="5.5" stroke="#9b9890" strokeWidth="1.2" />
            <path d="M11 11l2.5 2.5" stroke="#9b9890" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          <span style={{ fontSize: '14px', color: '#9b9890' }}>Search contacts, deals, notes...</span>
        </div>
      </div>

      {/* Today's focus */}
      <div style={{ padding: '0 24px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <p style={{ margin: 0, fontSize: '12px', fontWeight: 500, color: '#9b9890', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Today's focus
          </p>
          <a href="/planning" style={{ fontSize: '13px', color: '#9b9890', textDecoration: 'none' }}>
            See all
          </a>
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
              <div key={task.id} className="animate-fade-in-up" style={{
                background: 'white', borderRadius: '14px',
                border: '0.5px solid rgba(0,0,0,0.07)',
                padding: '13px 14px', display: 'flex',
                alignItems: 'center', gap: '12px', cursor: 'pointer',
                animationDelay: `${i * 0.05}s`,
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
            ))}
          </div>
        )}
      </div>

      {/* Recent activity */}
      <div style={{ padding: '0 24px' }}>
        <p style={{ margin: '0 0 12px', fontSize: '12px', fontWeight: 500, color: '#9b9890', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Recent activity
        </p>

        {events.length === 0 ? (
          <div style={{
            background: 'white', borderRadius: '14px',
            border: '0.5px solid rgba(0,0,0,0.07)',
            padding: '24px', textAlign: 'center',
          }}>
            <p style={{ margin: '0 0 8px', fontSize: '14px', color: '#1a1a18', fontWeight: 500 }}>No activity yet</p>
            <p style={{ margin: 0, fontSize: '13px', color: '#9b9890' }}>Tap Capture to log your first interaction</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {events.map((event, i) => {
              const contactName = event.contacts?.full_name || null
              const companyName = event.companies?.name || null
              const dealName = event.deals?.name || null
              const palette = avatarColors[i % avatarColors.length]
              const displayName = contactName || companyName || 'Activity'
              const label = eventTypeLabel[event.type] || 'Activity logged'

              const created = []
              if (contactName) created.push(`Contact — ${contactName}`)
              if (dealName) created.push(`Deal — ${dealName}`)
              if (companyName && !contactName) created.push(`Company — ${companyName}`)

              return (
                <div key={event.id} style={{
                  background: 'white', borderRadius: '14px',
                  border: '0.5px solid rgba(0,0,0,0.07)', padding: '13px 14px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <div style={{
                      width: '28px', height: '28px', borderRadius: '8px',
                      background: palette.bg, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: '10px', fontWeight: 500,
                      color: palette.color, flexShrink: 0,
                    }}>
                      {getInitials(displayName)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: '13px', fontWeight: 500, color: '#1a1a18' }}>{label}</p>
                      <p style={{ margin: 0, fontSize: '11px', color: '#9b9890' }}>{timeAgo(event.created_at)}</p>
                    </div>
                  </div>

                  {created.length > 0 && (
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '6px' }}>
                      {created.map((item, j) => (
                        <span key={j} style={{
                          fontSize: '11px', color: '#6b6960',
                          background: '#f5f4f0', borderRadius: '6px',
                          padding: '3px 8px',
                        }}>
                          {item}
                        </span>
                      ))}
                    </div>
                  )}

                  {event.summary && (
                    <p style={{ margin: 0, fontSize: '13px', color: '#9b9890', lineHeight: 1.5 }}>
                      {event.summary}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <BottomNav />
    </main>
  )
}