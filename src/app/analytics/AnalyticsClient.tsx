'use client'

import { useState, useRef, useEffect, useCallback, useId } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { buildStageLabelMap } from '@/lib/stage-templates'
import { useIsDesktop } from '@/hooks/useIsDesktop'

// ─── Types ────────────────────────────────────────────────────────────────────
type Deal = {
  id: string; name: string; stage: string; value?: number
  confirmed_revenue?: number; updated_at: string; payment_status?: string
  expected_close_date?: string; loss_reason?: string
  stage_entered_at?: string; closed_at?: string
  last_activity_at?: string; created_at: string
}
type Contact = {
  id: string; full_name: string; role?: string; company_name?: string
  last_contacted_at?: string; next_followup_date?: string; created_at: string
}
type Company = { id: string; name: string; industry?: string; created_at: string }
type Task = { id: string; title?: string; status?: string; done?: boolean; due_date?: string; priority?: string; deal_id?: string; contact_id?: string }
type StageVelocity = { stage: string; avg_days: number; transitions: number }
type StageConversion = { stage: string; deals_entered: number; deals_advanced: number; deals_lost_here: number; advance_rate_pct: number }
type Quota = { quota?: number; quota_period?: string; confirmed_revenue?: number; pipeline_value?: number; attainment_pct?: number; gap_to_quota?: number }
type RepRow = {
  user_id: string; email: string; role: string
  quota?: number; quota_period?: string
  confirmed_revenue?: number; pipeline_value?: number
  attainment_pct?: number; gap_to_quota?: number
  at_risk_count: number
}
type OrgContext = {
  industry?: string; cycle_days?: number; at_risk_days?: number
  stage_template?: string; team_size?: number; terminology?: string; pain_points?: string[]
}
type Props = {
  deals: Deal[]; contacts: Contact[]; companies: Company[]
  tasks: Task[]; stageVelocity: StageVelocity[]
  quota: Quota | null; stageConversion: StageConversion[]
  orgContext: OrgContext; isElevated: boolean; repPerformance: RepRow[] | null
}
type CardDef = {
  id: string; title: string; subtitle: string; span: 1 | 2; tags: string[]
  miniStat: () => { label: string; value: string; color?: string }
  render: () => React.ReactNode
  visible: boolean
}
// Column layout state: each entry is { id, col: 'left'|'right' } in display order per column
type ColItem = { id: string; col: 'left' | 'right' }

// ─── Design tokens ────────────────────────────────────────────────────────────
const STAGE_PROB: Record<string, number> = { lead: .10, qualified: .25, demo: .40, proposal: .60, negotiation: .80 }
const STAGE_COLOR: Record<string, string> = {
  lead: '#9b9890', qualified: '#6b6960', demo: '#3d7de4', proposal: '#EF9F27',
  negotiation: '#E24B4A', closed_won: '#1D9E75', closed_lost: '#d0cec9'
}
const C = {
  bg: '#f5f4f0', dark: '#1a1a18', muted: '#6b6960', faint: '#9b9890',
  border: 'rgba(0,0,0,0.07)', red: '#E24B4A', amber: '#EF9F27', green: '#1D9E75', card: 'white'
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (v?: number) => {
  if (!v) return '—'
  if (v >= 1_000_000) return `€${(v / 1_000_000).toFixed(1)}m`
  if (v >= 1_000) return `€${(v / 1_000).toFixed(0)}k`
  return `€${v}`
}
const daysSince = (d?: string) => d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400000) : 999
const daysUntil = (d?: string) => d ? Math.ceil((new Date(d).getTime() - Date.now()) / 86400000) : null
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

// ─── useContainerWidth ────────────────────────────────────────────────────────
function useContainerWidth(fallback = 300): [React.RefObject<HTMLDivElement>, number] {
  const ref = useRef<HTMLDivElement>(null!)
  const [width, setWidth] = useState(fallback)
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width || fallback))
    ro.observe(ref.current)
    setWidth(ref.current.getBoundingClientRect().width || fallback)
    return () => ro.disconnect()
  }, [fallback])
  return [ref, width]
}

// ─── Chart components (unchanged from previous) ───────────────────────────────

function StatStrip({ stats }: { stats: { label: string; value: string; sub?: string; color?: string }[] }) {
  const isDesktop = useIsDesktop()
  return (
    <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? `repeat(${stats.length}, 1fr)` : 'repeat(2, 1fr)' }}>
      {stats.map((s, i) => (
        <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06, duration: 0.3 }}
          style={{ padding: isDesktop ? '18px 20px' : '14px 16px', borderRight: isDesktop ? (i < stats.length - 1 ? `0.5px solid ${C.border}` : 'none') : (i % 2 === 0 ? `0.5px solid ${C.border}` : 'none'), borderBottom: !isDesktop && i < stats.length - 2 ? `0.5px solid ${C.border}` : 'none' }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: C.faint, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>{s.label}</div>
          <div style={{ fontSize: isDesktop ? 22 : 18, fontWeight: 500, color: s.color || C.dark, letterSpacing: '-0.03em', lineHeight: 1 }}>{s.value}</div>
          {s.sub && <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>{s.sub}</div>}
        </motion.div>
      ))}
    </div>
  )
}

function FunnelChart({ deals, stageConversion, stageLabels }: { deals: Deal[]; stageConversion: StageConversion[]; stageLabels: Record<string, string> }) {
  const stages = ['lead', 'qualified', 'demo', 'proposal', 'negotiation']
  const counts = stages.map(s => ({ stage: s, count: deals.filter(d => d.stage === s).length, value: deals.filter(d => d.stage === s).reduce((a, d) => a + (d.value || 0), 0), conv: stageConversion.find(sc => sc.stage === s)?.advance_rate_pct ?? null }))
  const maxCount = Math.max(...counts.map(c => c.count), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {counts.map((row, i) => {
        const pct = (row.count / maxCount) * 100
        const drop = i < counts.length - 1 && row.conv !== null ? `${Math.round(100 - row.conv)}% drop` : null
        return (
          <div key={row.stage}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <div style={{ width: 76, fontSize: 11, color: C.muted, flexShrink: 0 }}>{stageLabels[row.stage] || row.stage}</div>
              <div style={{ flex: 1, height: 20, background: C.bg, borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.7, delay: i * 0.08, ease: [0.25, 0.46, 0.45, 0.94] }} style={{ height: '100%', background: STAGE_COLOR[row.stage], borderRadius: 4, opacity: 0.85 }} />
                {row.count > 0 && <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 10, fontWeight: 600, color: pct > 30 ? 'white' : C.muted }}>{row.count}</span>}
              </div>
              <div style={{ width: 44, fontSize: 11, color: C.muted, textAlign: 'right', flexShrink: 0 }}>{fmt(row.value)}</div>
            </div>
            {drop && row.count > 0 && <div style={{ paddingLeft: 84, fontSize: 10, color: C.red, marginBottom: 3 }}>↓ {drop}</div>}
          </div>
        )
      })}
    </div>
  )
}

