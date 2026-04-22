'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  closestCenter, useDroppable, type DragStartEvent, type DragOverEvent, type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
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
type Contact = { id: string; full_name: string; role?: string; company_name?: string; last_contacted_at?: string; next_followup_date?: string; created_at: string }
type Company = { id: string; name: string; industry?: string; created_at: string }
type Task = { id: string; title?: string; status?: string; done?: boolean; due_date?: string; priority?: string; deal_id?: string; contact_id?: string }
type StageVelocity = { stage: string; avg_days: number; transitions: number }
type StageConversion = { stage: string; deals_entered: number; deals_advanced: number; deals_lost_here: number; advance_rate_pct: number }
type Quota = { quota?: number; quota_period?: string; confirmed_revenue?: number; pipeline_value?: number; attainment_pct?: number; gap_to_quota?: number }
type RepRow = { user_id: string; email: string; role: string; quota?: number; quota_period?: string; confirmed_revenue?: number; pipeline_value?: number; attainment_pct?: number; gap_to_quota?: number; at_risk_count: number }
type OrgContext = { industry?: string; cycle_days?: number; at_risk_days?: number; stage_template?: string; team_size?: number; terminology?: string; pain_points?: string[]; analytics_layout?: AnalyticsLayout }
type AnalyticsLayout = { left: string[]; right: string[]; collapsed: string[] }
type Props = {
  deals: Deal[]; contacts: Contact[]; companies: Company[]
  tasks: Task[]; stageVelocity: StageVelocity[]
  quota: Quota | null; stageConversion: StageConversion[]
  orgContext: OrgContext; isElevated: boolean; repPerformance: RepRow[] | null
}
type CardDef = { id: string; title: string; subtitle: string; span: 1 | 2; tags: string[]; miniStat: () => { label: string; value: string; color?: string }; render: () => React.ReactNode; visible: boolean }

// ─── Tokens ───────────────────────────────────────────────────────────────────
const STAGE_PROB: Record<string, number> = { lead: .10, qualified: .25, demo: .40, proposal: .60, negotiation: .80 }
const STAGE_COLOR: Record<string, string> = { lead: '#9b9890', qualified: '#6b6960', demo: '#3d7de4', proposal: '#EF9F27', negotiation: '#E24B4A', closed_won: '#1D9E75', closed_lost: '#d0cec9' }
const C = { bg: '#f5f4f0', dark: '#1a1a18', muted: '#6b6960', faint: '#9b9890', border: 'rgba(0,0,0,0.07)', red: '#E24B4A', amber: '#EF9F27', green: '#1D9E75', card: 'white' }

// ─── Defaults ─────────────────────────────────────────────────────────────────
const DEFAULT_LEFT = ['funnel', 'revenue', 'conversion', 'agedist', 'atrisk', 'uninvoiced']
const DEFAULT_RIGHT = ['winloss', 'forecast', 'velocity', 'loss', 'closing', 'tasks']

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (v?: number) => { if (!v) return '—'; if (v >= 1_000_000) return `€${(v / 1_000_000).toFixed(1)}m`; if (v >= 1_000) return `€${(v / 1_000).toFixed(0)}k`; return `€${v}` }
const daysSince = (d?: string) => d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400000) : 999
const daysUntil = (d?: string) => d ? Math.ceil((new Date(d).getTime() - Date.now()) / 86400000) : null
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

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

// ─── Charts (all unchanged) ───────────────────────────────────────────────────

function StatStrip({ stats, isDesktop }: { stats: { label: string; value: string; sub?: string; color?: string }[]; isDesktop: boolean }) {
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
        const pct = (row.count / maxCount) * 100; const drop = i < counts.length - 1 && row.conv !== null ? `${Math.round(100 - row.conv)}% drop` : null
        return (<div key={row.stage}><div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}><div style={{ width: 76, fontSize: 11, color: C.muted, flexShrink: 0 }}>{stageLabels[row.stage] || row.stage}</div><div style={{ flex: 1, height: 20, background: C.bg, borderRadius: 4, overflow: 'hidden', position: 'relative' }}><motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.7, delay: i * 0.08, ease: [0.25, 0.46, 0.45, 0.94] }} style={{ height: '100%', background: STAGE_COLOR[row.stage], borderRadius: 4, opacity: 0.85 }} />{row.count > 0 && <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 10, fontWeight: 600, color: pct > 30 ? 'white' : C.muted }}>{row.count}</span>}</div><div style={{ width: 44, fontSize: 11, color: C.muted, textAlign: 'right', flexShrink: 0 }}>{fmt(row.value)}</div></div>{drop && row.count > 0 && <div style={{ paddingLeft: 84, fontSize: 10, color: C.red, marginBottom: 3 }}>↓ {drop}</div>}</div>)
      })}
    </div>
  )
}

function WinLossDonut({ deals }: { deals: Deal[] }) {
  const won = deals.filter(d => d.stage === 'closed_won').length; const lost = deals.filter(d => d.stage === 'closed_lost').length
  const total = won + lost; const winRate = total > 0 ? Math.round((won / total) * 100) : 0
  const r = 38; const cx = 50; const cy = 50; const stroke = 10; const circ = 2 * Math.PI * r
  const wonArc = total > 0 ? (won / total) * circ : 0; const lostArc = total > 0 ? (lost / total) * circ : 0
  return (<div style={{ display: 'flex', alignItems: 'center', gap: 20 }}><svg width={100} height={100} viewBox="0 0 100 100"><circle cx={cx} cy={cy} r={r} fill="none" stroke={C.bg} strokeWidth={stroke} />{total > 0 && <><motion.circle cx={cx} cy={cy} r={r} fill="none" stroke={C.green} strokeWidth={stroke} strokeLinecap="round" transform={`rotate(-90 ${cx} ${cy})`} initial={{ strokeDasharray: `0 ${circ}` }} animate={{ strokeDasharray: `${wonArc} ${circ}` }} transition={{ duration: 0.9, ease: 'easeOut' }} /><motion.circle cx={cx} cy={cy} r={r} fill="none" stroke={C.red} strokeWidth={stroke} strokeLinecap="round" transform={`rotate(-90 ${cx} ${cy})`} initial={{ strokeDasharray: `0 ${circ}`, strokeDashoffset: 0 }} animate={{ strokeDasharray: `${lostArc} ${circ - lostArc}`, strokeDashoffset: -wonArc }} transition={{ duration: 0.9, ease: 'easeOut', delay: 0.1 }} /></>}<text x={cx} y={cy - 4} textAnchor="middle" fontSize={14} fontWeight={600} fill={C.dark}>{winRate}%</text><text x={cx} y={cy + 10} textAnchor="middle" fontSize={8} fill={C.faint}>win rate</text></svg><div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{[{ label: 'WON', count: won, color: C.green }, { label: 'LOST', count: lost, color: C.red }].map(x => (<div key={x.label}><div style={{ fontSize: 10, color: C.faint, marginBottom: 2 }}>{x.label}</div><div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 8, height: 8, borderRadius: 2, background: x.color }} /><span style={{ fontSize: 20, fontWeight: 600, color: C.dark, letterSpacing: '-0.02em' }}>{x.count}</span></div></div>))}</div></div>)
}

