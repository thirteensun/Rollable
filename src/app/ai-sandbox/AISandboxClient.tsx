'use client'

import { useState, useRef, useEffect } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Deal = {
  id: string
  name: string
  stage: string
  value?: number
  confirmed_revenue?: number
  updated_at: string
  payment_status?: string
}

type Contact = {
  id: string
  full_name: string
  role?: string
  updated_at: string
}

type Task = {
  id: string
  title?: string
  status?: string
  due_date?: string
}

type Message = {
  role: 'user' | 'assistant'
  content: string
}

type Suggestion = {
  id: string
  type: 'risk' | 'opportunity' | 'action'
  title: string
  subtitle: string
  body: string
  primaryAction: string
  secondaryAction?: string
}

type Props = {
  deals: Deal[]
  contacts: Contact[]
  tasks: Task[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STAGE_LABELS: Record<string, string> = {
  lead: 'Lead', qualified: 'Qualified', demo: 'Demo',
  proposal: 'Proposal', negotiation: 'Negotiation',
  closed_won: 'Won', closed_lost: 'Lost',
}

function daysSince(dateStr: string) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

function fmt(v?: number) {
  if (!v) return '—'
  if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}m`
  if (v >= 1000) return `$${(v / 1000).toFixed(0)}k`
  return `$${v}`
}

function dealHealthScore(deal: Deal): number {
  let score = 100
  const days = daysSince(deal.updated_at)
  if (days > 21) score -= 50
  else if (days > 14) score -= 30
  else if (days > 7) score -= 10
  const stageIndex = ['lead','qualified','demo','proposal','negotiation','closed_won','closed_lost'].indexOf(deal.stage)
  if (stageIndex >= 3) score += 10
  if (deal.stage === 'closed_won') return 100
  if (deal.stage === 'closed_lost') return 0
  return Math.max(5, Math.min(99, score))
}

function healthColor(score: number) {
  if (score >= 70) return '#1D9E75'
  if (score >= 40) return '#EF9F27'
  return '#E24B4A'
}

function healthLabel(score: number) {
  if (score >= 70) return 'Healthy'
  if (score >= 40) return 'At risk'
  return 'Critical'
}

function buildSuggestions(deals: Deal[]): Suggestion[] {
  const suggestions: Suggestion[] = []
  const activeDeals = deals.filter(d => d.stage !== 'closed_won' && d.stage !== 'closed_lost')

  activeDeals
    .filter(d => daysSince(d.updated_at) >= 14)
    .sort((a, b) => daysSince(b.updated_at) - daysSince(a.updated_at))
    .slice(0, 2)
    .forEach(d => {
      suggestions.push({
        id: `risk-${d.id}`,
        type: 'risk',
        title: `${d.name} going silent`,
        subtitle: `${fmt(d.value)} · ${daysSince(d.updated_at)}d inactive`,
        body: `This deal has been inactive for ${daysSince(d.updated_at)} days at the ${STAGE_LABELS[d.stage]} stage. A short check-in now is much easier than re-engaging a cold deal later.`,
        primaryAction: 'Draft a check-in',
        secondaryAction: 'Add follow-up task',
      })
    })

  const uninvoiced = deals.filter(
    d => d.stage === 'closed_won' && (!d.payment_status || d.payment_status === 'none')
  )
  if (uninvoiced.length > 0) {
    const total = uninvoiced.reduce((s, d) => s + (d.confirmed_revenue ?? d.value ?? 0), 0)
    suggestions.push({
      id: 'uninvoiced',
      type: 'action',
      title: `${fmt(total)} not invoiced`,
      subtitle: `${uninvoiced.length} won deal${uninvoiced.length > 1 ? 's' : ''} pending`,
      body: `${uninvoiced.map(d => d.name).join(', ')} ${uninvoiced.length > 1 ? 'are' : 'is'} closed but not invoiced.`,
      primaryAction: 'Show me which deals',
      secondaryAction: 'Mark as invoiced',
    })
  }

  const hotDeals = activeDeals.filter(
    d => ['proposal','negotiation'].includes(d.stage) && daysSince(d.updated_at) < 7
  )
  if (hotDeals.length > 0) {
    const d = hotDeals[0]
    suggestions.push({
      id: `opportunity-${d.id}`,
      type: 'opportunity',
      title: `${d.name} has momentum`,
      subtitle: `${fmt(d.value)} · ${STAGE_LABELS[d.stage]}`,
      body: `This deal is in a late stage and was touched recently — momentum is on your side.`,
      primaryAction: 'What should I do next?',
      secondaryAction: 'View deal',
    })
  }

  return suggestions
}

// ─── Suggestion Banner (slim, inline) ────────────────────────────────────────
function SuggestionBanner({
  s, onAction, onDismiss,
}: {
  s: Suggestion
  onAction: (msg: string) => void
  onDismiss: () => void
}) {
  const accent = s.type === 'risk' ? '#E24B4A' : s.type === 'opportunity' ? '#1D9E75' : '#EF9F27'
  const bg = s.type === 'risk' ? '#fdeaea' : s.type === 'opportunity' ? '#e8f5f0' : '#fdf3e3'

  return (
    <div style={{
      background: bg,
      borderRadius: 12,
      padding: '11px 13px',
      borderLeft: `2.5px solid ${accent}`,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 500, color: '#1a1a18', marginBottom: 1 }}>{s.title}</div>
          <div style={{ fontSize: 11, color: '#6b6960' }}>{s.subtitle}</div>
        </div>
        <button onClick={onDismiss} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#9b9890', fontSize: 14, lineHeight: 1,
          padding: 0, flexShrink: 0, marginTop: 1,
        }}>×</button>
      </div>
      <div style={{ display: 'flex', gap: 5 }}>
        <button
          onClick={() => onAction(`${s.primaryAction} (about: ${s.title})`)}
          style={{
            background: accent, color: 'white', border: 'none',
            borderRadius: 7, padding: '5px 10px',
            fontSize: 11, fontWeight: 500, cursor: 'pointer',
          }}
        >
          {s.primaryAction}
        </button>
        {s.secondaryAction && (
          <button
            onClick={() => onAction(`${s.secondaryAction} (about: ${s.title})`)}
            style={{
              background: 'rgba(0,0,0,0.06)', color: '#6b6960',
              border: 'none', borderRadius: 7, padding: '5px 10px',
              fontSize: 11, cursor: 'pointer',
            }}
          >
            {s.secondaryAction}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Deal Health Scoreboard ───────────────────────────────────────────────────
function HealthScoreboard({ deals }: { deals: (Deal & { score: number })[] }) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? deals : deals.slice(0, 4)

  return (
    <div style={{
      background: 'white',
      border: '0.5px solid rgba(0,0,0,0.07)',
      borderRadius: 14,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '11px 14px',
        borderBottom: '0.5px solid rgba(0,0,0,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: '#1a1a18' }}>Deal health</span>
        <span style={{ fontSize: 11, color: '#9b9890' }}>{deals.length} active</span>
      </div>

      {/* Score rows */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {visible.map((d, i) => {
          const color = healthColor(d.score)
          const label = healthLabel(d.score)
          return (
            <div key={d.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 14px',
              borderBottom: i < visible.length - 1 ? '0.5px solid rgba(0,0,0,0.05)' : 'none',
            }}>
              {/* Score chip */}
              <div style={{
                width: 36, height: 22, borderRadius: 6, flexShrink: 0,
                background: `${color}18`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 600, color,
              }}>
                {d.score}
              </div>

              {/* Deal info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 12, fontWeight: 500, color: '#1a1a18',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {d.name}
                </div>
                <div style={{ fontSize: 10, color: '#9b9890' }}>
                  {STAGE_LABELS[d.stage]} · {daysSince(d.updated_at)}d ago
                </div>
              </div>

              {/* Status dot + label */}
              <div style={{
                fontSize: 10, fontWeight: 500, color,
                background: `${color}18`,
                borderRadius: 5, padding: '2px 7px',
                flexShrink: 0,
              }}>
                {label}
              </div>
            </div>
          )
        })}
      </div>

      {/* Show more */}
      {deals.length > 4 && (
        <button
          onClick={() => setExpanded(e => !e)}
          style={{
            width: '100%', background: '#f9f9f8',
            border: 'none', borderTop: '0.5px solid rgba(0,0,0,0.06)',
            padding: '8px', fontSize: 11, color: '#9b9890',
            cursor: 'pointer', textAlign: 'center',
          }}
        >
          {expanded ? 'Show less' : `Show ${deals.length - 4} more`}
        </button>
      )}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AISandboxClient({ deals, contacts, tasks }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [history, setHistory] = useState<unknown[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState<'suggestions' | 'health'>('suggestions')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const suggestions = buildSuggestions(deals)
  const activeDeals = deals.filter(d => d.stage !== 'closed_won' && d.stage !== 'closed_lost')
  const healthScores = activeDeals
    .map(d => ({ ...d, score: dealHealthScore(d) }))
    .sort((a, b) => a.score - b.score) // worst first

  const pipelineContext = [
    `Active deals: ${activeDeals.length}`,
    `Pipeline value: ${fmt(activeDeals.reduce((s, d) => s + (d.value ?? 0), 0))}`,
    activeDeals.length > 0
      ? `Deals: ${activeDeals.map(d => `${d.name} (${STAGE_LABELS[d.stage]}, ${fmt(d.value)}, last active ${daysSince(d.updated_at)}d ago)`).join('; ')}`
      : '',
    tasks.length > 0
      ? `Open tasks: ${tasks.map(t => t.title).filter(Boolean).join(', ')}`
      : '',
  ].filter(Boolean).join('. ')

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return
    const userMsg: Message = { role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const contextualMessage = messages.length === 0
        ? `[Pipeline context: ${pipelineContext}]\n\n${text}`
        : text

      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: contextualMessage, history }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
      setHistory(data.history)
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Something went wrong. Please try again.',
      }])
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const quickPrompts = [
    'Summarise my pipeline',
    'Which deals need attention?',
    'What should I focus on today?',
    'Draft a follow-up for my oldest deal',
  ]

  const activeSuggestions = suggestions.filter(s => !dismissed.has(s.id))

  return (
    <div style={{
      display: 'flex',
      height: '100dvh',
      overflow: 'hidden',
      background: '#f5f4f0',
    }}>

      {/* ── Left: Chat ──────────────────────────────────────────────────── */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        borderRight: '0.5px solid rgba(0,0,0,0.07)',
        background: 'white',
        minWidth: 0,
      }}>

        {/* Chat header */}
        <div style={{
          height: 50, flexShrink: 0,
          borderBottom: '0.5px solid rgba(0,0,0,0.07)',
          display: 'flex', alignItems: 'center',
          padding: '0 20px', gap: 10,
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: '#1a1a18',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="5" fill="white" opacity="0.9"/>
              <circle cx="7" cy="7" r="2.5" fill="#1a1a18"/>
            </svg>
          </div>
          <span style={{ fontSize: 14, fontWeight: 500, color: '#1a1a18' }}>AI Sandbox</span>
          <span style={{ fontSize: 12, color: '#9b9890' }}>· pipeline loaded</span>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {messages.length === 0 && (
            <div style={{ paddingTop: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 500, color: '#1a1a18', marginBottom: 6 }}>
                What do you want to know?
              </div>
              <div style={{ fontSize: 13, color: '#9b9890', marginBottom: 24, lineHeight: 1.6 }}>
                Your pipeline is already loaded. Ask anything — about deals, contacts, what to do next, or draft an email.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {quickPrompts.map(p => (
                  <button
                    key={p}
                    onClick={() => sendMessage(p)}
                    style={{
                      background: '#f5f4f0',
                      border: '0.5px solid rgba(0,0,0,0.07)',
                      borderRadius: 10,
                      padding: '10px 14px',
                      fontSize: 13,
                      color: '#1a1a18',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'border-color 0.15s',
                    }}
                    className="quick-prompt"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} style={{
              display: 'flex',
              justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
              marginBottom: 12,
            }}>
              <div style={{
                maxWidth: '80%',
                background: m.role === 'user' ? '#1a1a18' : '#f5f4f0',
                color: m.role === 'user' ? 'white' : '#1a1a18',
                borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                padding: '11px 14px',
                fontSize: 13,
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
              }}>
                {m.content}
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ display: 'flex', marginBottom: 12 }}>
              <div style={{
                background: '#f5f4f0',
                borderRadius: '16px 16px 16px 4px',
                padding: '11px 16px',
                display: 'flex', gap: 4, alignItems: 'center',
              }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: '#9b9890',
                    animation: `bounce 1s ease-in-out ${i * 0.15}s infinite`,
                  }} />
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{
          padding: '12px 16px',
          borderTop: '0.5px solid rgba(0,0,0,0.07)',
          display: 'flex', gap: 8, alignItems: 'flex-end',
          flexShrink: 0,
        }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about your pipeline…"
            rows={1}
            style={{
              flex: 1,
              background: '#f5f4f0',
              border: '0.5px solid rgba(0,0,0,0.07)',
              borderRadius: 12,
              padding: '10px 14px',
              fontSize: 13,
              color: '#1a1a18',
              resize: 'none',
              outline: 'none',
              fontFamily: 'inherit',
              lineHeight: 1.5,
              maxHeight: 120,
              overflowY: 'auto',
            }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            style={{
              width: 36, height: 36,
              background: input.trim() && !loading ? '#1a1a18' : '#f5f4f0',
              border: 'none', borderRadius: 10,
              cursor: input.trim() && !loading ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.15s',
              flexShrink: 0,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 12V2M2 7l5-5 5 5"
                stroke={input.trim() && !loading ? 'white' : '#9b9890'}
                strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

      {/* ── Right: Suggestions + Health ─────────────────────────────────── */}
      <div style={{
        width: 300,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: '#f5f4f0',
      }}>

        {/* Tab bar */}
        <div style={{
          height: 50, flexShrink: 0,
          borderBottom: '0.5px solid rgba(0,0,0,0.07)',
          background: 'white',
          display: 'flex', alignItems: 'center',
          padding: '0 14px', gap: 4,
        }}>
          {([
            { key: 'suggestions', label: 'Signals', badge: activeSuggestions.length },
            { key: 'health', label: 'Health', badge: healthScores.filter(d => d.score < 40).length },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                background: activeTab === tab.key ? '#f5f4f0' : 'transparent',
                border: 'none', borderRadius: 8,
                padding: '5px 10px',
                fontSize: 12, fontWeight: activeTab === tab.key ? 500 : 400,
                color: activeTab === tab.key ? '#1a1a18' : '#9b9890',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              {tab.label}
              {tab.badge > 0 && (
                <span style={{
                  background: tab.key === 'health' ? '#E24B4A' : '#1a1a18',
                  color: 'white', fontSize: 9, fontWeight: 600,
                  borderRadius: 8, padding: '1px 5px',
                }}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Panel content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>

          {activeTab === 'suggestions' && (
            <>
              {activeSuggestions.length === 0 ? (
                <div style={{
                  background: 'white', borderRadius: 14,
                  padding: '20px 16px', textAlign: 'center',
                }}>
                  <div style={{ fontSize: 20, marginBottom: 8 }}>✓</div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#1a1a18', marginBottom: 4 }}>
                    Pipeline looks healthy
                  </div>
                  <div style={{ fontSize: 11, color: '#9b9890' }}>No signals right now.</div>
                </div>
              ) : (
                activeSuggestions.map(s => (
                  <SuggestionBanner
                    key={s.id}
                    s={s}
                    onDismiss={() => setDismissed(prev => new Set([...prev, s.id]))}
                    onAction={msg => sendMessage(msg)}
                  />
                ))
              )}
            </>
          )}

          {activeTab === 'health' && (
            <>
              {healthScores.length === 0 ? (
                <div style={{ fontSize: 12, color: '#9b9890', padding: '8px 0' }}>
                  No active deals to score.
                </div>
              ) : (
                <HealthScoreboard deals={healthScores} />
              )}
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); opacity: 0.4; }
          50% { transform: translateY(-4px); opacity: 1; }
        }
        .quick-prompt:hover { border-color: rgba(0,0,0,0.15) !important; }
      `}</style>
    </div>
  )
}