function WinLossDonut({ deals }: { deals: Deal[] }) {
  const won = deals.filter(d => d.stage === 'closed_won').length
  const lost = deals.filter(d => d.stage === 'closed_lost').length
  const total = won + lost; const winRate = total > 0 ? Math.round((won / total) * 100) : 0
  const r = 38; const cx = 50; const cy = 50; const stroke = 10; const circ = 2 * Math.PI * r
  const wonArc = total > 0 ? (won / total) * circ : 0; const lostArc = total > 0 ? (lost / total) * circ : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
      <svg width={100} height={100} viewBox="0 0 100 100">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.bg} strokeWidth={stroke} />
        {total > 0 && <>
          <motion.circle cx={cx} cy={cy} r={r} fill="none" stroke={C.green} strokeWidth={stroke} strokeLinecap="round" transform={`rotate(-90 ${cx} ${cy})`} initial={{ strokeDasharray: `0 ${circ}` }} animate={{ strokeDasharray: `${wonArc} ${circ}` }} transition={{ duration: 0.9, ease: 'easeOut' }} />
          <motion.circle cx={cx} cy={cy} r={r} fill="none" stroke={C.red} strokeWidth={stroke} strokeLinecap="round" transform={`rotate(-90 ${cx} ${cy})`} initial={{ strokeDasharray: `0 ${circ}`, strokeDashoffset: 0 }} animate={{ strokeDasharray: `${lostArc} ${circ - lostArc}`, strokeDashoffset: -wonArc }} transition={{ duration: 0.9, ease: 'easeOut', delay: 0.1 }} />
        </>}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize={14} fontWeight={600} fill={C.dark}>{winRate}%</text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize={8} fill={C.faint}>win rate</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[{ label: 'WON', count: won, color: C.green }, { label: 'LOST', count: lost, color: C.red }].map(x => (
          <div key={x.label}>
            <div style={{ fontSize: 10, color: C.faint, marginBottom: 2 }}>{x.label}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: x.color }} />
              <span style={{ fontSize: 20, fontWeight: 600, color: C.dark, letterSpacing: '-0.02em' }}>{x.count}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function RevenueBarChart({ deals }: { deals: Deal[] }) {
  const [ref, W] = useContainerWidth(280)
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(); d.setMonth(d.getMonth() - (5 - i))
    const y = d.getFullYear(); const m = d.getMonth()
    return { label: d.toLocaleString('default', { month: 'short' }), value: deals.filter(d => d.stage === 'closed_won' && d.closed_at).filter(d => { const cd = new Date(d.closed_at!); return cd.getFullYear() === y && cd.getMonth() === m }).reduce((s, d) => s + (d.confirmed_revenue || d.value || 0), 0) }
  })
  const maxVal = Math.max(...months.map(m => m.value), 1)
  const VH = 110; const chartH = 82; const pad = 4; const slot = (W - pad * 2) / 6; const barW = Math.max(slot * 0.55, 8)
  return (
    <div ref={ref}>
      <svg width="100%" height={VH} style={{ display: 'block', overflow: 'visible' }}>
        {months.map((m, i) => {
          const barH = m.value > 0 ? Math.max((m.value / maxVal) * chartH, 3) : 0; const cx = pad + i * slot + slot / 2
          return (
            <g key={i}>
              <rect x={cx - barW / 2} y={0} width={barW} height={chartH} fill={C.bg} rx={5} />
              {barH > 0 && <motion.rect x={cx - barW / 2} width={barW} rx={5} fill={C.dark} initial={{ y: chartH, height: 0 }} animate={{ y: chartH - barH, height: barH }} transition={{ duration: 0.6, delay: i * 0.07, ease: [0.25, 0.46, 0.45, 0.94] }} />}
              {m.value > 0 && <text x={cx} y={chartH - barH - 4} textAnchor="middle" fontSize={7} fill={C.muted} fontWeight="500">{fmt(m.value)}</text>}
              <text x={cx} y={VH - 1} textAnchor="middle" fontSize={8} fill={C.faint}>{m.label}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function VelocityHeatmap({ stageVelocity, stageLabels }: { stageVelocity: StageVelocity[]; stageLabels: Record<string, string> }) {
  if (stageVelocity.length === 0) return <div style={{ fontSize: 12, color: C.faint, padding: '12px 0' }}>Populates as deals move through stages</div>
  const stages = ['lead', 'qualified', 'demo', 'proposal', 'negotiation']; const maxDays = Math.max(...stageVelocity.map(s => s.avg_days), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {stages.map((stage, i) => {
        const row = stageVelocity.find(s => s.stage === stage); if (!row) return null
        const intensity = row.avg_days / maxDays; const bg = `rgba(26,26,24,${0.06 + intensity * 0.7})`; const tc = intensity > 0.5 ? 'white' : C.dark
        return (
          <motion.div key={stage} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07, duration: 0.35 }} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 80, fontSize: 11, color: C.muted, flexShrink: 0 }}>{stageLabels[stage] || stage}</div>
            <div style={{ flex: 1, height: 30, background: bg, borderRadius: 6, display: 'flex', alignItems: 'center', paddingLeft: 10, gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: tc }}>{row.avg_days}d</span>
              <span style={{ fontSize: 10, color: intensity > 0.5 ? 'rgba(255,255,255,0.6)' : C.faint }}>avg · {row.transitions}</span>
            </div>
            {intensity > 0.6 && <span style={{ fontSize: 10, color: C.amber, flexShrink: 0 }}>slow</span>}
          </motion.div>
        )
      })}
    </div>
  )
}

function DealAgeScatter({ deals, stageLabels, atRiskDays }: { deals: Deal[]; stageLabels: Record<string, string>; atRiskDays: number }) {
  const [ref, W] = useContainerWidth(400)
  const active = deals.filter(d => !['closed_won', 'closed_lost'].includes(d.stage) && d.value)
  if (active.length === 0) return <div style={{ fontSize: 12, color: C.faint }}>No active deals</div>
  const H = 180; const padL = 32; const padR = 8; const padT = 8; const padB = 18
  const maxAge = Math.max(...active.map(d => daysSince(d.created_at)), 1); const maxVal = Math.max(...active.map(d => d.value || 0), 1)
  return (
    <div ref={ref}>
      <svg width="100%" height={H} style={{ display: 'block', overflow: 'visible' }}>
        <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke={C.border} strokeWidth={1} />
        <line x1={padL} y1={padT} x2={padL} y2={H - padB} stroke={C.border} strokeWidth={1} />
        <text x={(W + padL) / 2} y={H - 3} textAnchor="middle" fontSize={8} fill={C.faint}>Age (days)</text>
        <text x={9} y={H / 2} textAnchor="middle" fontSize={8} fill={C.faint} transform={`rotate(-90 9 ${H / 2})`}>Value</text>
        {active.map((d, i) => {
          const x = padL + ((daysSince(d.created_at) / maxAge) * (W - padL - padR)); const y = (H - padB) - ((d.value! / maxVal) * (H - padT - padB))
          const atRisk = daysSince(d.last_activity_at) > atRiskDays; const color = atRisk ? C.red : STAGE_COLOR[d.stage] || C.dark
          return (<motion.g key={d.id} initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.025, duration: 0.3, type: 'spring', stiffness: 300 }} style={{ transformOrigin: `${x}px ${y}px` }}><circle cx={x} cy={y} r={6} fill={color} opacity={0.75} /><circle cx={x} cy={y} r={9} fill="none" stroke={color} strokeWidth={1} opacity={0.2} /></motion.g>)
        })}
      </svg>
      <div style={{ display: 'flex', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
        {['lead', 'qualified', 'demo', 'proposal', 'negotiation'].filter(s => active.some(d => d.stage === s)).map(s => (<div key={s} style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 6, height: 6, borderRadius: '50%', background: STAGE_COLOR[s] }} /><span style={{ fontSize: 10, color: C.faint }}>{stageLabels[s] || s}</span></div>))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 6, height: 6, borderRadius: '50%', background: C.red }} /><span style={{ fontSize: 10, color: C.faint }}>At risk ({atRiskDays}d+)</span></div>
      </div>
    </div>
  )
}

