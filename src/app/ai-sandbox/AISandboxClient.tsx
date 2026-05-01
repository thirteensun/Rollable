'use client'

import { useState, useRef, useEffect } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────
type Deal = {
  id: string; name: string; stage: string; value?: number
  confirmed_revenue?: number; updated_at: string; payment_status?: string
}
type Contact = { id: string; full_name: string; role?: string; updated_at: string }
type Company = { id: string; name: string }
type Task = { id: string; title?: string; status?: string; due_date?: string }

type ChartData =
  | { type: 'bar'; title: string; data: { label: string; value: number; color?: string }[] }
  | { type: 'donut'; title: string; segments: { label: string; value: number; color: string }[] }
  | { type: 'stages'; title: string; data: { label: string; value: number; count: number; color?: string }[] }
  | { type: 'funnel'; title: string; data: { label: string; count: number; value: number }[] }

type Message = {
  role: 'user' | 'assistant'; content: string; id: string
  agent?: 'action' | 'analytics'; chart?: ChartData
}

type Signal = {
  id: string; type: 'risk' | 'opportunity' | 'action' | 'info'
  title: string; subtitle: string; prompt: string
  secondaryPrompt?: string; taskActions?: boolean
}

type ConversationSummary = {
  id: string; title: string; updated_at: string
}

type Props = { deals: Deal[]; contacts: Contact[]; tasks: Task[]; companies: Company[] }


// ─── Entity lookup map ───────────────────────────────────────────────────────
type EntityMap = Map<string, { id: string; href: string; type: 'deal' | 'contact' | 'company' }>