function RevenueBarChart({ deals }: { deals: Deal[] }) {
  const [ref, W] = useContainerWidth(280)
  const months = Array.from({ length: 6 }, (_, i) => { const d = new Date(); d.setMonth(d.getMonth() - (5 - i)); const y = d.getFullYear(); const m = d.getMonth(); return { label: d.toLocaleString('default', { month: 'short' }), value: deals.filter(d => d.stage === 'closed_won' && d.closed_at).filter(d => { const cd = new Date(d.closed_at!); return cd.getFullYear() === y && cd.getMonth() === m }).reduce((s, d) => s + (d.confirmed_revenue || d.value || 0), 0) } })
  const maxVal = Math.max(...months.map(m => m.value), 1); const VH = 110; const chartH = 82; const pad = 4; const slot = (W - pad * 2) / 6; const barW = Math.max(slot * 0.55, 8)
  return (<div ref={ref}><svg width="100%" height={VH} style={{ display: 'block', overflow: 'visible' }}>{months.map((m, i) => { const barH = m.value > 0 ? Math.max((m.value / maxVal) * chartH, 3) : 0; const cx = pad + i * slot + slot / 2; return (<g key={i}><rect x={cx - barW / 2} y={0} width={barW} height={chartH} fill={C.bg} rx={5} />{barH > 0 && <motion.rect x={cx - barW / 2} width={barW} rx={5} fill={C.dark} initial={{ y: chartH, height: 0 }} animate={{ y: chartH - barH, height: barH }} transition={{ duration: 0.6, delay: i * 0.07, ease: [0.25, 0.46, 0.45, 0.94] }} />}{m.value > 0 && <text x={cx} y={chartH - barH - 4} textAnchor="middle" fontSize={7} fill={C.muted} fontWeight="500">{fmt(m.value)}</text>}<text x={cx} y={VH - 1} textAnchor="middle" fontSize={8} fill={C.faint}>{m.label}</text></g>) })}</svg></div>)
}

function VelocityHeatmap({ stageVelocity, stageLabels }: { stageVelocity: StageVelocity[]; stageLabels: Record<string, string> }) {
  if (stageVelocity.length === 0) return <div style={{ fontSize: 12, color: C.faint, padding: '12px 0' }}>Populates as deals move through stages</div>
  const stages = ['lead', 'qualified', 'demo', 'proposal', 'negotiation']; const maxDays = Math.max(...stageVelocity.map(s => s.avg_days), 1)
  return (<div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>{stages.map((stage, i) => { const row = stageVelocity.find(s => s.stage === stage); if (!row) return null; const intensity = row.avg_days / maxDays; const bg = `rgba(26,26,24,${0.06 + intensity * 0.7})`; const tc = intensity > 0.5 ? 'white' : C.dark; return (<motion.div key={stage} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07, duration: 0.35 }} style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div style={{ width: 80, fontSize: 11, color: C.muted, flexShrink: 0 }}>{stageLabels[stage] || stage}</div><div style={{ flex: 1, height: 30, background: bg, borderRadius: 6, display: 'flex', alignItems: 'center', paddingLeft: 10, gap: 6 }}><span style={{ fontSize: 12, fontWeight: 600, color: tc }}>{row.avg_days}d</span><span style={{ fontSize: 10, color: intensity > 0.5 ? 'rgba(255,255,255,0.6)' : C.faint }}>avg · {row.transitions}</span></div>{intensity > 0.6 && <span style={{ fontSize: 10, color: C.amber, flexShrink: 0 }}>slow</span>}</motion.div>) })}</div>)
}

function DealAgeScatter({ deals, stageLabels, atRiskDays }: { deals: Deal[]; stageLabels: Record<string, string>; atRiskDays: number }) {
  const [ref, W] = useContainerWidth(400)
  const active = deals.filter(d => !['closed_won', 'closed_lost'].includes(d.stage) && d.value)
  if (active.length === 0) return <div style={{ fontSize: 12, color: C.faint }}>No active deals</div>
  const H = 180; const padL = 32; const padR = 8; const padT = 8; const padB = 18
  const maxAge = Math.max(...active.map(d => daysSince(d.created_at)), 1); const maxVal = Math.max(...active.map(d => d.value || 0), 1)
  return (<div ref={ref}><svg width="100%" height={H} style={{ display: 'block', overflow: 'visible' }}><line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke={C.border} strokeWidth={1} /><line x1={padL} y1={padT} x2={padL} y2={H - padB} stroke={C.border} strokeWidth={1} /><text x={(W + padL) / 2} y={H - 3} textAnchor="middle" fontSize={8} fill={C.faint}>Age (days)</text><text x={9} y={H / 2} textAnchor="middle" fontSize={8} fill={C.faint} transform={`rotate(-90 9 ${H / 2})`}>Value</text>{active.map((d, i) => { const x = padL + ((daysSince(d.created_at) / maxAge) * (W - padL - padR)); const y = (H - padB) - ((d.value! / maxVal) * (H - padT - padB)); const color = daysSince(d.last_activity_at) > atRiskDays ? C.red : STAGE_COLOR[d.stage] || C.dark; return (<motion.g key={d.id} initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.025, duration: 0.3, type: 'spring', stiffness: 300 }} style={{ transformOrigin: `${x}px ${y}px` }}><circle cx={x} cy={y} r={6} fill={color} opacity={0.75} /><circle cx={x} cy={y} r={9} fill="none" stroke={color} strokeWidth={1} opacity={0.2} /></motion.g>) })}</svg><div style={{ display: 'flex', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>{['lead', 'qualified', 'demo', 'proposal', 'negotiation'].filter(s => active.some(d => d.stage === s)).map(s => (<div key={s} style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 6, height: 6, borderRadius: '50%', background: STAGE_COLOR[s] }} /><span style={{ fontSize: 10, color: C.faint }}>{stageLabels[s] || s}</span></div>))}<div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 6, height: 6, borderRadius: '50%', background: C.red }} /><span style={{ fontSize: 10, color: C.faint }}>At risk</span></div></div></div>)
}