function RevenueWaterfall({ deals, quota, stageLabels }: { deals: Deal[]; quota: Quota | null; stageLabels: Record<string, string> }) {
  const [ref, W] = useContainerWidth(280)
  const confirmed = quota?.confirmed_revenue || 0
  const bars = ['lead', 'qualified', 'demo', 'proposal', 'negotiation'].map(s => ({ label: stageLabels[s] || s, value: deals.filter(d => d.stage === s).reduce((a, d) => a + (d.value || 0) * (STAGE_PROB[s] || 0), 0), color: STAGE_COLOR[s] })).filter(b => b.value > 0)
  const allBars = [...(confirmed > 0 ? [{ label: 'Confirmed', value: confirmed, color: C.green, isConfirmed: true }] : []), ...bars.map(b => ({ ...b, isConfirmed: false }))]
  const hasQuota = !!quota?.quota; const totalSlots = allBars.length + (hasQuota ? 1 : 0); const maxVal = Math.max(confirmed + bars.reduce((s, b) => s + b.value, 0), quota?.quota || 0, 1)
  const VH = 130; const chartH = 95; const pad = 6; const slot = totalSlots > 0 ? (W - pad * 2) / totalSlots : 36; const bW = Math.max(slot * 0.58, 6)
  return (
    <div ref={ref}>
      <svg width="100%" height={VH} style={{ display: 'block', overflow: 'visible' }}>
        {allBars.map((b, i) => {
          const barH = Math.max((b.value / maxVal) * chartH, 3); const cx = pad + i * slot + slot / 2
          return (<g key={i}><rect x={cx - bW / 2} y={0} width={bW} height={chartH} fill={C.bg} rx={4} /><motion.rect x={cx - bW / 2} width={bW} rx={4} fill={b.color} opacity={(b as any).isConfirmed ? 1 : 0.75} initial={{ y: chartH, height: 0 }} animate={{ y: chartH - barH, height: barH }} transition={{ duration: 0.6, delay: i * 0.08, ease: [0.25, 0.46, 0.45, 0.94] }} /><text x={cx} y={chartH - barH - 3} textAnchor="middle" fontSize={6.5} fill={C.muted} fontWeight="600">{fmt(b.value)}</text><text x={cx} y={VH - 1} textAnchor="middle" fontSize={7.5} fill={C.faint}>{b.label.slice(0, 7)}</text></g>)
        })}
        {hasQuota && (() => { const cx = pad + allBars.length * slot + slot / 2; const qY = chartH - ((quota!.quota! / maxVal) * chartH); return <g><line x1={cx - bW / 2} y1={qY} x2={cx + bW / 2} y2={qY} stroke={C.amber} strokeWidth={2} strokeDasharray="4 3" /><text x={cx} y={qY - 4} textAnchor="middle" fontSize={6.5} fill={C.amber} fontWeight="600">{fmt(quota!.quota)}</text><text x={cx} y={VH - 1} textAnchor="middle" fontSize={7.5} fill={C.amber}>Quota</text></g> })()}
      </svg>
    </div>
  )
}

function ConversionWaterfall({ stageConversion, stageLabels }: { stageConversion: StageConversion[]; stageLabels: Record<string, string> }) {
  const [ref, W] = useContainerWidth(280)
  if (stageConversion.length === 0) return <div style={{ fontSize: 12, color: C.faint }}>Populates as deals progress</div>
  const stages = ['lead', 'qualified', 'demo', 'proposal', 'negotiation']; const VH = 120; const chartH = 85; const pad = 4; const slot = (W - pad * 2) / stages.length; const bW = Math.max(slot * 0.58, 6)
  return (
    <div ref={ref}>
      <svg width="100%" height={VH} style={{ display: 'block', overflow: 'visible' }}>
        {stages.map((stage, i) => {
          const row = stageConversion.find(s => s.stage === stage); const rate = row ? Math.round((row.deals_advanced / Math.max(row.deals_entered, 1)) * 100) : 0
          const color = rate >= 60 ? C.green : rate >= 35 ? C.amber : C.red; const barH = Math.max((rate / 100) * chartH, 2); const cx = pad + i * slot + slot / 2
          return (<g key={stage}><rect x={cx - bW / 2} y={0} width={bW} height={chartH} fill={C.bg} rx={5} /><motion.rect x={cx - bW / 2} width={bW} rx={5} fill={color} opacity={0.8} initial={{ y: chartH, height: 0 }} animate={{ y: chartH - barH, height: barH }} transition={{ duration: 0.55, delay: i * 0.08, ease: [0.25, 0.46, 0.45, 0.94] }} /><text x={cx} y={chartH - barH - 3} textAnchor="middle" fontSize={8} fontWeight="600" fill={color}>{rate}%</text><text x={cx} y={VH - 9} textAnchor="middle" fontSize={7.5} fill={C.faint}>{(stageLabels[stage] || stage).slice(0, 6)}</text>{row && row.deals_lost_here > 0 && <text x={cx} y={VH - 1} textAnchor="middle" fontSize={7} fill={C.red}>−{row.deals_lost_here}</text>}</g>)
        })}
      </svg>
    </div>
  )
}

function CompanyTreemap({ deals, companies }: { deals: Deal[]; companies: Company[] }) {
  const active = deals.filter(d => !['closed_won', 'closed_lost'].includes(d.stage))
  const vals = companies.map(c => ({ name: c.name, value: active.filter(d => (d as any).company_id === c.id).reduce((s, d) => s + (d.value || 0), 0) })).filter(c => c.value > 0).sort((a, b) => b.value - a.value).slice(0, 8)
  if (vals.length === 0) return <div style={{ fontSize: 12, color: C.faint }}>No company pipeline data</div>
  const total = vals.reduce((s, c) => s + c.value, 0)
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {vals.map((c, i) => { const opacity = 0.2 + (c.value / vals[0].value) * 0.8; return (<motion.div key={i} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05, duration: 0.3 }} style={{ background: `rgba(26,26,24,${opacity})`, borderRadius: 8, padding: '8px 10px', minWidth: '15%', flexGrow: (c.value / total) * 100 }}><div style={{ fontSize: 11, fontWeight: 600, color: opacity > 0.5 ? 'white' : C.dark, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div><div style={{ fontSize: 10, color: opacity > 0.5 ? 'rgba(255,255,255,0.7)' : C.muted }}>{fmt(c.value)}</div></motion.div>) })}
    </div>
  )
}

