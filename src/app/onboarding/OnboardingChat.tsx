'use client'

import { useState } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface ExtractedContext {
  industry: string
  cycle_days: number
  stage_names: string[]
  at_risk_days: number
  team_size: number
  terminology: string
  pain_points: string[]
}

interface Props {
  onComplete: () => void
}

export default function OnboardingChat({ onComplete }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Welcome! Before you dive in, I'd love to learn a bit about your business so SDM can be set up just for you. What does your company sell, and what industry are you in?"
    }
  ])
  const [chatHistory, setChatHistory] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [context, setContext] = useState<ExtractedContext | null>(null)

  const send = async () => {
    if (!input.trim() || loading) return
    const userMessage = input.trim()
    setInput('')
    setLoading(true)

    const newMessages = [...messages, { role: 'user' as const, content: userMessage }]
    setMessages(newMessages)

    try {
      const res = await fetch('/api/onboarding-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage, history: chatHistory }),
      })
      const data = await res.json()
      setChatHistory(data.history)
      setMessages([...newMessages, { role: 'assistant' as const, content: data.reply }])
      if (data.context) setContext(data.context)
    } catch {
      setMessages([...newMessages, { role: 'assistant' as const, content: 'Something went wrong. Please try again.' }])
    }

    setLoading(false)
  }

  // Confirmation card
  if (context) {
    return (
      <div className="animate-fade-in-up">
        <p style={{ margin: '0 0 8px', fontSize: '13px', color: '#9b9890', letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: 500 }}>
          Here's your setup
        </p>
        <h1 style={{ margin: '0 0 24px', fontSize: '28px', fontWeight: 500, color: '#1a1a18', lineHeight: 1.2 }}>
          SDM is configured<br />for your team
        </h1>

        <div style={{ background: 'white', borderRadius: 18, padding: 24, border: '0.5px solid rgba(0,0,0,0.07)', marginBottom: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { label: 'Industry', value: context.industry },
              { label: 'Sales cycle', value: `~${context.cycle_days} days` },
              { label: 'Team size', value: `${context.team_size} people` },
              { label: 'Terminology', value: context.terminology },
              { label: 'Pipeline stages', value: context.stage_names.join(' → ') },
              { label: 'At-risk after', value: `${context.at_risk_days} days inactive` },
              ...(context.pain_points.length > 0
                ? [{ label: 'Focus areas', value: context.pain_points.join(', ') }]
                : []),
            ].map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                <span style={{ fontSize: 13, color: '#6b6960', flexShrink: 0 }}>{label}</span>
                <span style={{ fontSize: 13, color: '#1a1a18', textAlign: 'right', fontWeight: 500 }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={onComplete}
          style={{
            width: '100%', background: '#1a1a18', color: 'white',
            border: 'none', borderRadius: 22, padding: '16px 24px',
            fontSize: 16, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Take me to my dashboard →
        </button>
      </div>
    )
  }

  // Chat UI
  return (
    <div className="animate-fade-in-up">
      <p style={{ margin: '0 0 8px', fontSize: '13px', color: '#9b9890', letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: 500 }}>
        Quick setup
      </p>
      <h1 style={{ margin: '0 0 24px', fontSize: '28px', fontWeight: 500, color: '#1a1a18', lineHeight: 1.2 }}>
        Tell me about<br />your business
      </h1>

      {/* Messages */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              background: m.role === 'user' ? '#1a1a18' : 'white',
              color: m.role === 'user' ? 'white' : '#1a1a18',
              border: m.role === 'assistant' ? '0.5px solid rgba(0,0,0,0.07)' : 'none',
              borderRadius: m.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
              padding: '12px 16px',
              fontSize: 14,
              lineHeight: 1.5,
              maxWidth: '85%',
            }}>
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{
              background: 'white', border: '0.5px solid rgba(0,0,0,0.07)',
              borderRadius: '18px 18px 18px 4px', padding: '12px 16px',
              display: 'flex', gap: 4, alignItems: 'center',
            }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: 5, height: 5, borderRadius: '50%', background: '#c8c5be',
                  animation: `breathe 1.2s ease-in-out ${i * 0.2}s infinite`,
                }} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Type your answer..."
          autoFocus
          style={{
            flex: 1, border: '0.5px solid rgba(0,0,0,0.12)',
            borderRadius: 20, padding: '12px 16px', fontSize: 14,
            outline: 'none', background: 'white', fontFamily: 'inherit', color: '#1a1a18',
          }}
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          style={{
            background: '#1a1a18', color: 'white', border: 'none',
            borderRadius: 20, padding: '12px 20px', fontSize: 14,
            fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
            opacity: loading || !input.trim() ? 0.4 : 1,
          }}
        >
          Send
        </button>
      </div>
    </div>
  )
}
