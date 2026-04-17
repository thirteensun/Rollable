'use client'

import { useState, useRef, useEffect } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────
type Deal = {
  id: string; name: string; stage: string; value?: number
  confirmed_revenue?: number; updated_at: string; payment_status?: string
}
type Contact = { id: string; full_name: string; role?: string; updated_at: string }
type Task = { id: string; title?: string; status?: string; due_date?: string }
type Message = { role: 'user' | 'assistant'; content: string; id: string; agent?: 'action' | 'analytics' }

type Signal = {
  id: string
  type: 'risk' | 'opportunity' | 'action' | 'info'
  title: string
  subtitle: string
  prompt: string
  secondaryPrompt?: string
  taskActions?: boolean // signals that offer calendar/email follow-up
}

type Props = { deals: Deal[]; contacts: Contact[]; tasks: Task[] }

// ─── Constants ────────────────────────────────────────────────────────────────
const C = {
  bg: '#f5f4f0', dark: '#1a1a18', muted: '#6b6960', faint: '#9b9890',
  border: 'rgba(0,0,0,0.07)', red: '#E24B4A', amber: '#EF9F27', green: '#1D9E75',
  card: 'white',
}

const STAGE_LABELS: Record<string, string> = {
  lead: 'Lead', qualified: 'Qualified', demo: 'Demo',
  proposal: 'Proposal', negotiation: 'Negotiation',
  closed_won: 'Won', closed_lost: 'Lost',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const daysSince = (d: string) => Math.floor((Date.now() - new Date(d).getTime()) / 86400000)
const daysUntil = (d?: string) => d ? Math.ceil((new Date(d).getTime() - Date.now()) / 86400000) : null
const fmt = (v?: number) => {
  if (!v) return '—'
  if (v >= 1000000) return `€${(v / 1000000).toFixed(1)}m`
  if (v >= 1000) return `€${(v / 1000).toFixed(0)}k`
  return `€${v}`
}
let _msgId = 0
const newId = () => String(++_msgId)

// ─── Signal builder ───────────────────────────────────────────────────────────
function buildSignals(deals: Deal[], tasks: Task[]): Signal[] {
  const signals: Signal[] = []
  const active = deals.filter(d => !['closed_won', 'closed_lost'].includes(d.stage))
  const won = deals.filter(d => d.stage === 'closed_won')
  const lost = deals.filter(d => d.stage === 'closed_lost')

  // At-risk deals
  active
    .filter(d => daysSince(d.updated_at) >= 14)
    .sort((a, b) => daysSince(b.updated_at) - daysSince(a.updated_at))
    .slice(0, 2)
    .forEach(d => {
      signals.push({
        id: `risk-${d.id}`,
        type: 'risk',
        title: `${d.name} going silent`,
        subtitle: `${fmt(d.value)} · ${daysSince(d.updated_at)}d no activity`,
        prompt: `Draft a short check-in message for ${d.name} — it's been ${daysSince(d.updated_at)} days since last contact`,
        secondaryPrompt: `Add a follow-up task for ${d.name}`,
        taskActions: true,
      })
    })

  // Hot deals with momentum
  active
    .filter(d => ['proposal', 'negotiation'].includes(d.stage) && daysSince(d.updated_at) < 7)
    .slice(0, 2)
    .forEach(d => {
      signals.push({
        id: `hot-${d.id}`,
        type: 'opportunity',
        title: `${d.name} has momentum`,
        subtitle: `${fmt(d.value)} · ${STAGE_LABELS[d.stage]} · ${daysSince(d.updated_at)}d ago`,
        prompt: `What's the best next move to close ${d.name}? It's in ${STAGE_LABELS[d.stage]}`,
        secondaryPrompt: `Draft a closing email for ${d.name}`,
        taskActions: true,
      })
    })

  // Uninvoiced
  const uninvoiced = won.filter(d => !d.payment_status || d.payment_status === 'none')
  if (uninvoiced.length > 0) {
    const total = uninvoiced.reduce((s, d) => s + (d.confirmed_revenue ?? d.value ?? 0), 0)
    signals.push({
      id: 'uninvoiced',
      type: 'action',
      title: `${fmt(total)} not yet invoiced`,
      subtitle: `${uninvoiced.length} won deal${uninvoiced.length > 1 ? 's' : ''} pending`,
      prompt: `Which deals are closed but not invoiced? List them and suggest what to do next.`,
    })
  }

  // Stalled 21+ days
  const stalled = active.filter(d => daysSince(d.updated_at) >= 21)
  if (stalled.length > 0) {
    signals.push({
      id: 'stalled',
      type: 'risk',
      title: `${stalled.length} deal${stalled.length > 1 ? 's' : ''} stalled 21+ days`,
      subtitle: stalled.map(d => d.name).slice(0, 3).join(', '),
      prompt: `These deals have been inactive for over 3 weeks: ${stalled.map(d => d.name).join(', ')}. What should I do?`,
      taskActions: true,
    })
  }

  // Overdue tasks
  const overdue = tasks.filter(t => t.status !== 'done' && t.due_date && daysUntil(t.due_date)! < 0)
  if (overdue.length > 0) {
    signals.push({
      id: 'overdue-tasks',
      type: 'action',
      title: `${overdue.length} overdue task${overdue.length > 1 ? 's' : ''}`,
      subtitle: overdue.slice(0, 2).map(t => t.title).filter(Boolean).join(', '),
      prompt: `I have ${overdue.length} overdue tasks: ${overdue.slice(0,5).map(t => t.title).filter(Boolean).join(', ')}. Help me prioritise what to tackle first.`,
      taskActions: true,
    })
  }

  // Low win rate
  const total = won.length + lost.length
  const winRate = total >= 3 ? Math.round((won.length / total) * 100) : null
  if (winRate !== null && winRate < 40) {
    signals.push({
      id: 'low-winrate',
      type: 'info',
      title: `Win rate at ${winRate}%`,
      subtitle: `${won.length} won · ${lost.length} lost`,
      prompt: `My win rate is ${winRate}% (${won.length} won, ${lost.length} lost). What patterns might explain this and how can I improve?`,
    })
  }

  // Thin pipeline
  const pipelineVal = active.reduce((s, d) => s + (d.value || 0), 0)
  const wonVal = won.reduce((s, d) => s + (d.confirmed_revenue || d.value || 0), 0)
  if (active.length > 0 && wonVal > 0 && pipelineVal < wonVal * 0.5) {
    signals.push({
      id: 'thin-pipeline',
      type: 'info',
      title: 'Pipeline looks thin',
      subtitle: `${fmt(pipelineVal)} active vs ${fmt(wonVal)} already closed`,
      prompt: `My active pipeline is only ${fmt(pipelineVal)} compared to ${fmt(wonVal)} already closed. What should I focus on to build it up?`,
    })
  }

  return signals
}

// ─── Common questions ─────────────────────────────────────────────────────────
const QUESTION_GROUPS = [
  {
    group: 'Pipeline',
    questions: [
      'Summarise my pipeline by stage',
      'What is my weighted forecast?',
      'Which deals are most likely to close this month?',
      'Which stage has the most value stuck in it?',
      'How many deals do I have in each stage?',
    ],
  },
  {
    group: 'Deals',
    questions: [
      'Which deals need immediate attention?',
      'What are my biggest risks right now?',
      'Which deals have been stalled the longest?',
      'Show me all deals in negotiation',
      'Which deal should I prioritise today?',
    ],
  },
  {
    group: 'Performance',
    questions: [
      'What is my win rate?',
      'How am I tracking against quota?',
      'What stage do I lose most deals at?',
      'What is my average deal size?',
      'How long does it take me to close a deal?',
    ],
  },
  {
    group: 'Strategy',
    questions: [
      'What should I focus on today?',
      'Draft a follow-up email for my most at-risk deal',
      'If I could only close one deal this week, which should it be?',
      'What objections should I prepare for my next proposal?',
      'Give me a pipeline health summary',
    ],
  },
]

// ─── Signal card ──────────────────────────────────────────────────────────────
function SignalCard({ s, onSend, onDismiss }: {
  s: Signal; onSend: (msg: string) => void; onDismiss: () => void
}) {
  const [showTaskActions, setShowTaskActions] = useState(false)
  const colors = {
    risk:        { accent: C.red,    bg: '#fdeaea' },
    opportunity: { accent: C.green,  bg: '#e8f5f0' },
    action:      { accent: C.amber,  bg: '#fdf3e3' },
    info:        { accent: C.faint,  bg: C.bg },
  }
  const { accent, bg } = colors[s.type]

  return (
    <div style={{ background: bg, borderRadius: 12, padding: '12px 13px', borderLeft: `2.5px solid ${accent}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: C.dark, marginBottom: 2 }}>{s.title}</div>
          <div style={{ fontSize: 11, color: C.muted }}>{s.subtitle}</div>
        </div>
        <button onClick={onDismiss} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: C.faint, fontSize: 15, lineHeight: 1, padding: '0 0 0 8px', flexShrink: 0,
        }}>×</button>
      </div>

      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        <button onClick={() => onSend(s.prompt)} style={{
          background: accent, color: 'white', border: 'none',
          borderRadius: 7, padding: '5px 10px', fontSize: 11, fontWeight: 500, cursor: 'pointer',
          fontFamily: 'inherit',
        }}>Ask AI →</button>
        {s.secondaryPrompt && (
          <button onClick={() => onSend(s.secondaryPrompt!)} style={{
            background: 'rgba(0,0,0,0.07)', color: C.muted, border: 'none',
            borderRadius: 7, padding: '5px 10px', fontSize: 11, cursor: 'pointer',
            fontFamily: 'inherit',
          }}>{s.secondaryPrompt.slice(0, 22)}…</button>
        )}
        {s.taskActions && (
          <button onClick={() => setShowTaskActions(v => !v)} style={{
            background: 'rgba(0,0,0,0.05)', color: C.faint, border: 'none',
            borderRadius: 7, padding: '5px 8px', fontSize: 11, cursor: 'pointer',
            fontFamily: 'inherit',
          }}>+</button>
        )}
      </div>

      {/* Task action sub-menu */}
      {showTaskActions && s.taskActions && (
        <div style={{
          marginTop: 8, padding: '8px 10px',
          background: 'rgba(0,0,0,0.04)', borderRadius: 8,
          display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          <div style={{ fontSize: 10, color: C.faint, marginBottom: 2 }}>Quick actions</div>
          {[
            { label: '📅 Schedule a call', prompt: `Draft a calendar invite for a call about: ${s.title}` },
            { label: '✉️ Write an email', prompt: `Write a concise email to address: ${s.title}` },
            { label: '✅ Create a task', prompt: `Create a follow-up task for: ${s.title}` },
          ].map(a => (
            <button key={a.label} onClick={() => { onSend(a.prompt); setShowTaskActions(false) }} style={{
              background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
              fontSize: 11, color: C.muted, padding: '3px 0', fontFamily: 'inherit',
            }}>{a.label}</button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Questions panel ──────────────────────────────────────────────────────────
function QuestionsPanel({ onSend }: { onSend: (msg: string) => void }) {
  const [openGroup, setOpenGroup] = useState<string>(QUESTION_GROUPS[0].group)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {QUESTION_GROUPS.map(group => (
        <div key={group.group} style={{
          background: C.card, borderRadius: 12,
          border: `0.5px solid ${C.border}`, overflow: 'hidden',
        }}>
          <button
            onClick={() => setOpenGroup(openGroup === group.group ? '' : group.group)}
            style={{
              width: '100%', background: 'none', border: 'none', cursor: 'pointer',
              padding: '10px 13px', display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', fontFamily: 'inherit',
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 500, color: C.dark }}>{group.group}</span>
            <span style={{
              fontSize: 10, color: C.faint,
              display: 'inline-block',
              transform: openGroup === group.group ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.15s',
            }}>▾</span>
          </button>
          {openGroup === group.group && (
            <div style={{ borderTop: `0.5px solid ${C.border}` }}>
              {group.questions.map((q, i) => (
                <button key={i} onClick={() => onSend(q)} style={{
                  width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                  padding: '9px 13px', textAlign: 'left', fontFamily: 'inherit',
                  fontSize: 12, color: C.muted, lineHeight: 1.4,
                  borderBottom: i < group.questions.length - 1 ? `0.5px solid ${C.border}` : 'none',
                  transition: 'background 0.1s, color 0.1s',
                }} className="question-btn">{q}</button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Chat history panel ───────────────────────────────────────────────────────
function HistoryPanel({ messages, onRestore }: {
  messages: Message[]
  onRestore: (msg: string) => void
}) {
  const userMessages = messages.filter(m => m.role === 'user')
  if (userMessages.length === 0) {
    return (
      <div style={{ padding: '20px 0', textAlign: 'center' }}>
        <div style={{ fontSize: 12, color: C.faint }}>No messages yet in this session.</div>
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontSize: 10, color: C.faint, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
        This session · {userMessages.length} message{userMessages.length !== 1 ? 's' : ''}
      </div>
      {userMessages.map((m, i) => (
        <button key={m.id} onClick={() => onRestore(m.content)} style={{
          background: C.card, border: `0.5px solid ${C.border}`,
          borderRadius: 10, padding: '9px 12px', textAlign: 'left',
          fontFamily: 'inherit', cursor: 'pointer',
          fontSize: 12, color: C.muted, lineHeight: 1.4,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }} className="question-btn">
          {m.content.slice(0, 80)}{m.content.length > 80 ? '…' : ''}
        </button>
      ))}
    </div>
  )
}

// ─── Copy button ──────────────────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1800)
      }}
      style={{
        background: 'none', border: `0.5px solid ${C.border}`,
        borderRadius: 6, padding: '3px 8px', cursor: 'pointer',
        fontSize: 10, color: copied ? C.green : C.faint,
        fontFamily: 'inherit', flexShrink: 0,
        transition: 'color 0.2s',
      }}
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function AISandboxClient({ deals, contacts, tasks }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [history, setHistory] = useState<unknown[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState<'signals' | 'questions' | 'history'>('signals')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const active = deals.filter(d => !['closed_won', 'closed_lost'].includes(d.stage))
  const signals = buildSignals(deals, tasks)
  const activeSignals = signals.filter(s => !dismissed.has(s.id))

  const pipelineContext = [
    `Active deals: ${active.length}, total value: ${fmt(active.reduce((s, d) => s + (d.value ?? 0), 0))}`,
    active.length > 0
      ? `Deals: ${active.map(d => `${d.name} (${STAGE_LABELS[d.stage]}, ${fmt(d.value)}, last touched ${daysSince(d.updated_at)}d ago)`).join('; ')}`
      : '',
    tasks.length > 0
      ? `Open tasks: ${tasks.slice(0, 10).map(t => t.title).filter(Boolean).join(', ')}`
      : '',
  ].filter(Boolean).join('. ')

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return
    const userMsg: Message = { role: 'user', content: text, id: newId() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const contextualMessage = messages.length === 0
        ? `[Context: ${pipelineContext}]\n\n${text}`
        : text

      const res = await fetch('/api/sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: contextualMessage, history }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply, id: newId(), agent: data.agent }])
      setHistory(data.history)
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong. Please try again.', id: newId() }])
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) }
  }

  const quickPrompts = [
    'Summarise my pipeline',
    'What needs attention?',
    'Forecast to close',
    'Where deals drop off',
  ]

  return (
    // Fixed layout — escapes layout.tsx wrapper same pattern as Kanban
    <>
      <div style={{ height: '100vh' }} />
      <div style={{
        position: 'fixed', top: 0, left: 210, right: 0, bottom: 0,
        display: 'flex', zIndex: 10, background: C.bg,
      }}>

        {/* ── Left: Chat ─────────────────────────────────────────────────── */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          background: C.card, minWidth: 0,
          borderRight: `0.5px solid ${C.border}`,
        }}>

          {/* Header */}
          <div style={{
            height: 52, flexShrink: 0,
            borderBottom: `0.5px solid ${C.border}`,
            display: 'flex', alignItems: 'center', padding: '0 20px', gap: 10,
          }}>
            <div style={{
              width: 26, height: 26, borderRadius: 8, background: C.dark,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M1 6h2l1.5-4 2 8 1.5-4H11" stroke="white" strokeWidth="1.2"
                  strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
              </svg>
            </div>
            <span style={{ fontSize: 13, fontWeight: 500, color: C.dark }}>AI Sandbox</span>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.green }} />
            <span style={{ fontSize: 11, color: C.faint, marginLeft: -4 }}>live</span>
            <div style={{ flex: 1 }} />
            {messages.length > 0 && (
              <button onClick={() => { setMessages([]); setHistory([]) }} style={{
                background: C.bg, border: 'none', borderRadius: 7,
                padding: '4px 10px', fontSize: 11, color: C.faint,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>Clear</button>
            )}
          </div>

          {/* Messages — scrollable */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 8px' }}>

            {/* Empty state */}
            {messages.length === 0 && (
              <div style={{ paddingTop: 24 }}>
                <div style={{ marginBottom: 28 }}>
                  <div style={{ fontSize: 20, fontWeight: 500, color: C.dark, marginBottom: 6, letterSpacing: '-0.02em' }}>
                    What do you want to know?
                  </div>
                  <div style={{ fontSize: 13, color: C.faint, lineHeight: 1.6 }}>
                    Your pipeline is loaded. Ask anything about deals, forecast, or what to do next.
                  </div>
                </div>

                {/* Quick chips */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 28 }}>
                  {quickPrompts.map(p => (
                    <button key={p} onClick={() => sendMessage(p)} style={{
                      background: C.bg, border: `0.5px solid ${C.border}`,
                      borderRadius: 20, padding: '7px 14px',
                      fontSize: 12, color: C.muted, cursor: 'pointer',
                      fontFamily: 'inherit', transition: 'all 0.15s',
                    }} className="chip-btn">{p}</button>
                  ))}
                </div>

                {/* Pipeline snapshot */}
                {active.length > 0 && (
                  <div style={{
                    padding: '14px 16px', background: C.bg,
                    border: `0.5px solid ${C.border}`, borderRadius: 14,
                  }}>
                    <div style={{ fontSize: 10, color: C.faint, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
                      Pipeline snapshot
                    </div>
                    <div style={{ display: 'flex', gap: 24 }}>
                      <div>
                        <div style={{ fontSize: 22, fontWeight: 500, color: C.dark, letterSpacing: '-0.02em' }}>{active.length}</div>
                        <div style={{ fontSize: 10, color: C.faint }}>active deals</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 22, fontWeight: 500, color: C.dark, letterSpacing: '-0.02em' }}>
                          {fmt(active.reduce((s, d) => s + (d.value ?? 0), 0))}
                        </div>
                        <div style={{ fontSize: 10, color: C.faint }}>pipeline value</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em',
                          color: active.filter(d => daysSince(d.updated_at) >= 14).length > 0 ? C.red : C.green,
                        }}>
                          {active.filter(d => daysSince(d.updated_at) >= 14).length}
                        </div>
                        <div style={{ fontSize: 10, color: C.faint }}>at risk</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Message list */}
            {messages.map((m) => (
              <div key={m.id} style={{
                display: 'flex',
                flexDirection: m.role === 'user' ? 'row-reverse' : 'row',
                alignItems: 'flex-start', gap: 8, marginBottom: 12,
              }}>
                {/* Avatar */}
                {m.role === 'assistant' && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: 6,
                      background: m.agent === 'action' ? '#1a1a18' : '#3d7de4', marginTop: 2,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                        <path d="M1 6h2l1.5-4 2 8 1.5-4H11" stroke="white" strokeWidth="1.2"
                          strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    {m.agent && (
                      <span style={{ fontSize: 8, color: m.agent === 'action' ? C.muted : '#3d7de4', fontWeight: 500, letterSpacing: '0.02em' }}>
                        {m.agent === 'action' ? 'ACTION' : 'ANALYSIS'}
                      </span>
                    )}
                  </div>
                )}

                <div style={{ maxWidth: '78%', display: 'flex', flexDirection: 'column', gap: 4,
                  alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    background: m.role === 'user' ? C.dark : C.bg,
                    color: m.role === 'user' ? 'white' : C.dark,
                    borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '4px 16px 16px 16px',
                    padding: '10px 14px', fontSize: 13, lineHeight: 1.65, whiteSpace: 'pre-wrap',
                  }}>
                    {m.content}
                  </div>
                  {/* Copy button on assistant messages */}
                  {m.role === 'assistant' && (
                    <CopyButton text={m.content} />
                  )}
                </div>
              </div>
            ))}

            {/* Loading */}
            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <div style={{
                  width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                  background: C.dark, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                    <path d="M1 6h2l1.5-4 2 8 1.5-4H11" stroke="white" strokeWidth="1.2"
                      strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div style={{
                  background: C.bg, borderRadius: '4px 16px 16px 16px',
                  padding: '10px 14px', display: 'flex', gap: 4, alignItems: 'center',
                }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: 5, height: 5, borderRadius: '50%', background: C.faint,
                      animation: `pulse 1s ease-in-out ${i * 0.18}s infinite`,
                    }} />
                  ))}
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input — always visible at bottom */}
          <div style={{
            padding: '10px 16px 14px',
            borderTop: `0.5px solid ${C.border}`,
            display: 'flex', gap: 8, alignItems: 'flex-end', flexShrink: 0,
            background: C.card,
          }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about your pipeline…"
              rows={1}
              style={{
                flex: 1, background: C.bg, border: `0.5px solid ${C.border}`,
                borderRadius: 12, padding: '10px 14px', fontSize: 13, color: C.dark,
                resize: 'none', outline: 'none', fontFamily: 'inherit',
                lineHeight: 1.5, maxHeight: 100, overflowY: 'auto',
              }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              style={{
                width: 36, height: 36, flexShrink: 0,
                background: input.trim() && !loading ? C.dark : C.bg,
                border: 'none', borderRadius: 10,
                cursor: input.trim() && !loading ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.15s',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M6.5 11V2M2 6.5l4.5-4.5 4.5 4.5"
                  stroke={input.trim() && !loading ? 'white' : C.faint}
                  strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Right panel ───────────────────────────────────────────────── */}
        <div style={{
          width: 296, flexShrink: 0, display: 'flex', flexDirection: 'column',
          background: C.bg, overflow: 'hidden',
        }}>

          {/* Tab bar */}
          <div style={{
            height: 52, flexShrink: 0, background: C.card,
            borderBottom: `0.5px solid ${C.border}`,
            display: 'flex', alignItems: 'center', padding: '0 10px', gap: 2,
          }}>
            {([
              { key: 'signals' as const,   label: 'Signals',   badge: activeSignals.length },
              { key: 'questions' as const, label: 'Questions', badge: 0 },
              { key: 'history' as const,   label: 'History',   badge: messages.filter(m => m.role === 'user').length },
            ]).map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                background: activeTab === tab.key ? C.bg : 'transparent',
                border: 'none', borderRadius: 8, padding: '5px 9px',
                fontSize: 11, fontWeight: activeTab === tab.key ? 500 : 400,
                color: activeTab === tab.key ? C.dark : C.faint,
                cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                {tab.label}
                {tab.badge > 0 && (
                  <span style={{
                    background: C.dark, color: 'white',
                    fontSize: 9, fontWeight: 600, borderRadius: 8, padding: '1px 5px',
                  }}>{tab.badge}</span>
                )}
              </button>
            ))}
          </div>

          {/* Panel body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>

            {activeTab === 'signals' && (
              activeSignals.length === 0 ? (
                <div style={{
                  background: C.card, borderRadius: 14,
                  padding: '28px 16px', textAlign: 'center', marginTop: 8,
                }}>
                  <div style={{ fontSize: 20, marginBottom: 8 }}>✓</div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: C.dark, marginBottom: 4 }}>Pipeline looks healthy</div>
                  <div style={{ fontSize: 11, color: C.faint }}>No signals right now.</div>
                </div>
              ) : (
                activeSignals.map(s => (
                  <SignalCard
                    key={s.id} s={s}
                    onSend={msg => sendMessage(msg)}
                    onDismiss={() => setDismissed(prev => { const n = new Set(prev); n.add(s.id); return n })}
                  />
                ))
              )
            )}

            {activeTab === 'questions' && (
              <QuestionsPanel onSend={msg => { sendMessage(msg) }} />
            )}

            {activeTab === 'history' && (
              <HistoryPanel
                messages={messages}
                onRestore={msg => setInput(msg)}
              />
            )}

          </div>
        </div>

      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.85); }
          50% { opacity: 1; transform: scale(1); }
        }
        .chip-btn:hover { background: #ebe9e4 !important; }
        .question-btn:hover { background: #f5f4f0 !important; color: #1a1a18 !important; }
        textarea::placeholder { color: #9b9890; }
        * { box-sizing: border-box; }
      `}</style>
    </>
  )
}