function RevenueWaterfall({ deals, quota, stageLabels }: { deals: Deal[]; quota: Quota | null; stageLabels: Record<string, string> }) {
  const [ref, W] = useContainerWidth(280)
  const confirmed = quota?.confirmed_revenue || 0
  const bars = ['lead', 'qualified', 'demo', 'proposal', 'negotiation']
    .map(s => ({ label: stageLabels[s] || s, value: deals.filter(d => d.stage === s).reduce((a, d) => a + (d.value || 0) * (STAGE_PROB[s] || 0), 0), color: STAGE_COLOR[s] }))
    .filter(b => b.value > 0)
  const allBars = [
    ...(confirmed > 0 ? [{ label: 'Confirmed', value: confirmed, color: C.green, isConfirmed: true }] : []),
    ...bars.map(b => ({ ...b, isConfirmed: false })),
  ]
  const hasQuota = !!quota?.quota
  const totalSlots = allBars.length + (hasQuota ? 1 : 0)
  const maxVal = Math.max(confirmed + bars.reduce((s, b) => s + b.value, 0), quota?.quota || 0, 1)
  const VH = 130; const chartH = 95; const pad = 6
  const slot = totalSlots > 0 ? (W - pad * 2) / totalSlots : 36
  const bW = Math.max(slot * 0.58, 6)

  const quotaEl = hasQuota ? (() => {
    const cx = pad + allBars.length * slot + slot / 2
    const qY = chartH - ((quota!.quota! / maxVal) * chartH)
    return (
      <g key="quota-line">
        <line x1={cx - bW / 2} y1={qY} x2={cx + bW / 2} y2={qY} stroke={C.amber} strokeWidth={2} strokeDasharray="4 3" />
        <text x={cx} y={qY - 4} textAnchor="middle" fontSize={6.5} fill={C.amber} fontWeight="600">{fmt(quota!.quota)}</text>
        <text x={cx} y={VH - 1} textAnchor="middle" fontSize={7.5} fill={C.amber}>Quota</text>
      </g>
    )
  })() : null

  return (
    <div ref={ref}>
      <svg width="100%" height={VH} style={{ display: 'block', overflow: 'visible' }}>
        {allBars.map((b, i) => {
          const barH = Math.max((b.value / maxVal) * chartH, 3)
          const cx = pad + i * slot + slot / 2
          return (
            <g key={i}>
              <rect x={cx - bW / 2} y={0} width={bW} height={chartH} fill={C.bg} rx={4} />
              <motion.rect
                x={cx - bW / 2} width={bW} rx={4}
                fill={b.color} opacity={(b as any).isConfirmed ? 1 : 0.75}
                initial={{ y: chartH, height: 0 }}
                animate={{ y: chartH - barH, height: barH }}
                transition={{ duration: 0.6, delay: i * 0.08, ease: [0.25, 0.46, 0.45, 0.94] }}
              />
              <text x={cx} y={chartH - barH - 3} textAnchor="middle" fontSize={6.5} fill={C.muted} fontWeight="600">{fmt(b.value)}</text>
              <text x={cx} y={VH - 1} textAnchor="middle" fontSize={7.5} fill={C.faint}>{b.label.slice(0, 7)}</text>
            </g>
          )
        })}
        {quotaEl}
      </svg>
    </div>
  )
}

function ConversionWaterfall({ stageConversion, stageLabels }: { stageConversion: StageConversion[]; stageLabels: Record<string, string> }) {
  const [ref, W] = useContainerWidth(280)
  if (stageConversion.length === 0) return <div style={{ fontSize: 12, color: C.faint }}>Populates as deals progress</div>
  const stages = ['lead', 'qualified', 'demo', 'proposal', 'negotiation']; const VH = 120; const chartH = 85; const pad = 4; const slot = (W - pad * 2) / stages.length; const bW = Math.max(slot * 0.58, 6)
  return (<div ref={ref}><svg width="100%" height={VH} style={{ display: 'block', overflow: 'visible' }}>{stages.map((stage, i) => { const row = stageConversion.find(s => s.stage === stage); const rate = row ? Math.round((row.deals_advanced / Math.max(row.deals_entered, 1)) * 100) : 0; const color = rate >= 60 ? C.green : rate >= 35 ? C.amber : C.red; const barH = Math.max((rate / 100) * chartH, 2); const cx = pad + i * slot + slot / 2; return (<g key={stage}><rect x={cx - bW / 2} y={0} width={bW} height={chartH} fill={C.bg} rx={5} /><motion.rect x={cx - bW / 2} width={bW} rx={5} fill={color} opacity={0.8} initial={{ y: chartH, height: 0 }} animate={{ y: chartH - barH, height: barH }} transition={{ duration: 0.55, delay: i * 0.08, ease: [0.25, 0.46, 0.45, 0.94] }} /><text x={cx} y={chartH - barH - 3} textAnchor="middle" fontSize={8} fontWeight="600" fill={color}>{rate}%</text><text x={cx} y={VH - 9} textAnchor="middle" fontSize={7.5} fill={C.faint}>{(stageLabels[stage] || stage).slice(0, 6)}</text>{row && row.deals_lost_here > 0 && <text x={cx} y={VH - 1} textAnchor="middle" fontSize={7} fill={C.red}>−{row.deals_lost_here}</text>}</g>) })}</svg></div>)
}