function buildEntityMap(deals: Deal[], contacts: Contact[], companies: Company[]): EntityMap {
  const map: EntityMap = new Map()
  const entries: [string, { id: string; href: string; type: 'deal' | 'contact' | 'company' }][] = []
  deals.forEach(d => entries.push([d.name.toLowerCase(), { id: d.id, href: `/deals/${d.id}`, type: 'deal' }]))
  contacts.forEach(c => entries.push([c.full_name.toLowerCase(), { id: c.id, href: `/contacts/${c.id}`, type: 'contact' }]))
  companies.forEach(co => entries.push([co.name.toLowerCase(), { id: co.id, href: `/companies/${co.id}`, type: 'company' }]))
  entries.sort((a, b) => b[0].length - a[0].length)
  entries.forEach(([k, v]) => map.set(k, v))
  return map
}
// ─── Constants ────────────────────────────────────────────────────────────────
const C = {
  bg: '#f5f4f0', dark: '#1a1a18', muted: '#6b6960', faint: '#9b9890',
  border: 'rgba(0,0,0,0.07)', red: '#E24B4A', amber: '#EF9F27', green: '#1D9E75', card: 'white',
}
const STAGE_LABELS: Record<string, string> = {
  lead: 'Lead', qualified: 'Qualified', demo: 'Demo',
  proposal: 'Proposal', negotiation: 'Negotiation', closed_won: 'Won', closed_lost: 'Lost',
}
const STAGE_COLOR: Record<string, string> = {
  lead: '#9b9890', qualified: '#6b6960', demo: '#3d7de4',
  proposal: '#EF9F27', negotiation: '#E24B4A', closed_won: '#1D9E75', closed_lost: '#d0cec9',
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
const timeAgo = (d: string) => {
  const h = Math.floor((Date.now() - new Date(d).getTime()) / 3600000)
  if (h < 1) return 'just now'
  if (h < 24) return `${h}h ago`
  const days = Math.floor(h / 24)
  if (days < 7) return `${days}d ago`
  return new Date(d).toLocaleDateString('en', { day: 'numeric', month: 'short' })
}
let _msgId = 0
const newId = () => String(++_msgId)

// ─── Signal icon map ──────────────────────────────────────────────────────────
const SIGNAL_ICON: Record<Signal['type'], { bg: string; stroke: string; path: React.ReactNode }> = {
  risk: {
    bg: '#FCEBEB', stroke: '#A32D2D',
    path: <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
  },
  opportunity: {
    bg: '#E1F5EE', stroke: '#0F6E56',
    path: <><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></>,
  },
  action: {
    bg: '#FAEEDA', stroke: '#854F0B',
    path: <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
  },
  info: {
    bg: '#F1EFE8', stroke: '#5F5E5A',
    path: <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>,
  },
}

// ─── Inline chart renderers ───────────────────────────────────────────────────
function InlineBar({ chart }: { chart: Extract<ChartData, { type: 'bar' }> }) {
  const max = Math.max(...chart.data.map(d => d.value), 1)
  const VW = 280; const VH = 110; const barW = Math.min(36, (VW - 20) / chart.data.length - 6)
  const spacing = (VW - 10) / chart.data.length
  return (
    <div style={{ background: C.bg, borderRadius: 10, padding: '10px 12px', marginTop: 6 }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: C.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{chart.title}</div>
      <svg width="100%" viewBox={`0 0 ${VW} ${VH}`} style={{ display: 'block' }}>
        {chart.data.map((d, i) => {
          const barH = Math.max((d.value / max) * 80, d.value > 0 ? 2 : 0)
          const cx = 8 + i * spacing + spacing / 2
          const x = cx - barW / 2
          return (
            <g key={i}>
              <rect x={x} y={0} width={barW} height={80} fill="rgba(0,0,0,0.04)" rx={4} />
              {barH > 0 && <rect x={x} y={80 - barH} width={barW} height={barH} fill={d.color || C.dark} rx={4} />}
              {d.value > 0 && <text x={cx} y={80 - barH - 4} textAnchor="middle" fontSize={7} fill={C.muted} fontWeight="500">{fmt(d.value)}</text>}
              <text x={cx} y={VH - 2} textAnchor="middle" fontSize={8} fill={C.faint}>{d.label}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function InlineDonut({ chart }: { chart: Extract<ChartData, { type: 'donut' }> }) {
  const total = chart.segments.reduce((s, seg) => s + seg.value, 0)
  const r = 34; const cx = 44; const cy = 44; const stroke = 9
  const circ = 2 * Math.PI * r
  let offset = 0
  return (
    <div style={{ background: C.bg, borderRadius: 10, padding: '10px 12px', marginTop: 6, display: 'flex', gap: 12, alignItems: 'center' }}>
      <div>
        <div style={{ fontSize: 10, fontWeight: 600, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{chart.title}</div>
        <svg width={88} height={88}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(0,0,0,0.05)" strokeWidth={stroke} />
          {chart.segments.map((seg, i) => {
            const arc = total > 0 ? (seg.value / total) * circ : 0
            const el = (
              <circle key={i} cx={cx} cy={cy} r={r} fill="none"
                stroke={seg.color} strokeWidth={stroke} strokeLinecap="round"
                strokeDasharray={`${arc} ${circ}`}
                strokeDashoffset={-offset}
                transform={`rotate(-90 ${cx} ${cy})`} />
            )
            offset += arc
            return el
          })}
          {total > 0 && (
            <>
              <text x={cx} y={cy - 4} textAnchor="middle" fontSize={13} fontWeight="600" fill={C.dark}>
                {Math.round((chart.segments[0].value / total) * 100)}%
              </text>
              <text x={cx} y={cy + 9} textAnchor="middle" fontSize={8} fill={C.faint}>{chart.segments[0].label}</text>
            </>
          )}
        </svg>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {chart.segments.map((seg, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: seg.color, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.dark }}>{seg.value}</div>
              <div style={{ fontSize: 10, color: C.faint }}>{seg.label}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function InlineStages({ chart }: { chart: Extract<ChartData, { type: 'stages' }> }) {
  const max = Math.max(...chart.data.map(d => d.value), 1)
  return (
    <div style={{ background: C.bg, borderRadius: 10, padding: '10px 12px', marginTop: 6 }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: C.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{chart.title}</div>
      {chart.data.map((d, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <div style={{ width: 72, fontSize: 11, color: C.muted, flexShrink: 0 }}>{d.label}</div>
          <div style={{ flex: 1, height: 18, background: 'rgba(0,0,0,0.05)', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
            <div style={{ width: `${(d.value / max) * 100}%`, height: '100%', background: d.color || STAGE_COLOR[d.label.toLowerCase()] || C.dark, opacity: 0.8, borderRadius: 4 }} />
            {d.count > 0 && (
              <span style={{ position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)', fontSize: 9, fontWeight: 600, color: (d.value / max) > 0.35 ? 'white' : C.muted }}>
                {d.count}
              </span>
            )}
          </div>
          <div style={{ width: 42, fontSize: 11, color: C.muted, textAlign: 'right', flexShrink: 0 }}>{fmt(d.value)}</div>
        </div>
      ))}
    </div>
  )
}

function InlineFunnel({ chart }: { chart: Extract<ChartData, { type: 'funnel' }> }) {
  const max = Math.max(...chart.data.map(d => d.count), 1)
  return (
    <div style={{ background: C.bg, borderRadius: 10, padding: '10px 12px', marginTop: 6 }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: C.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{chart.title}</div>
      {chart.data.map((d, i) => {
        const pct = (d.count / max) * 100
        const color = STAGE_COLOR[d.label.toLowerCase()] || C.dark
        const dropPct = i < chart.data.length - 1 && chart.data[i + 1].count > 0
          ? Math.round((1 - chart.data[i + 1].count / Math.max(d.count, 1)) * 100)
          : null
        return (
          <div key={i}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <div style={{ width: 68, fontSize: 11, color: C.muted, flexShrink: 0 }}>{d.label}</div>
              <div style={{ flex: 1, height: 18, background: 'rgba(0,0,0,0.05)', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                <div style={{ width: `${Math.max(pct, d.count > 0 ? 4 : 0)}%`, height: '100%', background: color, opacity: 0.8, borderRadius: 4 }} />
                {d.count > 0 && (
                  <span style={{ position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)', fontSize: 9, fontWeight: 600, color: pct > 30 ? 'white' : C.muted }}>
                    {d.count}
                  </span>
                )}
              </div>
              <div style={{ width: 42, fontSize: 11, color: C.muted, textAlign: 'right', flexShrink: 0 }}>{fmt(d.value)}</div>
            </div>
            {dropPct !== null && dropPct > 0 && d.count > 0 && (
              <div style={{ paddingLeft: 76, fontSize: 9, color: C.red, marginBottom: 3 }}>↓ {dropPct}% drop</div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function InlineChart({ chart }: { chart: ChartData }) {
  if (chart.type === 'bar') return <InlineBar chart={chart} />
  if (chart.type === 'donut') return <InlineDonut chart={chart} />
  if (chart.type === 'stages') return <InlineStages chart={chart} />
  if (chart.type === 'funnel') return <InlineFunnel chart={chart} />
  return null
}

// ─── Signal builder ───────────────────────────────────────────────────────────
function buildSignals(deals: Deal[], tasks: Task[]): Signal[] {
  const signals: Signal[] = []
  const active = deals.filter(d => !["closed_won", "closed_lost"].includes(d.stage))
  const won = deals.filter(d => d.stage === 'closed_won')
  const lost = deals.filter(d => d.stage === 'closed_lost')

  active.filter(d => daysSince(d.updated_at) >= 14).sort((a, b) => daysSince(b.updated_at) - daysSince(a.updated_at)).slice(0, 2).forEach(d => {
    signals.push({ id: `risk-${d.id}`, type: 'risk', title: `${d.name} going silent`, subtitle: `${fmt(d.value)} · ${daysSince(d.updated_at)}d no activity`, prompt: `Draft a short check-in message for ${d.name} — it's been ${daysSince(d.updated_at)} days since last contact`, secondaryPrompt: `Add a follow-up task for ${d.name}`, taskActions: true })
  })

  active.filter(d => ['proposal', 'negotiation'].includes(d.stage) && daysSince(d.updated_at) < 7).slice(0, 2).forEach(d => {
    signals.push({ id: `hot-${d.id}`, type: 'opportunity', title: `${d.name} has momentum`, subtitle: `${fmt(d.value)} · ${STAGE_LABELS[d.stage]} · ${daysSince(d.updated_at)}d ago`, prompt: `What's the best next move to close ${d.name}? It's in ${STAGE_LABELS[d.stage]}`, secondaryPrompt: `Draft a closing email for ${d.name}`, taskActions: true })
  })

  const uninvoiced = won.filter(d => !d.payment_status || d.payment_status === 'none')
  if (uninvoiced.length > 0) {
    const total = uninvoiced.reduce((s, d) => s + (d.confirmed_revenue ?? d.value ?? 0), 0)
    signals.push({ id: 'uninvoiced', type: 'action', title: `${fmt(total)} not yet invoiced`, subtitle: `${uninvoiced.length} won deal${uninvoiced.length > 1 ? 's' : ''} pending`, prompt: `Which deals are closed but not invoiced? List them and suggest what to do next.` })
  }

  const stalled = active.filter(d => daysSince(d.updated_at) >= 21)
  if (stalled.length > 0) {
    signals.push({ id: 'stalled', type: 'risk', title: `${stalled.length} deal${stalled.length > 1 ? 's' : ''} stalled 21+ days`, subtitle: stalled.map(d => d.name).slice(0, 3).join(', '), prompt: `These deals have been inactive for over 3 weeks: ${stalled.map(d => d.name).join(', ')}. What should I do?`, taskActions: true })
  }

  const overdue = tasks.filter(t => t.status !== 'done' && t.due_date && daysUntil(t.due_date)! < 0)
  if (overdue.length > 0) {
    signals.push({ id: 'overdue-tasks', type: 'action', title: `${overdue.length} overdue task${overdue.length > 1 ? 's' : ''}`, subtitle: overdue.slice(0, 2).map(t => t.title).filter(Boolean).join(', '), prompt: `I have ${overdue.length} overdue tasks: ${overdue.slice(0, 5).map(t => t.title).filter(Boolean).join(', ')}. Help me prioritise.`, taskActions: true })
  }

  const total = won.length + lost.length
  const winRate = total >= 3 ? Math.round((won.length / total) * 100) : null
  if (winRate !== null && winRate < 40) {
    signals.push({ id: 'low-winrate', type: 'info', title: `Win rate at ${winRate}%`, subtitle: `${won.length} won · ${lost.length} lost`, prompt: `My win rate is ${winRate}% (${won.length} won, ${lost.length} lost). What patterns might explain this and how can I improve?` })
  }

  const pipelineVal = active.reduce((s, d) => s + (d.value || 0), 0)
  const wonVal = won.reduce((s, d) => s + (d.confirmed_revenue || d.value || 0), 0)
  if (active.length > 0 && wonVal > 0 && pipelineVal < wonVal * 0.5) {
    signals.push({ id: 'thin-pipeline', type: 'info', title: 'Pipeline looks thin', subtitle: `${fmt(pipelineVal)} active vs ${fmt(wonVal)} closed`, prompt: `My active pipeline is only ${fmt(pipelineVal)} compared to ${fmt(wonVal)} already closed. What should I focus on?` })
  }

  return signals
}

// ─── Common questions ─────────────────────────────────────────────────────────
const QUESTION_GROUPS = [
  { group: 'Pipeline', questions: ['Summarise my pipeline by stage', 'What is my weighted forecast?', 'Which deals are most likely to close this month?', 'Which stage has the most value stuck in it?', 'Show me a pipeline funnel chart'] },
  { group: 'Deals', questions: ['Which deals need immediate attention?', 'What are my biggest risks right now?', 'Which deals have been stalled the longest?', 'Show me all deals in negotiation', 'Which deal should I prioritise today?'] },
  { group: 'Performance', questions: ['What is my win rate?', 'How am I tracking against quota?', 'What stage do I lose most deals at?', 'Show me revenue by month', 'What is my average deal size?'] },
  { group: 'Strategy', questions: ['What should I focus on today?', 'Draft a follow-up email for my most at-risk deal', 'If I could only close one deal this week, which should it be?', 'What objections should I prepare for my next proposal?', 'Give me a full pipeline health summary'] },
]

// Type label + accent color per signal type
const SIGNAL_LABEL: Record<Signal['type'], { label: string; color: string }> = {
  risk:        { label: 'Risk',        color: '#A32D2D' },
  opportunity: { label: 'Opportunity', color: '#0F6E56' },
  action:      { label: 'Action',      color: '#854F0B' },
  info:        { label: 'Info',        color: '#5F5E5A' },
}

// Quick action presets — same three for any signal with taskActions: true
const QUICK_ACTIONS = (title: string) => [
  { label: 'Schedule call', prompt: `Draft a calendar invite for a call about: ${title}` },
  { label: 'Email',         prompt: `Write a concise email to address: ${title}` },
  { label: 'Task',          prompt: `Create a follow-up task for: ${title}` },
]

// Truncate secondary prompt for display on the chip
function truncateLabel(text: string, max = 26): string {
  return text.length > max ? text.slice(0, max) + '…' : text
}

// ─── Signal card — full card with all actions visible (Option B) ─────────────
function SignalCard({ s, onSend, onDismiss }: {
  s: Signal; onSend: (msg: string) => void; onDismiss: () => void
}) {
  const icon = SIGNAL_ICON[s.type]
  const meta = SIGNAL_LABEL[s.type]

  // Try to extract a value badge from the subtitle (e.g., "€42k · 23d no activity")
  const valueMatch = s.subtitle.match(/^(€[\d.,]+[km]?)/i)
  const value = valueMatch ? valueMatch[1] : null

  return (
    <div style={{
      background: C.card,
      borderRadius: 12,
      border: `0.5px solid ${C.border}`,
      padding: '11px 12px',
    }}>
      {/* Header: icon + type label + value + dismiss */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
        <div style={{ width: 22, height: 22, borderRadius: 6, background: icon.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={icon.stroke} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            {icon.path}
          </svg>
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, color: meta.color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {meta.label}
        </span>
        {value && (
          <span style={{ fontSize: 11, fontWeight: 600, color: C.dark, marginLeft: 'auto' }}>
            {value}
          </span>
        )}
        <button
          onClick={onDismiss}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: C.faint, display: 'flex', lineHeight: 1, marginLeft: value ? 0 : 'auto' }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>

      {/* Title + subtitle */}
      <div style={{ fontSize: 12, fontWeight: 500, color: C.dark, marginBottom: 2 }}>{s.title}</div>
      <div style={{ fontSize: 11, color: C.faint, marginBottom: 9 }}>{s.subtitle}</div>

      {/* Primary + secondary CTAs */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: s.taskActions ? 7 : 0 }}>
        <button
          onClick={() => onSend(s.prompt)}
          style={{ background: C.dark, color: 'white', border: 'none', borderRadius: 7, padding: '5px 10px', fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Ask AI →
        </button>
        {s.secondaryPrompt && (
          <button
            onClick={() => onSend(s.secondaryPrompt!)}
            style={{ background: 'rgba(0,0,0,0.06)', color: C.muted, border: 'none', borderRadius: 7, padding: '5px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            {truncateLabel(s.secondaryPrompt)}
          </button>
        )}
      </div>

      {/* Quick actions row (call / email / task) */}
      {s.taskActions && (
        <div style={{ borderTop: '0.5px solid rgba(0,0,0,0.06)', paddingTop: 7, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {QUICK_ACTIONS(s.title).map((a, i) => (
            <button
              key={i}
              onClick={() => onSend(a.prompt)}
              style={{ background: 'transparent', border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: 6, padding: '4px 8px', fontSize: 10.5, color: C.muted, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Signals panel ────────────────────────────────────────────────────────────
function SignalsPanel({ signals, dismissed, onSend, onDismiss }: {
  signals: Signal[]; dismissed: Set<string>
  onSend: (msg: string) => void; onDismiss: (id: string) => void
}) {
  const visible = signals.filter(s => !dismissed.has(s.id))
  if (visible.length === 0) {
    return (
      <div style={{ background: C.card, borderRadius: 14, padding: '28px 16px', textAlign: 'center', marginTop: 8 }}>
        <div style={{ fontSize: 20, marginBottom: 8 }}>✓</div>
        <div style={{ fontSize: 12, fontWeight: 500, color: C.dark, marginBottom: 4 }}>Pipeline looks healthy</div>
        <div style={{ fontSize: 11, color: C.faint }}>No signals right now.</div>
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {visible.map(s => (
        <SignalCard key={s.id} s={s}
          onSend={onSend} onDismiss={() => onDismiss(s.id)} />
      ))}
    </div>
  )
}

// ─── Questions panel ──────────────────────────────────────────────────────────
function QuestionsPanel({ onSend }: { onSend: (msg: string) => void }) {
  const [openGroup, setOpenGroup] = useState<string>(QUESTION_GROUPS[0].group)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {QUESTION_GROUPS.map(group => (
        <div key={group.group} style={{ background: C.card, borderRadius: 12, border: `0.5px solid ${C.border}`, overflow: 'hidden' }}>
          <button onClick={() => setOpenGroup(openGroup === group.group ? '' : group.group)} style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '10px 13px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: 'inherit' }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: C.dark }}>{group.group}</span>
            <span style={{ fontSize: 10, color: C.faint, display: 'inline-block', transform: openGroup === group.group ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>▾</span>
          </button>
          {openGroup === group.group && (
            <div style={{ borderTop: `0.5px solid ${C.border}` }}>
              {group.questions.map((q, i) => (
                <button key={i} onClick={() => onSend(q)} style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '9px 13px', textAlign: 'left', fontFamily: 'inherit', fontSize: 12, color: C.muted, lineHeight: 1.4, borderBottom: i < group.questions.length - 1 ? `0.5px solid ${C.border}` : 'none' }} className="question-btn">{q}</button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── History panel ────────────────────────────────────────────────────────────
function HistoryPanel({ onLoad }: { onLoad: (id: string) => void }) {
  const [convos, setConvos] = useState<ConversationSummary[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    async function load() {
      try { const res = await fetch('/api/sandbox/history'); const data = await res.json(); setConvos(data.conversations || []) }
      catch { /* silent */ } finally { setLoading(false) }
    }
    load()
  }, [])
  if (loading) return <div style={{ fontSize: 12, color: C.faint, padding: '16px 0', textAlign: 'center' }}>Loading…</div>
  if (convos.length === 0) return (
    <div style={{ background: C.card, borderRadius: 14, padding: '24px 16px', textAlign: 'center', marginTop: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: C.dark, marginBottom: 4 }}>No past conversations</div>
      <div style={{ fontSize: 11, color: C.faint }}>Your sessions will appear here.</div>
    </div>
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 10, color: C.faint, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>Recent sessions</div>
      {convos.map(c => (
        <button key={c.id} onClick={() => onLoad(c.id)} style={{ background: C.card, border: `0.5px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 3 }} className="question-btn">
          <div style={{ fontSize: 12, fontWeight: 500, color: C.dark, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{c.title || 'Untitled session'}</div>
          <div style={{ fontSize: 10, color: C.faint }}>{timeAgo(c.updated_at)}</div>
        </button>
      ))}
    </div>
  )
}

// ─── Markdown renderer + entity linker ───────────────────────────────────────
// Linkifies entity names found in entityMap, then handles bold/italic/code.
function renderInline(text: string, entityMap?: EntityMap): React.ReactNode {
  if (!entityMap || entityMap.size === 0) return renderInlineMarkdown(text)

  // Find all entity name matches in the text, longest first (map is pre-sorted)
  type Span = { start: number; end: number; href: string; name: string; etype: string }
  const spans: Span[] = []
  const lc = text.toLowerCase()

  entityMap.forEach((val, key) => {
    if (key.length < 3) return // skip very short names
    let pos = 0
    while (pos < lc.length) {
      const idx = lc.indexOf(key, pos)
      if (idx === -1) break
      // Word-boundary check: character before and after must not be alphanumeric
      const before = idx === 0 || /[^a-z0-9]/i.test(text[idx - 1])
      const after  = idx + key.length >= text.length || /[^a-z0-9]/i.test(text[idx + key.length])
      if (before && after) {
        // Make sure this span doesn't overlap an existing one
        const overlaps = spans.some(s => idx < s.end && idx + key.length > s.start)
        if (!overlaps) spans.push({ start: idx, end: idx + key.length, href: val.href, name: text.slice(idx, idx + key.length), etype: val.type })
      }
      pos = idx + 1
    }
  })

  if (spans.length === 0) return renderInlineMarkdown(text)

  spans.sort((a, b) => a.start - b.start)

  const nodes: React.ReactNode[] = []
  let cursor = 0
  spans.forEach((span, i) => {
    if (cursor < span.start) nodes.push(...renderInlineMarkdown(text.slice(cursor, span.start)) as any[])
    nodes.push(
      <a key={`entity-${i}`} href={span.href} style={{
        color: '#1a1a18',
        fontWeight: 600,
        textDecoration: 'none',
        borderBottom: '1.5px solid rgba(0,0,0,0.2)',
        paddingBottom: '0px',
      }}>
        {span.name}
      </a>
    )
    cursor = span.end
  })
  if (cursor < text.length) nodes.push(...renderInlineMarkdown(text.slice(cursor)) as any[])
  return nodes
}

function renderInlineMarkdown(text: string): React.ReactNode {
  const parts = text.split(/(\*\*\*.*?\*\*\*|\*\*.*?\*\*|\*.*?\*|`.*?`)/g)
  return parts.map((part, idx) => {
    if (part.startsWith('***') && part.endsWith('***'))
      return <strong key={idx} style={{ fontWeight: 600, fontStyle: 'italic' }}>{part.slice(3, -3)}</strong>
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={idx} style={{ fontWeight: 600 }}>{part.slice(2, -2)}</strong>
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2)
      return <em key={idx}>{part.slice(1, -1)}</em>
    if (part.startsWith('`') && part.endsWith('`'))
      return <code key={idx} style={{ background: 'rgba(0,0,0,0.08)', borderRadius: 4, padding: '1px 5px', fontSize: 12, fontFamily: 'monospace' }}>{part.slice(1, -1)}</code>
    return part
  })
}

function MarkdownMessage({ content, entityMap }: { content: string; entityMap?: EntityMap }) {
  const lines = content.split('\n')
  const elements: React.ReactNode[] = []
  let i = 0

  const ri = (text: string) => renderInline(text, entityMap)

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    if (trimmed === '') { i++; continue }

    if (/^---+$/.test(trimmed)) {
      elements.push(<hr key={i} style={{ border: 'none', borderTop: '0.5px solid rgba(0,0,0,0.1)', margin: '10px 0' }} />)
      i++; continue
    }

    const hMatch = trimmed.match(/^(#{1,3})\s+(.+)/)
    if (hMatch) {
      const level = hMatch[1].length
      const size = level === 1 ? 15 : level === 2 ? 14 : 13
      elements.push(
        <div key={i} style={{ fontSize: size, fontWeight: 600, color: C.dark, marginTop: elements.length > 0 ? 14 : 0, marginBottom: 2 }}>
          {ri(hMatch[2])}
        </div>
      )
      i++; continue
    }

    if (/^[-*•]\s/.test(trimmed)) {
      const items: string[] = []
      while (i < lines.length && /^[-*•]\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*•]\s/, ''))
        i++
      }
      elements.push(
        <ul key={`ul-${i}`} style={{ margin: '4px 0 6px', paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 5 }}>
          {items.map((item, j) => (
            <li key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: C.dark, lineHeight: 1.5 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: C.faint, flexShrink: 0, marginTop: 7 }} />
              <span>{ri(item)}</span>
            </li>
          ))}
        </ul>
      )
      continue
    }

    if (/^\d+\.\s/.test(trimmed)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s/, ''))
        i++
      }
      elements.push(
        <ol key={`ol-${i}`} style={{ margin: '4px 0 6px', paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 5 }}>
          {items.map((item, j) => (
            <li key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: C.dark, lineHeight: 1.5 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: C.faint, flexShrink: 0, minWidth: 16, marginTop: 1 }}>{j + 1}.</span>
              <span>{ri(item)}</span>
            </li>
          ))}
        </ol>
      )
      continue
    }

    elements.push(
      <p key={i} style={{ margin: '0 0 4px', fontSize: 13, color: C.dark, lineHeight: 1.65 }}>
        {ri(trimmed)}
      </p>
    )
    i++
  }

  return <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>{elements}</div>
}

// ─── Copy button ──────────────────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button onClick={async () => { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800) }} style={{ background: 'none', border: `0.5px solid ${C.border}`, borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontSize: 10, color: copied ? C.green : C.faint, fontFamily: 'inherit', flexShrink: 0, transition: 'color 0.2s' }}>
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function AISandboxClient({ deals, contacts, tasks, companies }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [agentHistory, setAgentHistory] = useState<unknown[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingSession, setLoadingSession] = useState(true)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState<'signals' | 'questions' | 'history'>('signals')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const active = deals.filter(d => !["closed_won", "closed_lost"].includes(d.stage))
  const entityMap = buildEntityMap(deals, contacts, companies)
  const signals = buildSignals(deals, tasks)
  const activeSignalCount = signals.filter(s => !dismissed.has(s.id)).length

  const pipelineContext = [
    `Active deals: ${active.length}, total value: ${fmt(active.reduce((s, d) => s + (d.value ?? 0), 0))}`,
    active.length > 0 ? `Deals: ${active.map(d => `${d.name} (${STAGE_LABELS[d.stage]}, ${fmt(d.value)}, last touched ${daysSince(d.updated_at)}d ago)`).join('; ')}` : '',
    tasks.length > 0 ? `Open tasks: ${tasks.slice(0, 10).map(t => t.title).filter(Boolean).join(', ')}` : '',
  ].filter(Boolean).join('. ')

  useEffect(() => {
    async function loadSession() {
      try {
        const res = await fetch('/api/sandbox')
        const data = await res.json()
        if (data.conversation) {
          setMessages(data.conversation.messages || [])
          setConversationId(data.conversation.id)
          const agentMsgs = (data.conversation.messages || []).slice(-6).map((m: Message) => ({ role: m.role, content: m.content }))
          setAgentHistory(agentMsgs)
        }
      } catch { /* silent */ } finally { setLoadingSession(false) }
    }
    loadSession()
  }, [])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  async function loadConversation(id: string) {
    try {
      const res = await fetch(`/api/sandbox/history?id=${id}`)
      const data = await res.json()
      if (data.conversation) {
        setMessages(data.conversation.messages || [])
        setConversationId(data.conversation.id)
        const agentMsgs = (data.conversation.messages || []).slice(-6).map((m: Message) => ({ role: m.role, content: m.content }))
        setAgentHistory(agentMsgs)
        setActiveTab('signals')
      }
    } catch { /* silent */ }
  }

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return
    const userMsg: Message = { role: 'user', content: text, id: newId() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)
    try {
      const contextualMessage = messages.length === 0 ? `[Context: ${pipelineContext}]\n\n${text}` : text
      const res = await fetch('/api/sandbox', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: contextualMessage, agentHistory, conversationId, displayMessages: messages }) })
      const data = await res.json()
      setMessages(data.displayMessages || [])
      setAgentHistory(data.agentHistory || [])
      setConversationId(data.conversationId || null)
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong. Please try again.', id: newId() }])
    } finally { setLoading(false) }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) }
  }

  const quickPrompts = ['Summarise my pipeline', 'What needs attention?', 'Forecast to close', 'Show pipeline funnel']

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
        <div style={{ width: '100%', maxWidth: 1080, display: 'flex', minHeight: 'calc(100dvh - 170px)', maxHeight: 'calc(100dvh - 170px)', borderRadius: 14, overflow: 'hidden', border: `0.5px solid ${C.border}`, background: C.bg }}>

          {/* ── Chat ── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.card, minWidth: 0, borderRight: `0.5px solid ${C.border}` }}>
            <div style={{ height: 52, flexShrink: 0, borderBottom: `0.5px solid ${C.border}`, display: 'flex', alignItems: 'center', padding: '0 20px', gap: 10 }}>
              <div style={{ width: 26, height: 26, borderRadius: 8, background: C.dark, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 6h2l1.5-4 2 8 1.5-4H11" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" /></svg>
              </div>
              <span style={{ fontSize: 13, fontWeight: 500, color: C.dark }}>AI Sandbox</span>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.green }} />
              <span style={{ fontSize: 11, color: C.faint, marginLeft: -4 }}>live</span>
              <div style={{ flex: 1 }} />
              {messages.length > 0 && (
                <button onClick={() => { setMessages([]); setAgentHistory([]); setConversationId(null) }} style={{ background: C.bg, border: 'none', borderRadius: 7, padding: '4px 10px', fontSize: 11, color: C.faint, cursor: 'pointer', fontFamily: 'inherit' }}>New chat</button>
              )}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 8px' }}>
              {loadingSession && <div style={{ paddingTop: 40, textAlign: 'center' }}><div style={{ fontSize: 12, color: C.faint }}>Loading session…</div></div>}
              {!loadingSession && messages.length === 0 && (
                <div style={{ paddingTop: 24 }}>
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: 20, fontWeight: 500, color: C.dark, marginBottom: 6, letterSpacing: '-0.02em' }}>What do you want to know?</div>
                    <div style={{ fontSize: 13, color: C.faint, lineHeight: 1.6 }}>Ask anything about your pipeline, forecast, or what to do next.</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {quickPrompts.map(p => (<button key={p} onClick={() => sendMessage(p)} style={{ background: C.bg, border: `0.5px solid ${C.border}`, borderRadius: 20, padding: '7px 14px', fontSize: 12, color: C.muted, cursor: 'pointer', fontFamily: 'inherit' }} className="chip-btn">{p}</button>))}
                  </div>
                </div>
              )}
              {messages.map((m) => (
                <div key={m.id} style={{ display: 'flex', flexDirection: m.role === 'user' ? 'row-reverse' : 'row', alignItems: 'flex-start', gap: 8, marginBottom: 12 }}>
                  {m.role === 'assistant' && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                      <div style={{ width: 22, height: 22, borderRadius: 6, background: m.agent === 'action' ? C.dark : '#3d7de4', marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M1 6h2l1.5-4 2 8 1.5-4H11" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </div>
                      {m.agent && <span style={{ fontSize: 8, color: m.agent === 'action' ? C.muted : '#3d7de4', fontWeight: 500, letterSpacing: '0.02em' }}>{m.agent === 'action' ? 'ACTION' : 'ANALYSIS'}</span>}
                    </div>
                  )}
                  <div style={{ maxWidth: '78%', display: 'flex', flexDirection: 'column', gap: 4, alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    <div style={{ background: m.role === 'user' ? C.dark : C.bg, color: m.role === 'user' ? 'white' : C.dark, borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '4px 16px 16px 16px', padding: '10px 14px' }}>
                      {m.role === 'user'
                        ? <span style={{ fontSize: 13, lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{m.content}</span>
                        : <MarkdownMessage content={m.content} entityMap={entityMap} />
                      }
                    </div>
                    {m.chart && <InlineChart chart={m.chart} />}
                    {m.role === 'assistant' && <CopyButton text={m.content} />}
                  </div>
                </div>
              ))}
              {loading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <div style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, background: C.dark, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M1 6h2l1.5-4 2 8 1.5-4H11" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </div>
                  <div style={{ background: C.bg, borderRadius: '4px 16px 16px 16px', padding: '10px 14px', display: 'flex', gap: 4, alignItems: 'center' }}>
                    {[0, 1, 2].map(i => <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: C.faint, animation: `pulse 1s ease-in-out ${i * 0.18}s infinite` }} />)}
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <div style={{ padding: '10px 16px 14px', borderTop: `0.5px solid ${C.border}`, display: 'flex', gap: 8, alignItems: 'flex-end', flexShrink: 0, background: C.card }}>
              <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="Ask anything about your pipeline…" rows={1}
                style={{ flex: 1, background: C.bg, border: `0.5px solid ${C.border}`, borderRadius: 12, padding: '10px 14px', fontSize: 13, color: C.dark, resize: 'none', outline: 'none', fontFamily: 'inherit', lineHeight: 1.5, maxHeight: 100, overflowY: 'auto' }} />
              <button onClick={() => sendMessage(input)} disabled={!input.trim() || loading}
                style={{ width: 36, height: 36, flexShrink: 0, background: input.trim() && !loading ? C.dark : C.bg, border: 'none', borderRadius: 10, cursor: input.trim() && !loading ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s' }}>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M6.5 11V2M2 6.5l4.5-4.5 4.5 4.5" stroke={input.trim() && !loading ? 'white' : C.faint} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>

          {/* ── Right panel ── */}
          <div style={{ width: 296, flexShrink: 0, display: 'flex', flexDirection: 'column', background: C.bg, overflow: 'hidden' }}>
            <div style={{ height: 52, flexShrink: 0, background: C.card, borderBottom: `0.5px solid ${C.border}`, display: 'flex', alignItems: 'center', padding: '0 10px', gap: 2 }}>
              {([
                { key: 'signals' as const, label: 'Signals', badge: activeSignalCount },
                { key: 'questions' as const, label: 'Questions', badge: 0 },
                { key: 'history' as const, label: 'History', badge: 0 },
              ]).map(tab => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{ background: activeTab === tab.key ? C.bg : 'transparent', border: 'none', borderRadius: 8, padding: '5px 9px', fontSize: 11, fontWeight: activeTab === tab.key ? 500 : 400, color: activeTab === tab.key ? C.dark : C.faint, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {tab.label}
                  {tab.badge > 0 && <span style={{ background: C.dark, color: 'white', fontSize: 9, fontWeight: 600, borderRadius: 8, padding: '1px 5px' }}>{tab.badge}</span>}
                </button>
              ))}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {activeTab === 'signals' && (
                <SignalsPanel signals={signals} dismissed={dismissed} onSend={msg => sendMessage(msg)} onDismiss={id => setDismissed(prev => { const n = new Set(prev); n.add(id); return n })} />
              )}
              {activeTab === 'questions' && <QuestionsPanel onSend={msg => sendMessage(msg)} />}
              {activeTab === 'history' && <HistoryPanel onLoad={loadConversation} />}
            </div>
          </div>

        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 0.3; transform: scale(0.85); } 50% { opacity: 1; transform: scale(1); } }
        .chip-btn:hover { background: #ebe9e4 !important; }
        .question-btn:hover { background: #f5f4f0 !important; color: #1a1a18 !important; }
        textarea::placeholder { color: #9b9890; }
        * { box-sizing: border-box; }
      `}</style>
    </>
  )
}