function FollowupCalendar({ contacts }: { contacts: Contact[] }) {
  const days = Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); const dateStr = d.toISOString().split('T')[0]; const count = contacts.filter(c => c.next_followup_date === dateStr).length; return { label: i === 0 ? 'Today' : i === 1 ? 'Tmrw' : d.toLocaleDateString('en', { weekday: 'short', day: 'numeric' }), count } })
  const maxCount = Math.max(...days.map(d => d.count), 1)
  return (
    <div style={{ display: 'flex', gap: 4, overflowX: 'auto' }} className="no-scrollbar">
      {days.map((day, i) => (<motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0, minWidth: 40 }}><div style={{ width: 34, height: 34, borderRadius: 8, background: day.count > 0 ? `rgba(26,26,24,${0.1 + (day.count / maxCount) * 0.85})` : C.bg, border: day.count > 0 ? 'none' : `0.5px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, color: day.count > 0 ? (day.count / maxCount > 0.5 ? 'white' : C.dark) : C.faint }}>{day.count > 0 ? day.count : '·'}</div><div style={{ fontSize: 9, color: C.faint, textAlign: 'center', maxWidth: 38 }}>{day.label}</div></motion.div>))}
    </div>
  )
}

function TaskGauge({ tasks }: { tasks: Task[] }) {
  const total = tasks.length; const done = tasks.filter(t => t.done || t.status === 'done').length; const overdue = tasks.filter(t => !t.done && t.due_date && daysUntil(t.due_date)! < 0).length; const rate = total > 0 ? Math.round((done / total) * 100) : 0
  const r = 32; const cx = 40; const cy = 42; const stroke = 8; const arc = Math.PI * r; const filled = (rate / 100) * arc
  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
      <svg width={80} height={50}><path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke={C.bg} strokeWidth={stroke} strokeLinecap="round" /><motion.path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke={rate >= 50 ? C.green : rate >= 25 ? C.amber : C.red} strokeWidth={stroke} strokeLinecap="round" initial={{ strokeDasharray: `0 ${arc}` }} animate={{ strokeDasharray: `${filled} ${arc}` }} transition={{ duration: 0.8, ease: 'easeOut' }} /><text x={cx} y={cy - 2} textAnchor="middle" fontSize={14} fontWeight={700} fill={C.dark}>{rate}%</text></svg>
      <div><div style={{ fontSize: 10, color: C.faint }}>COMPLETED</div><div style={{ fontSize: 16, fontWeight: 600, color: C.dark }}>{done} / {total}</div>{overdue > 0 && <div style={{ fontSize: 11, color: C.red, marginTop: 4 }}>{overdue} overdue</div>}</div>
    </div>
  )
}

function LossReasons({ deals }: { deals: Deal[] }) {
  const lost = deals.filter(d => d.stage === 'closed_lost' && d.loss_reason)
  if (lost.length === 0) return <div style={{ fontSize: 12, color: C.faint }}>No lost deals recorded yet</div>
  const reasons = lost.reduce((acc: Record<string, number>, d) => { acc[d.loss_reason!] = (acc[d.loss_reason!] || 0) + 1; return acc }, {}); const sorted = Object.entries(reasons).sort((a, b) => b[1] - a[1]); const max = sorted[0][1]
  return (<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{sorted.map(([reason, count], i) => (<div key={reason} style={{ display: 'flex', alignItems: 'center', gap: 10 }}><div style={{ width: 120, fontSize: 11, color: C.muted, flexShrink: 0 }}>{reason}</div><div style={{ flex: 1, height: 6, background: C.bg, borderRadius: 3, overflow: 'hidden' }}><motion.div initial={{ width: 0 }} animate={{ width: `${(count / max) * 100}%` }} transition={{ duration: 0.6, delay: i * 0.08 }} style={{ height: '100%', background: C.red, opacity: 0.7, borderRadius: 3 }} /></div><div style={{ width: 18, fontSize: 11, fontWeight: 600, color: C.dark, textAlign: 'right' }}>{count}</div></div>))}</div>)
}

function DealAgeDistribution({ deals }: { deals: Deal[] }) {
  const active = deals.filter(d => !['closed_won', 'closed_lost'].includes(d.stage))
  const buckets = [{ label: '0–7d', min: 0, max: 7 }, { label: '8–14d', min: 8, max: 14 }, { label: '15–30d', min: 15, max: 30 }, { label: '31–60d', min: 31, max: 60 }, { label: '60d+', min: 61, max: 9999 }].map(b => ({ ...b, count: active.filter(d => { const age = daysSince(d.created_at); return age >= b.min && age <= b.max }).length, value: active.filter(d => { const age = daysSince(d.created_at); return age >= b.min && age <= b.max }).reduce((s, d) => s + (d.value || 0), 0) }))
  const maxCount = Math.max(...buckets.map(b => b.count), 1)
  return (<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{buckets.map((b, i) => (<div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div style={{ width: 44, fontSize: 11, color: C.muted, flexShrink: 0 }}>{b.label}</div><div style={{ flex: 1, height: 18, background: C.bg, borderRadius: 4, overflow: 'hidden', position: 'relative' }}><motion.div initial={{ width: 0 }} animate={{ width: `${(b.count / maxCount) * 100}%` }} transition={{ duration: 0.6, delay: i * 0.08 }} style={{ height: '100%', background: b.min >= 60 ? C.red : b.min >= 30 ? C.amber : C.green, opacity: 0.75, borderRadius: 4 }} />{b.count > 0 && <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 10, fontWeight: 600, color: (b.count / maxCount) > 0.4 ? 'white' : C.muted }}>{b.count}</span>}</div><div style={{ width: 40, fontSize: 11, color: C.faint, textAlign: 'right' }}>{fmt(b.value)}</div></div>))}</div>)
}

function AtRiskTable({ deals, stageLabels, atRiskDays }: { deals: Deal[]; stageLabels: Record<string, string>; atRiskDays: number }) {
  const atRisk = deals.filter(d => !['closed_won', 'closed_lost'].includes(d.stage) && daysSince(d.last_activity_at) >= atRiskDays).sort((a, b) => daysSince(b.last_activity_at) - daysSince(a.last_activity_at))
  if (atRisk.length === 0) return (<div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0' }}><div style={{ width: 20, height: 20, borderRadius: '50%', background: '#e8f5f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 5l2 2 4-4" stroke={C.green} strokeWidth="1.5" fill="none" strokeLinecap="round" /></svg></div><span style={{ fontSize: 12, color: C.muted }}>All clear</span></div>)
  return (<div style={{ display: 'flex', flexDirection: 'column' }}>{atRisk.map((d, i) => (<Link key={d.id} href={`/tracking/deals/${d.id}`} style={{ textDecoration: 'none' }}><div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: i < atRisk.length - 1 ? `0.5px solid ${C.border}` : 'none' }}><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12, fontWeight: 500, color: C.dark, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</div><div style={{ fontSize: 10, color: C.faint }}>{stageLabels[d.stage] || d.stage}</div></div><div style={{ fontSize: 11, color: C.muted, flexShrink: 0 }}>{fmt(d.value)}</div><div style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 6, background: '#fdeaea', color: C.red, flexShrink: 0 }}>{daysSince(d.last_activity_at)}d</div></div></Link>))}</div>)
}

function ClosingSoonTable({ deals, stageLabels }: { deals: Deal[]; stageLabels: Record<string, string> }) {
  const closing = deals.filter(d => !['closed_won', 'closed_lost'].includes(d.stage) && d.expected_close_date).map(d => ({ ...d, daysLeft: daysUntil(d.expected_close_date)! })).filter(d => d.daysLeft >= 0 && d.daysLeft <= 30).sort((a, b) => a.daysLeft - b.daysLeft)
  if (closing.length === 0) return <div style={{ fontSize: 12, color: C.faint, padding: '12px 0' }}>No deals closing in 30 days</div>
  return (<div style={{ display: 'flex', flexDirection: 'column' }}>{closing.map((d, i) => (<Link key={d.id} href={`/tracking/deals/${d.id}`} style={{ textDecoration: 'none' }}><div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: i < closing.length - 1 ? `0.5px solid ${C.border}` : 'none' }}><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12, fontWeight: 500, color: C.dark, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</div><div style={{ fontSize: 10, color: C.faint }}>{stageLabels[d.stage] || d.stage}</div></div><div style={{ fontSize: 11, color: C.muted, flexShrink: 0 }}>{fmt(d.value)}</div><div style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 6, background: d.daysLeft <= 7 ? '#e8f5f0' : C.bg, color: d.daysLeft <= 7 ? C.green : C.muted, flexShrink: 0 }}>{d.daysLeft === 0 ? 'Today' : `${d.daysLeft}d`}</div></div></Link>))}</div>)
}

function UninvoicedTable({ deals }: { deals: Deal[] }) {
  const uninvoiced = deals.filter(d => d.stage === 'closed_won' && (!d.payment_status || d.payment_status === 'none')); const total = uninvoiced.reduce((s, d) => s + (d.confirmed_revenue || d.value || 0), 0)
  if (uninvoiced.length === 0) return <div style={{ fontSize: 12, color: C.faint, padding: '12px 0' }}>All won deals invoiced ✓</div>
  return (<div><div style={{ fontSize: 18, fontWeight: 600, color: C.red, letterSpacing: '-0.02em', marginBottom: 10 }}>{fmt(total)}</div>{uninvoiced.map((d, i) => (<Link key={d.id} href={`/tracking/deals/${d.id}`} style={{ textDecoration: 'none' }}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < uninvoiced.length - 1 ? `0.5px solid ${C.border}` : 'none' }}><div style={{ fontSize: 12, fontWeight: 500, color: C.dark, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: 10 }}>{d.name}</div><div style={{ fontSize: 12, color: C.red, fontWeight: 500, flexShrink: 0 }}>{fmt(d.confirmed_revenue || d.value)}</div></div></Link>))}</div>)
}

function QuotaProgress({ quota }: { quota: Quota }) {
  const pct = clamp(quota.attainment_pct || 0, 0, 100); const color = pct >= 75 ? C.green : pct >= 40 ? C.amber : C.red
  return (<div><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}><span style={{ fontSize: 24, fontWeight: 600, color, letterSpacing: '-0.03em' }}>{pct.toFixed(1)}%</span><span style={{ fontSize: 12, color: C.faint }}>{quota.quota_period} quota</span></div><div style={{ height: 8, background: C.bg, borderRadius: 4, overflow: 'hidden', marginBottom: 10 }}><motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.9, ease: [0.25, 0.46, 0.45, 0.94] }} style={{ height: '100%', background: color, borderRadius: 4 }} /></div><div style={{ display: 'flex', justifyContent: 'space-between' }}>{[{ label: 'CONFIRMED', value: fmt(quota.confirmed_revenue) }, { label: 'GAP', value: fmt(quota.gap_to_quota), red: true }, { label: 'QUOTA', value: fmt(quota.quota) }].map(s => (<div key={s.label} style={{ textAlign: s.label === 'GAP' ? 'center' : s.label === 'QUOTA' ? 'right' : 'left' }}><div style={{ fontSize: 10, color: C.faint }}>{s.label}</div><div style={{ fontSize: 14, fontWeight: 600, color: s.red ? C.red : C.dark }}>{s.value}</div></div>))}</div></div>)
}

function RepPerformanceTable({ repPerformance }: { repPerformance: RepRow[] }) {
  const [sortKey, setSortKey] = useState<keyof RepRow>('attainment_pct')
  const sorted = [...repPerformance].sort((a, b) => ((b[sortKey] as number) || 0) - ((a[sortKey] as number) || 0))
  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 14, flexWrap: 'wrap' }}>
        {([['attainment_pct', 'Quota %'], ['pipeline_value', 'Pipeline'], ['confirmed_revenue', 'Revenue'], ['at_risk_count', 'At risk']] as [keyof RepRow, string][]).map(([key, label]) => (<button key={key} onClick={() => setSortKey(key)} style={{ padding: '4px 10px', borderRadius: 14, fontSize: 10, cursor: 'pointer', border: `0.5px solid ${sortKey === key ? C.dark : 'rgba(0,0,0,0.09)'}`, background: sortKey === key ? C.dark : C.card, color: sortKey === key ? 'white' : C.muted, fontFamily: 'inherit', transition: 'all 0.15s' }}>{label}</button>))}
      </div>
      {sorted.map((rep, i) => {
        const attain = rep.attainment_pct ?? 0; const attainColor = attain >= 75 ? C.green : attain >= 40 ? C.amber : C.red; const name = rep.email.split('@')[0]
        return (<div key={rep.user_id} style={{ padding: '12px 0', borderBottom: i < sorted.length - 1 ? `0.5px solid ${C.border}` : 'none' }}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div style={{ width: 26, height: 26, borderRadius: '50%', background: C.bg, border: `0.5px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color: C.muted }}>{name.slice(0, 2).toUpperCase()}</div><div><div style={{ fontSize: 12, fontWeight: 500, color: C.dark }}>{name}</div><div style={{ fontSize: 10, color: C.faint, textTransform: 'capitalize' }}>{rep.role}</div></div></div><div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>{rep.at_risk_count > 0 && <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 6, background: '#fdeaea', color: C.red }}>{rep.at_risk_count} at risk</span>}{rep.quota && <span style={{ fontSize: 11, fontWeight: 600, color: attainColor }}>{attain.toFixed(0)}%</span>}</div></div>{rep.quota && <div style={{ height: 4, background: C.bg, borderRadius: 2, marginBottom: 8, overflow: 'hidden' }}><motion.div initial={{ width: 0 }} animate={{ width: `${clamp(attain, 0, 100)}%` }} transition={{ duration: 0.7, delay: i * 0.06 }} style={{ height: '100%', background: attainColor, borderRadius: 2 }} /></div>}<div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>{[['Pipeline', fmt(rep.pipeline_value)], ['Confirmed', fmt(rep.confirmed_revenue)], ...(rep.quota ? [['Quota', fmt(rep.quota)]] : []), ...(rep.gap_to_quota && rep.gap_to_quota > 0 ? [['Gap', fmt(rep.gap_to_quota), true]] : [])].map(([label, value, red]) => (<div key={label as string}><div style={{ fontSize: 9, color: C.faint, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div><div style={{ fontSize: 12, fontWeight: 500, color: red ? C.red : C.dark }}>{value}</div></div>))}</div></div>)
      })}
    </div>
  )
}