function FollowupCalendar({ contacts }: { contacts: Contact[] }) {
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    const dateStr = d.toISOString().split('T')[0]
    const count = contacts.filter(c => c.next_followup_date === dateStr).length
    return {
      label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en', { weekday: 'short', day: 'numeric', month: 'short' }),
      count,
      isToday: i === 0,
    }
  })

  const withFollowups = days.filter(d => d.count > 0)
  const maxCount = Math.max(...days.map(d => d.count), 1)

  if (withFollowups.length === 0) return (
    <div style={{ fontSize: 12, color: C.faint, padding: '12px 0' }}>No follow-ups scheduled in next 14 days</div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {withFollowups.map((day, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 90, fontSize: 11, flexShrink: 0,
            color: day.isToday ? C.dark : C.muted,
            fontWeight: day.isToday ? 600 : 400,
          }}>
            {day.label}
          </div>
          <div style={{ flex: 1, height: 20, background: C.bg, borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(day.count / maxCount) * 100}%` }}
              transition={{ duration: 0.6, delay: i * 0.07, ease: [0.25, 0.46, 0.45, 0.94] }}
              style={{ height: '100%', background: day.isToday ? C.dark : '#4a7a8a', borderRadius: 4, opacity: 0.85 }}
            />
            <span style={{
              position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)',
              fontSize: 10, fontWeight: 600,
              color: (day.count / maxCount) > 0.35 ? 'white' : C.muted,
            }}>
              {day.count}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

function CompanyTreemap({ deals, companies }: { deals: Deal[]; companies: Company[] }) {
  const active = deals.filter(d => !['closed_won', 'closed_lost'].includes(d.stage))
  const vals = companies
    .map(c => ({
      name: c.name,
      value: active.filter(d => (d as any).company_id === c.id).reduce((s, d) => s + (d.value || 0), 0),
      dealCount: active.filter(d => (d as any).company_id === c.id).length,
    }))
    .filter(c => c.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)

  if (vals.length === 0) return (
    <div style={{ fontSize: 12, color: C.faint, padding: '12px 0' }}>No company pipeline data</div>
  )

  const maxVal = vals[0].value

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {vals.map((c, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 120, fontSize: 11, color: C.muted, flexShrink: 0,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {c.name}
          </div>
          <div style={{ flex: 1, height: 20, background: C.bg, borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(c.value / maxVal) * 100}%` }}
              transition={{ duration: 0.6, delay: i * 0.07, ease: [0.25, 0.46, 0.45, 0.94] }}
              style={{
                height: '100%', background: C.dark, borderRadius: 4,
                opacity: 0.12 + (c.value / maxVal) * 0.73,
              }}
            />
            <span style={{
              position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)',
              fontSize: 10, fontWeight: 600,
              color: (c.value / maxVal) > 0.45 ? 'white' : C.muted,
            }}>
              {fmt(c.value)}
            </span>
          </div>
          <div style={{ width: 24, fontSize: 10, color: C.faint, textAlign: 'right', flexShrink: 0 }}>
            {c.dealCount}d
          </div>
        </div>
      ))}
    </div>
  )
}


function TaskGauge({ tasks }: { tasks: Task[] }) {
  const total = tasks.length; const done = tasks.filter(t => t.done || t.status === 'done').length; const overdue = tasks.filter(t => !t.done && t.due_date && daysUntil(t.due_date)! < 0).length; const rate = total > 0 ? Math.round((done / total) * 100) : 0
  const r = 32; const cx = 40; const cy = 42; const stroke = 8; const arc = Math.PI * r; const filled = (rate / 100) * arc
  return (<div style={{ display: 'flex', gap: 20, alignItems: 'center' }}><svg width={80} height={50}><path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke={C.bg} strokeWidth={stroke} strokeLinecap="round" /><motion.path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke={rate >= 50 ? C.green : rate >= 25 ? C.amber : C.red} strokeWidth={stroke} strokeLinecap="round" initial={{ strokeDasharray: `0 ${arc}` }} animate={{ strokeDasharray: `${filled} ${arc}` }} transition={{ duration: 0.8, ease: 'easeOut' }} /><text x={cx} y={cy - 2} textAnchor="middle" fontSize={14} fontWeight={700} fill={C.dark}>{rate}%</text></svg><div><div style={{ fontSize: 10, color: C.faint }}>COMPLETED</div><div style={{ fontSize: 16, fontWeight: 600, color: C.dark }}>{done} / {total}</div>{overdue > 0 && <div style={{ fontSize: 11, color: C.red, marginTop: 4 }}>{overdue} overdue</div>}</div></div>)
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
  return (<div>{atRisk.map((d, i) => (<Link key={d.id} href={`/tracking/deals/${d.id}`} style={{ textDecoration: 'none' }}><div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: i < atRisk.length - 1 ? `0.5px solid ${C.border}` : 'none' }}><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12, fontWeight: 500, color: C.dark, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</div><div style={{ fontSize: 10, color: C.faint }}>{stageLabels[d.stage] || d.stage}</div></div><div style={{ fontSize: 11, color: C.muted, flexShrink: 0 }}>{fmt(d.value)}</div><div style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 6, background: '#fdeaea', color: C.red, flexShrink: 0 }}>{daysSince(d.last_activity_at)}d</div></div></Link>))}</div>)
}

function ClosingSoonTable({ deals, stageLabels }: { deals: Deal[]; stageLabels: Record<string, string> }) {
  const closing = deals.filter(d => !['closed_won', 'closed_lost'].includes(d.stage) && d.expected_close_date).map(d => ({ ...d, daysLeft: daysUntil(d.expected_close_date)! })).filter(d => d.daysLeft >= 0 && d.daysLeft <= 30).sort((a, b) => a.daysLeft - b.daysLeft)
  if (closing.length === 0) return <div style={{ fontSize: 12, color: C.faint, padding: '12px 0' }}>No deals closing in 30 days</div>
  return (<div>{closing.map((d, i) => (<Link key={d.id} href={`/tracking/deals/${d.id}`} style={{ textDecoration: 'none' }}><div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: i < closing.length - 1 ? `0.5px solid ${C.border}` : 'none' }}><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12, fontWeight: 500, color: C.dark, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</div><div style={{ fontSize: 10, color: C.faint }}>{stageLabels[d.stage] || d.stage}</div></div><div style={{ fontSize: 11, color: C.muted, flexShrink: 0 }}>{fmt(d.value)}</div><div style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 6, background: d.daysLeft <= 7 ? '#e8f5f0' : C.bg, color: d.daysLeft <= 7 ? C.green : C.muted, flexShrink: 0 }}>{d.daysLeft === 0 ? 'Today' : `${d.daysLeft}d`}</div></div></Link>))}</div>)
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
  return (<div><div style={{ display: 'flex', gap: 4, marginBottom: 14, flexWrap: 'wrap' }}>{([['attainment_pct', 'Quota %'], ['pipeline_value', 'Pipeline'], ['confirmed_revenue', 'Revenue'], ['at_risk_count', 'At risk']] as [keyof RepRow, string][]).map(([key, label]) => (<button key={key} onClick={() => setSortKey(key)} style={{ padding: '4px 10px', borderRadius: 14, fontSize: 10, cursor: 'pointer', border: `0.5px solid ${sortKey === key ? C.dark : 'rgba(0,0,0,0.09)'}`, background: sortKey === key ? C.dark : C.card, color: sortKey === key ? 'white' : C.muted, fontFamily: 'inherit', transition: 'all 0.15s' }}>{label}</button>))}</div>{sorted.map((rep, i) => { const attain = rep.attainment_pct ?? 0; const attainColor = attain >= 75 ? C.green : attain >= 40 ? C.amber : C.red; const name = rep.email.split('@')[0]; return (<div key={rep.user_id} style={{ padding: '12px 0', borderBottom: i < sorted.length - 1 ? `0.5px solid ${C.border}` : 'none' }}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div style={{ width: 26, height: 26, borderRadius: '50%', background: C.bg, border: `0.5px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color: C.muted }}>{name.slice(0, 2).toUpperCase()}</div><div><div style={{ fontSize: 12, fontWeight: 500, color: C.dark }}>{name}</div><div style={{ fontSize: 10, color: C.faint, textTransform: 'capitalize' }}>{rep.role}</div></div></div><div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>{rep.at_risk_count > 0 && <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 6, background: '#fdeaea', color: C.red }}>{rep.at_risk_count} at risk</span>}{rep.quota && <span style={{ fontSize: 11, fontWeight: 600, color: attainColor }}>{attain.toFixed(0)}%</span>}</div></div>{rep.quota && <div style={{ height: 4, background: C.bg, borderRadius: 2, marginBottom: 8, overflow: 'hidden' }}><motion.div initial={{ width: 0 }} animate={{ width: `${clamp(attain, 0, 100)}%` }} transition={{ duration: 0.7, delay: i * 0.06 }} style={{ height: '100%', background: attainColor, borderRadius: 2 }} /></div>}<div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>{[['Pipeline', fmt(rep.pipeline_value)], ['Confirmed', fmt(rep.confirmed_revenue)], ...(rep.quota ? [['Quota', fmt(rep.quota)]] : []), ...(rep.gap_to_quota && rep.gap_to_quota > 0 ? [['Gap', fmt(rep.gap_to_quota), true]] : [])].map(([label, value, red]) => (<div key={label as string}><div style={{ fontSize: 9, color: C.faint, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div><div style={{ fontSize: 12, fontWeight: 500, color: red ? C.red : C.dark }}>{value}</div></div>))}</div></div>) })}</div>)
}

// ─── AnimatedCardBody ─────────────────────────────────────────────────────────
function AnimatedCardBody({ visible, children }: { visible: boolean; children: React.ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {visible && (
        <motion.div key="body" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ height: { duration: 0.28, ease: [0.4, 0, 0.2, 1] }, opacity: { duration: 0.16 } }} style={{ overflow: 'hidden' }}>
          <div style={{ padding: '16px 18px' }}>{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─── CardShell ────────────────────────────────────────────────────────────────
function CardShell({ card, collapsed, onCollapse, isDragging = false, isOverlay = false, editMode = false, children }: {
  card: CardDef; collapsed: boolean; onCollapse: () => void
  isDragging?: boolean; isOverlay?: boolean; editMode?: boolean; children?: React.ReactNode
}) {
  const mini = card.miniStat()
  return (
    <div style={{
      background: C.card,
      border: `0.5px solid ${isDragging ? 'transparent' : editMode ? 'rgba(26,26,24,0.15)' : C.border}`,
      borderRadius: 18,
      overflow: 'hidden',
      opacity: isDragging ? 0.3 : 1,
      boxShadow: isOverlay ? '0 24px 56px rgba(0,0,0,0.18), 0 4px 12px rgba(0,0,0,0.08)' : editMode && !isDragging ? '0 2px 12px rgba(0,0,0,0.06)' : 'none',
      transform: isOverlay ? 'rotate(1.2deg) scale(1.02)' : 'none',
      transition: 'opacity 0.15s, box-shadow 0.2s, border-color 0.2s',
    }}>
      <div style={{ padding: collapsed ? '11px 14px' : '12px 16px 10px', borderBottom: collapsed ? 'none' : `0.5px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, userSelect: 'none', cursor: editMode ? (isOverlay ? 'grabbing' : 'grab') : 'default' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0, flex: 1 }}>
          {/* Grip dots — only visible in edit mode */}
          <motion.div animate={{ opacity: editMode ? 0.25 : 0, width: editMode ? 'auto' : 0 }} transition={{ duration: 0.2 }} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2.5px', flexShrink: 0, overflow: 'hidden' }}>
            {[0, 1, 2, 3, 4, 5].map(i => <div key={i} style={{ width: 3, height: 3, borderRadius: '50%', background: C.dark }} />)}
          </motion.div>
          <span style={{ fontSize: 12, fontWeight: 600, color: C.dark, letterSpacing: '-0.01em', flexShrink: 0 }}>{card.title}</span>
          {!collapsed && card.subtitle && <span style={{ fontSize: 11, color: C.faint, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.subtitle}</span>}
          <AnimatePresence>
            {collapsed && (
              <motion.div initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -5 }} transition={{ duration: 0.15 }} style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 2 }}>
                <span style={{ fontSize: 10, color: C.faint }}>{mini.label}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: mini.color || C.dark, letterSpacing: '-0.02em' }}>{mini.value}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
          {!collapsed && card.tags.slice(0, 2).map(t => <span key={t} style={{ fontSize: 9, color: C.faint, background: C.bg, borderRadius: 4, padding: '1px 5px' }}>{t}</span>)}
          {!isOverlay && (
            <motion.button onClick={(e) => { e.stopPropagation(); onCollapse() }} whileTap={{ scale: 0.88 }} style={{ width: 22, height: 22, borderRadius: 6, border: `0.5px solid ${C.border}`, background: C.bg, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <motion.svg width="10" height="10" viewBox="0 0 10 10" animate={{ rotate: collapsed ? 180 : 0 }} transition={{ type: 'spring', stiffness: 380, damping: 26 }}>
                <path d="M2 3.5L5 6.5L8 3.5" stroke={C.muted} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </motion.svg>
            </motion.button>
          )}
        </div>
      </div>
      {!isOverlay && children}
    </div>
  )
}

// ─── SortableCard ─────────────────────────────────────────────────────────────
function SortableCard({ card, collapsed, onCollapse, editMode }: { card: CardDef; collapsed: boolean; onCollapse: () => void; editMode: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id, disabled: !editMode })
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, marginBottom: 12, touchAction: 'none' }} {...attributes} {...(editMode ? listeners : {})}>
      <CardShell card={card} collapsed={collapsed} onCollapse={onCollapse} isDragging={isDragging} editMode={editMode}>
        {/* Skip rendering chart content while dragging — avoids hook issues in DragOverlay context */}
        {!isDragging && <AnimatedCardBody visible={!collapsed}>{card.render()}</AnimatedCardBody>}
      </CardShell>
    </div>
  )
}