// ─── AnimatedCardBody ─────────────────────────────────────────────────────────
function AnimatedCardBody({ visible, children }: { visible: boolean; children: React.ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {visible && (
        <motion.div key="body"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ height: { duration: 0.3, ease: [0.4, 0, 0.2, 1] }, opacity: { duration: 0.18 } }}
          style={{ overflow: 'hidden' }}>
          <div style={{ padding: '16px 18px' }}>{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─── CardShell — shared header UI for both full-width and column cards ─────────
function CardShell({ card, collapsed, onCollapse, dragging = false, children }: {
  card: CardDef; collapsed: boolean; onCollapse: () => void; dragging?: boolean; children?: React.ReactNode
}) {
  const mini = card.miniStat()
  return (
    <div style={{ background: C.card, border: `0.5px solid ${dragging ? 'rgba(0,0,0,0.18)' : C.border}`, borderRadius: 18, overflow: 'hidden', boxShadow: dragging ? '0 20px 48px rgba(0,0,0,0.13)' : 'none', transition: 'box-shadow 0.2s, border-color 0.2s' }}>
      <div style={{ padding: collapsed ? '11px 14px' : '12px 16px 10px', borderBottom: collapsed ? 'none' : `0.5px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, userSelect: 'none', cursor: 'grab' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0, flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2.5px', flexShrink: 0, opacity: 0.18 }}>
            {[0, 1, 2, 3, 4, 5].map(i => <div key={i} style={{ width: 3, height: 3, borderRadius: '50%', background: C.dark }} />)}
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: C.dark, letterSpacing: '-0.01em', flexShrink: 0 }}>{card.title}</span>
          {!collapsed && card.subtitle && <span style={{ fontSize: 11, color: C.faint, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.subtitle}</span>}
          <AnimatePresence>
            {collapsed && (
              <motion.div initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -5 }} transition={{ duration: 0.15 }}
                style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 2 }}>
                <span style={{ fontSize: 10, color: C.faint }}>{mini.label}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: mini.color || C.dark, letterSpacing: '-0.02em' }}>{mini.value}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
          {!collapsed && card.tags.length > 0 && <div style={{ display: 'flex', gap: 3 }}>{card.tags.slice(0, 2).map(t => <span key={t} style={{ fontSize: 9, color: C.faint, background: C.bg, borderRadius: 4, padding: '1px 5px' }}>{t}</span>)}</div>}
          <motion.button onClick={(e) => { e.stopPropagation(); onCollapse() }} whileTap={{ scale: 0.88 }}
            style={{ width: 22, height: 22, borderRadius: 6, border: `0.5px solid ${C.border}`, background: C.bg, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <motion.svg width="10" height="10" viewBox="0 0 10 10"
              animate={{ rotate: collapsed ? 180 : 0 }} transition={{ type: 'spring', stiffness: 380, damping: 26 }}>
              <path d="M2 3.5L5 6.5L8 3.5" stroke={C.muted} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </motion.svg>
          </motion.button>
        </div>
      </div>
      {children}
    </div>
  )
}

// ─── DragGrid — cross-column drag system ──────────────────────────────────────
//
// Strategy: each card is a `motion.div` with `drag`. While dragging, we track
// pointer X/Y via onDrag to compute:
//   (a) which column the pointer is currently over  →  highlight that column
//   (b) which row within that column to insert into  →  show a drop placeholder
// On dragEnd we commit the move.
//
// Card refs are collected per column so we can measure their bounding boxes.
// ─────────────────────────────────────────────────────────────────────────────
type GridState = { id: string; col: 'left' | 'right' }[]

function DragGrid({ items, cardMap, collapsed, onCollapse }: {
  items: GridState
  cardMap: Record<string, CardDef>
  collapsed: Set<string>
  onCollapse: (id: string) => void
}) {
  const [grid, setGrid] = useState<GridState>(items)
  // Keep in sync when tag filter changes visible set (items order/membership changes)
  const prevItemsRef = useRef<GridState>(items)
  useEffect(() => {
    const prevIds = prevItemsRef.current.map(i => i.id).join(',')
    const nextIds = items.map(i => i.id).join(',')
    if (prevIds !== nextIds) { setGrid(items); prevItemsRef.current = items }
  }, [items])

  const containerRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({})

  // Drag state
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropCol, setDropCol] = useState<'left' | 'right' | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)

  const leftItems = grid.filter(i => i.col === 'left')
  const rightItems = grid.filter(i => i.col === 'right')

  // Determine drop target from pointer position
  const computeDrop = useCallback((clientX: number, clientY: number, dragId: string) => {
    if (!containerRef.current) return
    const containerRect = containerRef.current.getBoundingClientRect()
    const midX = containerRect.left + containerRect.width / 2
    const col: 'left' | 'right' = clientX < midX ? 'left' : 'right'
    const colItems = (col === 'left' ? leftItems : rightItems).filter(i => i.id !== dragId)

    // Find insertion index by comparing clientY to each card's midpoint
    let insertIdx = colItems.length // default: append at end
    for (let i = 0; i < colItems.length; i++) {
      const el = cardRefs.current[colItems[i].id]
      if (!el) continue
      const rect = el.getBoundingClientRect()
      if (clientY < rect.top + rect.height / 2) { insertIdx = i; break }
    }
    setDropCol(col)
    setDropIndex(insertIdx)
  }, [leftItems, rightItems])

  const commitDrop = useCallback((dragId: string) => {
    if (dropCol === null || dropIndex === null) { setDraggingId(null); setDropCol(null); setDropIndex(null); return }
    setGrid(prev => {
      const withoutDrag = prev.filter(i => i.id !== dragId)
      const colItems = withoutDrag.filter(i => i.col === dropCol)
      const otherItems = withoutDrag.filter(i => i.col !== dropCol)
      const newColItems: GridState = [...colItems.slice(0, dropIndex), { id: dragId, col: dropCol }, ...colItems.slice(dropIndex)]
      // Rebuild: left first, right second, preserving column display order
      const left = (dropCol === 'left' ? newColItems : otherItems).filter(i => i.col === 'left')
      const right = (dropCol === 'right' ? newColItems : otherItems).filter(i => i.col === 'right')
      return [...left, ...right]
    })
    setDraggingId(null); setDropCol(null); setDropIndex(null)
  }, [dropCol, dropIndex])

  const colLeft = grid.filter(i => i.col === 'left')
  const colRight = grid.filter(i => i.col === 'right')

  function renderColumn(colItems: GridState, col: 'left' | 'right') {
    const isTarget = dropCol === col
    const itemsWithoutDragging = colItems.filter(i => i.id !== draggingId)
    // Build render list with optional placeholder
    const renderItems: Array<{ type: 'card'; id: string } | { type: 'placeholder' }> = []
    const insertAt = isTarget && dropIndex !== null ? dropIndex : -1
    itemsWithoutDragging.forEach((item, idx) => {
      if (insertAt === idx) renderItems.push({ type: 'placeholder' })
      renderItems.push({ type: 'card', id: item.id })
    })
    if (insertAt === itemsWithoutDragging.length) renderItems.push({ type: 'placeholder' })

    return (
      <div style={{ flex: 1, minWidth: 0, transition: 'background 0.15s', borderRadius: 14, background: isTarget ? 'rgba(0,0,0,0.025)' : 'transparent', padding: isTarget ? 4 : 0, margin: isTarget ? -4 : 0 }}>
        {renderItems.map((item, ri) => {
          if (item.type === 'placeholder') {
            return (
              <motion.div key="placeholder" layout
                initial={{ height: 0, opacity: 0 }} animate={{ height: 64, opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18 }}
                style={{ borderRadius: 14, border: `2px dashed ${C.dark}`, marginBottom: 12, background: 'rgba(26,26,24,0.03)' }} />
            )
          }
          const id = item.id
          const card = cardMap[id]
          if (!card) return null
          const isDragging = draggingId === id

          return (
            <motion.div
              key={id}
              layout
              ref={el => { cardRefs.current[id] = el }}
              drag
              dragMomentum={false}
              dragElastic={0.08}
              dragSnapToOrigin
              onDragStart={() => setDraggingId(id)}
              onDrag={(_, info) => computeDrop(info.point.x, info.point.y, id)}
              onDragEnd={() => commitDrop(id)}
              animate={{ scale: isDragging ? 1.025 : 1, rotate: isDragging ? 0.5 : 0, zIndex: isDragging ? 50 : 1, opacity: isDragging ? 0.85 : 1 }}
              transition={{ layout: { type: 'spring', stiffness: 320, damping: 32 }, scale: { duration: 0.15 }, opacity: { duration: 0.12 } }}
              style={{ marginBottom: 12, cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none', position: 'relative' }}
              whileDrag={{ boxShadow: '0 24px 56px rgba(0,0,0,0.16)' }}
            >
              <CardShell card={card} collapsed={collapsed.has(id)} onCollapse={() => onCollapse(id)} dragging={isDragging}>
                <AnimatedCardBody visible={!collapsed.has(id)}>
                  {card.render()}
                </AnimatedCardBody>
              </CardShell>
            </motion.div>
          )
        })}
      </div>
    )
  }

  return (
    <div ref={containerRef} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      {renderColumn(colLeft, 'left')}
      {renderColumn(colRight, 'right')}
    </div>
  )
}

// ─── MobileList — single column reorder (framer Reorder) ─────────────────────
// Import here to keep separation clean
import { Reorder } from 'framer-motion'

function MobileList({ cards, collapsed, onCollapse }: {
  cards: CardDef[]; collapsed: Set<string>; onCollapse: (id: string) => void
}) {
  const [order, setOrder] = useState(cards)
  // Sync when filter changes
  const prevRef = useRef(cards)
  useEffect(() => {
    const prevIds = prevRef.current.map(c => c.id).join(',')
    const nextIds = cards.map(c => c.id).join(',')
    if (prevIds !== nextIds) { setOrder(cards); prevRef.current = cards }
  }, [cards])

  return (
    <Reorder.Group axis="y" values={order} onReorder={setOrder} style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {order.map(card => (
        <Reorder.Item key={card.id} value={card} layout
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
          transition={{ layout: { type: 'spring', stiffness: 320, damping: 32 }, opacity: { duration: 0.18 } }}
          whileDrag={{ scale: 1.025, rotate: 0.5, boxShadow: '0 20px 48px rgba(0,0,0,0.13)', zIndex: 50, cursor: 'grabbing' }}
          style={{ listStyle: 'none', marginBottom: 12, cursor: 'grab', touchAction: 'none' }}>
          <CardShell card={card} collapsed={collapsed.has(card.id)} onCollapse={() => onCollapse(card.id)}>
            <AnimatedCardBody visible={!collapsed.has(card.id)}>
              {card.render()}
            </AnimatedCardBody>
          </CardShell>
        </Reorder.Item>
      ))}
    </Reorder.Group>
  )
}

// ─── FullWidthCard ────────────────────────────────────────────────────────────
function FullWidthCard({ card, collapsed, onCollapse }: { card: CardDef; collapsed: boolean; onCollapse: () => void }) {
  return (
    <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.25 }} style={{ marginBottom: 12 }}>
      <div style={{ background: C.card, border: `0.5px solid ${C.border}`, borderRadius: 18, overflow: 'hidden' }}>
        {/* Header — no drag grip, full-width cards don't move */}
        <div style={{ padding: collapsed ? '11px 16px' : '12px 18px 10px', borderBottom: collapsed ? 'none' : `0.5px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, userSelect: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0, flex: 1 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: C.dark, letterSpacing: '-0.01em', flexShrink: 0 }}>{card.title}</span>
            {!collapsed && card.subtitle && <span style={{ fontSize: 11, color: C.faint, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.subtitle}</span>}
            <AnimatePresence>
              {collapsed && (() => { const mini = card.miniStat(); return (<motion.div initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -5 }} transition={{ duration: 0.15 }} style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 2 }}><span style={{ fontSize: 10, color: C.faint }}>{mini.label}</span><span style={{ fontSize: 14, fontWeight: 600, color: mini.color || C.dark, letterSpacing: '-0.02em' }}>{mini.value}</span></motion.div>) })()}
            </AnimatePresence>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
            {!collapsed && card.tags.length > 0 && <div style={{ display: 'flex', gap: 3 }}>{card.tags.slice(0, 2).map(t => <span key={t} style={{ fontSize: 9, color: C.faint, background: C.bg, borderRadius: 4, padding: '1px 5px' }}>{t}</span>)}</div>}
            <motion.button onClick={onCollapse} whileTap={{ scale: 0.88 }} style={{ width: 22, height: 22, borderRadius: 6, border: `0.5px solid ${C.border}`, background: C.bg, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <motion.svg width="10" height="10" viewBox="0 0 10 10" animate={{ rotate: collapsed ? 180 : 0 }} transition={{ type: 'spring', stiffness: 380, damping: 26 }}>
                <path d="M2 3.5L5 6.5L8 3.5" stroke={C.muted} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </motion.svg>
            </motion.button>
          </div>
        </div>
        <AnimatedCardBody visible={!collapsed}>{card.render()}</AnimatedCardBody>
      </div>
    </motion.div>
  )
}

// ─── Tag nav ──────────────────────────────────────────────────────────────────
const ALL_TAGS = ['deals', 'contacts', 'companies', 'performance', 'forecast', 'history', 'problems', 'live', 'tasks', 'team']

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function AnalyticsClient({ deals, contacts, companies, tasks, stageVelocity, quota, stageConversion, orgContext, isElevated, repPerformance }: Props) {
  const isDesktop = useIsDesktop()
  const stageLabels = buildStageLabelMap(orgContext.stage_template)
  const atRiskDays = orgContext.at_risk_days || 14
  const industry = orgContext.industry
  const dealWord = orgContext.terminology && orgContext.terminology !== 'deals' ? orgContext.terminology : 'deals'
  const pipelineSubtitle = industry ? `${industry.toLowerCase()} pipeline` : 'active stages'

  const active = deals.filter(d => !['closed_won', 'closed_lost'].includes(d.stage))
  const won = deals.filter(d => d.stage === 'closed_won')
  const lost = deals.filter(d => d.stage === 'closed_lost')
  const pipelineVal = active.reduce((s, d) => s + (d.value || 0), 0)
  const weighted = active.reduce((s, d) => s + (d.value || 0) * (STAGE_PROB[d.stage] || 0), 0)
  const winRate = (won.length + lost.length) > 0 ? Math.round(won.length / (won.length + lost.length) * 100) : 0
  const avgDeal = won.length > 0 ? won.reduce((s, d) => s + (d.confirmed_revenue || d.value || 0), 0) / won.length : 0
  const atRiskCount = active.filter(d => daysSince(d.last_activity_at) >= atRiskDays).length
  const followupsDue = contacts.filter(c => daysUntil(c.next_followup_date) !== null && daysUntil(c.next_followup_date)! <= 0).length

  const [activeTag, setActiveTag] = useState('all')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const toggleCollapse = useCallback((id: string) => setCollapsed(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n }), [])

  // ── Card definitions ──────────────────────────────────────────────────────
  const allCards: CardDef[] = [
    // span=2 (full width, never in column grid)
    { id: 'stats', title: 'Overview', subtitle: `${active.length} active ${dealWord}`, span: 2, tags: ['deals'], miniStat: () => ({ label: 'pipeline', value: fmt(pipelineVal) }), visible: activeTag === 'all' || activeTag === 'deals', render: () => <StatStrip stats={[{ label: 'Pipeline', value: fmt(pipelineVal), sub: `${active.length} ${dealWord}` }, { label: 'Weighted', value: fmt(weighted), sub: 'probability-adj' }, { label: 'Win rate', value: `${winRate}%`, sub: `${won.length}W·${lost.length}L`, color: winRate >= 50 ? C.green : C.amber }, { label: 'Avg deal', value: fmt(avgDeal), sub: 'closed won' }, { label: 'Contacts', value: String(contacts.length), sub: `${followupsDue} due` }]} /> },
    ...(quota?.quota ? [{ id: 'quota', title: 'Quota attainment', subtitle: quota.quota_period || '', span: 2 as const, tags: ['forecast', 'performance'], miniStat: () => ({ label: 'attained', value: `${(quota.attainment_pct || 0).toFixed(0)}%`, color: (quota.attainment_pct || 0) >= 75 ? C.green : (quota.attainment_pct || 0) >= 40 ? C.amber : C.red }), visible: activeTag === 'all' || ['deals', 'forecast', 'performance'].includes(activeTag), render: () => <QuotaProgress quota={quota!} /> }] : []),
    { id: 'scatter', title: 'Deal age vs value', subtitle: 'active pipeline', span: 2, tags: ['deals', 'live'], miniStat: () => ({ label: 'active', value: fmt(pipelineVal) }), visible: activeTag === 'all' || ['deals', 'live'].includes(activeTag), render: () => <DealAgeScatter deals={deals} stageLabels={stageLabels} atRiskDays={atRiskDays} /> },
    ...(isElevated && repPerformance?.length ? [{ id: 'team', title: 'Team performance', subtitle: `${repPerformance!.length} reps`, span: 2 as const, tags: ['team', 'performance'], miniStat: () => ({ label: 'reps', value: String(repPerformance!.length) }), visible: activeTag === 'all' || ['team', 'performance'].includes(activeTag), render: () => <RepPerformanceTable repPerformance={repPerformance!} /> }] : []),
    { id: 'followup', title: 'Follow-up calendar', subtitle: 'next 14 days', span: 2, tags: ['contacts'], miniStat: () => ({ label: 'due', value: String(followupsDue), color: followupsDue > 0 ? C.amber : C.faint }), visible: activeTag === 'all' || activeTag === 'contacts', render: () => <FollowupCalendar contacts={contacts} /> },
    { id: 'treemap', title: 'Pipeline by company', subtitle: 'active deal value', span: 2, tags: ['companies'], miniStat: () => ({ label: 'cos', value: String(companies.length) }), visible: activeTag === 'all' || activeTag === 'companies', render: () => <CompanyTreemap deals={deals} companies={companies} /> },
    // span=1 (go into the two-column drag grid)
    { id: 'funnel', title: 'Pipeline funnel', subtitle: pipelineSubtitle, span: 1, tags: ['deals', 'performance'], miniStat: () => ({ label: 'active', value: String(active.length) }), visible: activeTag === 'all' || ['deals', 'performance'].includes(activeTag), render: () => <FunnelChart deals={deals} stageConversion={stageConversion} stageLabels={stageLabels} /> },
    { id: 'winloss', title: 'Win / loss', subtitle: 'all time', span: 1, tags: ['deals', 'history'], miniStat: () => ({ label: 'win rate', value: `${winRate}%`, color: winRate >= 50 ? C.green : C.amber }), visible: activeTag === 'all' || ['deals', 'history'].includes(activeTag), render: () => <WinLossDonut deals={deals} /> },
    { id: 'revenue', title: 'Revenue closed', subtitle: 'last 6 months', span: 1, tags: ['deals', 'history'], miniStat: () => ({ label: 'won', value: String(won.length) }), visible: activeTag === 'all' || ['deals', 'history'].includes(activeTag), render: () => <RevenueBarChart deals={deals} /> },
    { id: 'forecast', title: 'Revenue forecast', subtitle: 'weighted by stage', span: 1, tags: ['forecast', 'deals'], miniStat: () => ({ label: 'weighted', value: fmt(weighted) }), visible: activeTag === 'all' || ['forecast', 'deals'].includes(activeTag), render: () => <RevenueWaterfall deals={deals} quota={quota} stageLabels={stageLabels} /> },
    { id: 'conversion', title: 'Stage conversion', subtitle: 'advance rate', span: 1, tags: ['performance'], miniStat: () => ({ label: 'stages', value: String(stageConversion.length) }), visible: activeTag === 'all' || activeTag === 'performance', render: () => <ConversionWaterfall stageConversion={stageConversion} stageLabels={stageLabels} /> },
    { id: 'velocity', title: 'Stage velocity', subtitle: orgContext.cycle_days ? `${orgContext.cycle_days}d cycle` : 'avg days', span: 1, tags: ['performance'], miniStat: () => { const b = stageVelocity.length ? stageVelocity.reduce((a, x) => a.avg_days > x.avg_days ? a : x) : null; return b ? { label: 'slowest', value: `${b.avg_days}d`, color: C.amber } : { label: 'stages', value: '0' } }, visible: activeTag === 'all' || activeTag === 'performance', render: () => <VelocityHeatmap stageVelocity={stageVelocity} stageLabels={stageLabels} /> },
    { id: 'agedist', title: 'Deal age dist.', subtitle: 'active deals', span: 1, tags: ['deals', 'history'], miniStat: () => ({ label: 'active', value: String(active.length) }), visible: activeTag === 'all' || ['deals', 'history'].includes(activeTag), render: () => <DealAgeDistribution deals={deals} /> },
    { id: 'loss', title: 'Loss reasons', subtitle: 'why deals were lost', span: 1, tags: ['history'], miniStat: () => ({ label: 'lost', value: String(lost.length) }), visible: activeTag === 'all' || activeTag === 'history', render: () => <LossReasons deals={deals} /> },
    { id: 'atrisk', title: 'At-risk deals', subtitle: `${atRiskDays}+ days inactive`, span: 1, tags: ['problems', 'live'], miniStat: () => ({ label: 'at risk', value: String(atRiskCount), color: atRiskCount > 0 ? C.red : C.green }), visible: activeTag === 'all' || ['problems', 'live'].includes(activeTag), render: () => <AtRiskTable deals={deals} stageLabels={stageLabels} atRiskDays={atRiskDays} /> },
    { id: 'closing', title: 'Closing soon', subtitle: '30 days', span: 1, tags: ['forecast', 'live'], miniStat: () => { const n = deals.filter(d => !['closed_won', 'closed_lost'].includes(d.stage) && d.expected_close_date).filter(d => { const dl = daysUntil(d.expected_close_date); return dl !== null && dl >= 0 && dl <= 30 }).length; return { label: 'closing', value: String(n), color: n > 0 ? C.green : C.faint } }, visible: activeTag === 'all' || ['forecast', 'live'].includes(activeTag), render: () => <ClosingSoonTable deals={deals} stageLabels={stageLabels} /> },
    { id: 'uninvoiced', title: 'Not invoiced', subtitle: 'won · pending', span: 1, tags: ['problems'], miniStat: () => { const t = deals.filter(d => d.stage === 'closed_won' && (!d.payment_status || d.payment_status === 'none')).reduce((s, d) => s + (d.confirmed_revenue || d.value || 0), 0); return { label: 'uninvoiced', value: fmt(t), color: t > 0 ? C.red : C.faint } }, visible: activeTag === 'all' || activeTag === 'problems', render: () => <UninvoicedTable deals={deals} /> },
    { id: 'tasks', title: 'Task completion', subtitle: 'all tasks', span: 1, tags: ['tasks'], miniStat: () => { const t = tasks.length; const d = tasks.filter(t => t.done || t.status === 'done').length; return { label: 'done', value: t > 0 ? `${Math.round(d / t * 100)}%` : '—' } }, visible: activeTag === 'all' || ['tasks', 'problems'].includes(activeTag), render: () => <TaskGauge tasks={tasks} /> },
  ]

  const cardMap = Object.fromEntries(allCards.map(c => [c.id, c]))

  // Full-width cards — always rendered above the grid
  const fullWidthCards = allCards.filter(c => c.span === 2 && c.visible)

  // Initial two-column assignment for span=1 cards
  const initialGrid: GridState = [
    { id: 'funnel', col: 'left' }, { id: 'winloss', col: 'right' },
    { id: 'revenue', col: 'left' }, { id: 'forecast', col: 'right' },
    { id: 'conversion', col: 'left' }, { id: 'velocity', col: 'right' },
    { id: 'agedist', col: 'left' }, { id: 'loss', col: 'right' },
    { id: 'atrisk', col: 'left' }, { id: 'closing', col: 'right' },
    { id: 'uninvoiced', col: 'left' }, { id: 'tasks', col: 'right' },
  ]

  // Filter initialGrid to only visible cards
  const visibleGrid = initialGrid.filter(i => cardMap[i.id]?.visible)

  // Mobile: all span=1 cards in one list
  const mobileCards = ['funnel', 'winloss', 'revenue', 'forecast', 'conversion', 'velocity', 'agedist', 'loss', 'atrisk', 'closing', 'uninvoiced', 'tasks']
    .map(id => cardMap[id]).filter(c => c?.visible)

  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div style={{ paddingTop: 8, paddingBottom: 40 }}>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 500, color: C.dark, margin: 0, marginBottom: 2 }}>Analytics</h1>
        <div style={{ fontSize: 12, color: C.faint }}>{today}{industry ? ` · ${industry}` : ''}</div>
      </motion.div>

      {/* Tag nav */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 20 }}>
        {['all', ...ALL_TAGS].map(tag => (
          <motion.button key={tag} onClick={() => setActiveTag(tag)} whileTap={{ scale: 0.93 }} style={{ padding: '5px 13px', borderRadius: 20, fontSize: 11, cursor: 'pointer', border: `0.5px solid ${activeTag === tag ? C.dark : 'rgba(0,0,0,0.09)'}`, background: activeTag === tag ? C.dark : C.card, color: activeTag === tag ? 'white' : C.muted, fontWeight: activeTag === tag ? 500 : 400, fontFamily: 'inherit', transition: 'background 0.15s, color 0.15s, border-color 0.15s', textTransform: 'capitalize' }}>{tag === 'all' ? 'All' : tag}</motion.button>
        ))}
      </div>

      {/* Hint */}
      {isDesktop && (
        <div style={{ fontSize: 11, color: C.faint, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="12" height="12" viewBox="0 0 12 12"><circle cx="4" cy="3" r="1" fill={C.faint} /><circle cx="8" cy="3" r="1" fill={C.faint} /><circle cx="4" cy="6" r="1" fill={C.faint} /><circle cx="8" cy="6" r="1" fill={C.faint} /><circle cx="4" cy="9" r="1" fill={C.faint} /><circle cx="8" cy="9" r="1" fill={C.faint} /></svg>
          Drag cards anywhere — across columns too · ↓ to collapse
        </div>
      )}

      {/* Full-width cards */}
      <AnimatePresence>
        {fullWidthCards.map(card => (
          <FullWidthCard key={card.id} card={card} collapsed={collapsed.has(card.id)} onCollapse={() => toggleCollapse(card.id)} />
        ))}
      </AnimatePresence>

      {/* Grid */}
      {isDesktop
        ? <DragGrid items={visibleGrid} cardMap={cardMap} collapsed={collapsed} onCollapse={toggleCollapse} />
        : <MobileList cards={mobileCards} collapsed={collapsed} onCollapse={toggleCollapse} />
      }

      <style>{`
        button { font-family: inherit; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  )
}