// ─── DroppableColumn ──────────────────────────────────────────────────────────
function DroppableColumn({ id, cards, collapsed, onCollapse, isOver, editMode }: {
  id: string; cards: CardDef[]; collapsed: Set<string>; onCollapse: (id: string) => void; isOver: boolean; editMode: boolean
}) {
  const { setNodeRef } = useDroppable({ id })
  return (
    <div ref={setNodeRef} style={{ flex: 1, minWidth: 0, borderRadius: 14, padding: editMode ? 6 : 0, margin: editMode ? -6 : 0, transition: 'background 0.15s, padding 0.2s', background: isOver && editMode ? 'rgba(26,26,24,0.04)' : 'transparent' }}>
      <SortableContext items={cards.map(c => c.id)} strategy={verticalListSortingStrategy}>
        {cards.map(card => (
          <SortableCard key={card.id} card={card} collapsed={collapsed.has(card.id)} onCollapse={() => onCollapse(card.id)} editMode={editMode} />
        ))}
        {cards.length === 0 && editMode && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ height: 72, borderRadius: 12, border: `1.5px dashed ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 11, color: C.faint }}>Drop here</span>
          </motion.div>
        )}
      </SortableContext>
    </div>
  )
}

// ─── FullWidthCard ────────────────────────────────────────────────────────────
function FullWidthCard({ card, collapsed, onCollapse }: { card: CardDef; collapsed: boolean; onCollapse: () => void }) {
  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.22 }} style={{ marginBottom: 12 }}>
      <div style={{ background: C.card, border: `0.5px solid ${C.border}`, borderRadius: 18, overflow: 'hidden' }}>
        <div style={{ padding: collapsed ? '11px 16px' : '12px 18px 10px', borderBottom: collapsed ? 'none' : `0.5px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, userSelect: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0, flex: 1 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: C.dark, letterSpacing: '-0.01em', flexShrink: 0 }}>{card.title}</span>
            {!collapsed && card.subtitle && <span style={{ fontSize: 11, color: C.faint, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.subtitle}</span>}
            <AnimatePresence>
              {collapsed && (() => { const mini = card.miniStat(); return (<motion.div initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -5 }} transition={{ duration: 0.15 }} style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 2 }}><span style={{ fontSize: 10, color: C.faint }}>{mini.label}</span><span style={{ fontSize: 14, fontWeight: 600, color: mini.color || C.dark, letterSpacing: '-0.02em' }}>{mini.value}</span></motion.div>) })()}
            </AnimatePresence>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
            {!collapsed && card.tags.slice(0, 2).map(t => <span key={t} style={{ fontSize: 9, color: C.faint, background: C.bg, borderRadius: 4, padding: '1px 5px' }}>{t}</span>)}
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

  // ── Layout state — hydrate from saved orgContext.analytics_layout ──────────
  const saved = orgContext.analytics_layout
  const [leftIds, setLeftIds] = useState<string[]>(saved?.left ?? DEFAULT_LEFT)
  const [rightIds, setRightIds] = useState<string[]>(saved?.right ?? DEFAULT_RIGHT)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set(saved?.collapsed ?? []))
  const toggleCollapse = useCallback((id: string) => setCollapsed(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n }), [])

  // ── Edit mode ─────────────────────────────────────────────────────────────
  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  // Snapshot taken when entering edit mode — used for cancel
  const snapshot = useRef<{ left: string[]; right: string[]; collapsed: string[] } | null>(null)

  function enterEdit() {
    snapshot.current = { left: [...leftIds], right: [...rightIds], collapsed: Array.from(collapsed) }
    setEditMode(true)
    setSaveError(null)
  }

  function cancelEdit() {
    if (snapshot.current) {
      setLeftIds(snapshot.current.left)
      setRightIds(snapshot.current.right)
      setCollapsed(new Set(snapshot.current.collapsed))
    }
    setEditMode(false)
    setSaveError(null)
  }

  async function saveLayout() {
    setSaving(true)
    setSaveError(null)
    try {
      const layout: AnalyticsLayout = { left: leftIds, right: rightIds, collapsed: Array.from(collapsed) }
      const res = await fetch('/api/analytics-layout', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layout }),
      })
      if (!res.ok) throw new Error('Save failed')
      setEditMode(false)
      snapshot.current = null
    } catch {
      setSaveError('Could not save — try again')
    } finally {
      setSaving(false)
    }
  }

  // ── dnd-kit ───────────────────────────────────────────────────────────────
  const [activeId, setActiveId] = useState<string | null>(null)
  const [overColId, setOverColId] = useState<string | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  function handleDragStart(e: DragStartEvent) { setActiveId(e.active.id as string) }

  function handleDragOver(e: DragOverEvent) {
    const { active, over } = e
    if (!over) return
    const overId = over.id as string
    setOverColId(leftIds.includes(overId) || overId === 'left' ? 'left' : rightIds.includes(overId) || overId === 'right' ? 'right' : null)
    const activeInLeft = leftIds.includes(active.id as string)
    const activeInRight = rightIds.includes(active.id as string)
    const overInLeft = leftIds.includes(overId) || overId === 'left'
    const overInRight = rightIds.includes(overId) || overId === 'right'
    if (activeInLeft && overInRight) {
      setLeftIds(prev => prev.filter(id => id !== active.id))
      setRightIds(prev => { const overIdx = prev.indexOf(overId); const insertAt = overIdx >= 0 ? overIdx : prev.length; const next = prev.filter(id => id !== active.id); next.splice(insertAt, 0, active.id as string); return next })
    } else if (activeInRight && overInLeft) {
      setRightIds(prev => prev.filter(id => id !== active.id))
      setLeftIds(prev => { const overIdx = prev.indexOf(overId); const insertAt = overIdx >= 0 ? overIdx : prev.length; const next = prev.filter(id => id !== active.id); next.splice(insertAt, 0, active.id as string); return next })
    }
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (over) {
      const overId = over.id as string
      if (leftIds.includes(active.id as string) && leftIds.includes(overId)) setLeftIds(prev => arrayMove(prev, prev.indexOf(active.id as string), prev.indexOf(overId)))
      else if (rightIds.includes(active.id as string) && rightIds.includes(overId)) setRightIds(prev => arrayMove(prev, prev.indexOf(active.id as string), prev.indexOf(overId)))
    }
    setActiveId(null)
    setOverColId(null)
  }

  // ── Card definitions ──────────────────────────────────────────────────────
  const allCards: CardDef[] = [
    { id: 'stats', title: 'Overview', subtitle: `${active.length} active ${dealWord}`, span: 2, tags: ['deals'], miniStat: () => ({ label: 'pipeline', value: fmt(pipelineVal) }), visible: activeTag === 'all' || activeTag === 'deals', render: () => <StatStrip isDesktop={isDesktop} stats={[{ label: 'Pipeline', value: fmt(pipelineVal), sub: `${active.length} ${dealWord}` }, { label: 'Weighted', value: fmt(weighted), sub: 'prob-adj' }, { label: 'Win rate', value: `${winRate}%`, sub: `${won.length}W·${lost.length}L`, color: winRate >= 50 ? C.green : C.amber }, { label: 'Avg deal', value: fmt(avgDeal), sub: 'closed won' }, { label: 'Contacts', value: String(contacts.length), sub: `${followupsDue} due` }]} /> },
    ...(quota?.quota ? [{ id: 'quota', title: 'Quota attainment', subtitle: quota.quota_period || '', span: 2 as const, tags: ['forecast', 'performance'], miniStat: () => ({ label: 'attained', value: `${(quota.attainment_pct || 0).toFixed(0)}%`, color: (quota.attainment_pct || 0) >= 75 ? C.green : (quota.attainment_pct || 0) >= 40 ? C.amber : C.red }), visible: activeTag === 'all' || ['deals', 'forecast', 'performance'].includes(activeTag), render: () => <QuotaProgress quota={quota!} /> }] : []),
    { id: 'scatter', title: 'Deal age vs value', subtitle: 'active pipeline', span: 2, tags: ['deals', 'live'], miniStat: () => ({ label: 'active', value: fmt(pipelineVal) }), visible: activeTag === 'all' || ['deals', 'live'].includes(activeTag), render: () => <DealAgeScatter deals={deals} stageLabels={stageLabels} atRiskDays={atRiskDays} /> },
    ...(isElevated && repPerformance?.length ? [{ id: 'team', title: 'Team performance', subtitle: `${repPerformance!.length} reps`, span: 2 as const, tags: ['team', 'performance'], miniStat: () => ({ label: 'reps', value: String(repPerformance!.length) }), visible: activeTag === 'all' || ['team', 'performance'].includes(activeTag), render: () => <RepPerformanceTable repPerformance={repPerformance!} /> }] : []),
    { id: 'followup', title: 'Follow-up calendar', subtitle: 'next 14 days', span: 2, tags: ['contacts'], miniStat: () => ({ label: 'due', value: String(followupsDue), color: followupsDue > 0 ? C.amber : C.faint }), visible: activeTag === 'all' || activeTag === 'contacts', render: () => <FollowupCalendar contacts={contacts} /> },
    { id: 'treemap', title: 'Pipeline by company', subtitle: 'active deal value', span: 2, tags: ['companies'], miniStat: () => ({ label: 'cos', value: String(companies.length) }), visible: activeTag === 'all' || activeTag === 'companies', render: () => <CompanyTreemap deals={deals} companies={companies} /> },
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
  const fullWidthCards = allCards.filter(c => c.span === 2 && c.visible)
  const leftCards = leftIds.map(id => cardMap[id]).filter(c => c?.visible)
  const rightCards = rightIds.map(id => cardMap[id]).filter(c => c?.visible)
  const activeCard = activeId ? cardMap[activeId] : null

  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div style={{ paddingTop: 8, paddingBottom: 40 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, gap: 12 }}>
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          <h1 style={{ fontSize: 22, fontWeight: 500, color: C.dark, margin: 0, marginBottom: 2 }}>Analytics</h1>
          <div style={{ fontSize: 12, color: C.faint }}>{today}{industry ? ` · ${industry}` : ''}</div>
        </motion.div>

        {/* Edit / Save / Cancel controls — desktop only */}
        {isDesktop && (
          <AnimatePresence mode="wait">
            {editMode ? (
              <motion.div key="edit-controls" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 4 }}>
                {saveError && <span style={{ fontSize: 11, color: C.red }}>{saveError}</span>}
                <button onClick={cancelEdit} style={{ padding: '7px 16px', borderRadius: 20, fontSize: 12, cursor: 'pointer', border: `0.5px solid rgba(0,0,0,0.12)`, background: C.card, color: C.muted, fontFamily: 'inherit', fontWeight: 500, transition: 'all 0.15s' }}>
                  Cancel
                </button>
                <motion.button onClick={saveLayout} disabled={saving} whileTap={{ scale: 0.96 }}
                  style={{ padding: '7px 18px', borderRadius: 20, fontSize: 12, cursor: saving ? 'wait' : 'pointer', border: 'none', background: C.dark, color: 'white', fontFamily: 'inherit', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6, opacity: saving ? 0.7 : 1, transition: 'opacity 0.15s' }}>
                  {saving && (
                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                      style={{ width: 11, height: 11, borderRadius: '50%', border: `1.5px solid rgba(255,255,255,0.3)`, borderTopColor: 'white' }} />
                  )}
                  {saving ? 'Saving…' : 'Save layout'}
                </motion.button>
              </motion.div>
            ) : (
              <motion.div key="view-controls" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }} style={{ paddingTop: 4 }}>
                <motion.button onClick={enterEdit} whileTap={{ scale: 0.96 }}
                  style={{ padding: '7px 16px', borderRadius: 20, fontSize: 12, cursor: 'pointer', border: `0.5px solid rgba(0,0,0,0.12)`, background: C.card, color: C.muted, fontFamily: 'inherit', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s' }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M8.5 1.5L10.5 3.5L4 10H2V8L8.5 1.5Z" stroke={C.muted} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Edit layout
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>

      {/* ── Edit mode banner ── */}
      <AnimatePresence>
        {editMode && isDesktop && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden', marginBottom: 14 }}>
            <div style={{ background: `rgba(26,26,24,0.04)`, borderRadius: 10, padding: '9px 14px', fontSize: 11, color: C.muted, display: 'flex', alignItems: 'center', gap: 7, border: `0.5px solid rgba(26,26,24,0.08)` }}>
              <svg width="12" height="12" viewBox="0 0 12 12"><circle cx="4" cy="3" r="1" fill={C.muted} /><circle cx="8" cy="3" r="1" fill={C.muted} /><circle cx="4" cy="6" r="1" fill={C.muted} /><circle cx="8" cy="6" r="1" fill={C.muted} /><circle cx="4" cy="9" r="1" fill={C.muted} /><circle cx="8" cy="9" r="1" fill={C.muted} /></svg>
              Drag cards to rearrange — across columns too. Collapse with ↓. Hit <strong style={{ color: C.dark }}>Save layout</strong> when done.
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Tag nav ── */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 20 }}>
        {['all', ...ALL_TAGS].map(tag => (
          <motion.button key={tag} onClick={() => setActiveTag(tag)} whileTap={{ scale: 0.93 }} style={{ padding: '5px 13px', borderRadius: 20, fontSize: 11, cursor: 'pointer', border: `0.5px solid ${activeTag === tag ? C.dark : 'rgba(0,0,0,0.09)'}`, background: activeTag === tag ? C.dark : C.card, color: activeTag === tag ? 'white' : C.muted, fontWeight: activeTag === tag ? 500 : 400, fontFamily: 'inherit', transition: 'background 0.15s, color 0.15s, border-color 0.15s', textTransform: 'capitalize' }}>{tag === 'all' ? 'All' : tag}</motion.button>
        ))}
      </div>

      {/* ── Full-width cards ── */}
      <AnimatePresence>
        {fullWidthCards.map(card => (
          <FullWidthCard key={card.id} card={card} collapsed={collapsed.has(card.id)} onCollapse={() => toggleCollapse(card.id)} />
        ))}
      </AnimatePresence>

      {/* ── Two-column grid — desktop ── */}
      {isDesktop ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <DroppableColumn id="left" cards={leftCards} collapsed={collapsed} onCollapse={toggleCollapse} isOver={overColId === 'left'} editMode={editMode} />
            <DroppableColumn id="right" cards={rightCards} collapsed={collapsed} onCollapse={toggleCollapse} isOver={overColId === 'right'} editMode={editMode} />
          </div>
          <DragOverlay dropAnimation={{ duration: 200, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
            {activeCard && editMode && (
              <CardShell card={activeCard} collapsed={collapsed.has(activeCard.id)} onCollapse={() => { }} isOverlay editMode>{null}</CardShell>
            )}
          </DragOverlay>
        </DndContext>
      ) : (
        /* ── Mobile: single column, collapse only ── */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[...leftIds, ...rightIds].map(id => {
            const card = cardMap[id]; if (!card?.visible) return null
            return (
              <div key={id} style={{ background: C.card, border: `0.5px solid ${C.border}`, borderRadius: 18, overflow: 'hidden' }}>
                <div style={{ padding: collapsed.has(id) ? '11px 14px' : '12px 16px 10px', borderBottom: collapsed.has(id) ? 'none' : `0.5px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: C.dark, letterSpacing: '-0.01em' }}>{card.title}</span>
                    {!collapsed.has(id) && card.subtitle && <span style={{ fontSize: 11, color: C.faint, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.subtitle}</span>}
                  </div>
                  <motion.button onClick={() => toggleCollapse(id)} whileTap={{ scale: 0.88 }} style={{ width: 22, height: 22, borderRadius: 6, border: `0.5px solid ${C.border}`, background: C.bg, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <motion.svg width="10" height="10" viewBox="0 0 10 10" animate={{ rotate: collapsed.has(id) ? 180 : 0 }} transition={{ type: 'spring', stiffness: 380, damping: 26 }}>
                      <path d="M2 3.5L5 6.5L8 3.5" stroke={C.muted} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </motion.svg>
                  </motion.button>
                </div>
                <AnimatedCardBody visible={!collapsed.has(id)}>{card.render()}</AnimatedCardBody>
              </div>
            )
          })}
        </div>
      )}

      <style>{`
        button { font-family: inherit; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  )
}