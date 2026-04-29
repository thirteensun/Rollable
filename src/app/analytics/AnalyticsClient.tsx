'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
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
type Contact = { id: string; full_name: string; role?: string; company_name?: string; last_contacted_at?: string; next_followup_date?: string; created_at: string }
type Company = { id: string; name: string; industry?: string; created_at: string }
type Task = { id: string; title?: string; status?: string; done?: boolean; due_date?: string; priority?: string; deal_id?: string; contact_id?: string }
type StageVelocity = { stage: string; avg_days: number; transitions: number }
type StageConversion = { stage: string; deals_entered: number; deals_advanced: number; deals_lost_here: number; advance_rate_pct: number }
type Quota = { quota?: number; quota_period?: string; confirmed_revenue?: number; pipeline_value?: number; attainment_pct?: number; gap_to_quota?: number }
type RepRow = { user_id: string; email: string; role: string; quota?: number; quota_period?: string; confirmed_revenue?: number; pipeline_value?: number; attainment_pct?: number; gap_to_quota?: number; at_risk_count: number }
type OrgContext = { industry?: string; cycle_days?: number; at_risk_days?: number; stage_template?: string; team_size?: number; terminology?: string; pain_points?: string[]; analytics_layout?: any }
type Props = {
  deals: Deal[]; contacts: Contact[]; companies: Company[]
  tasks: Task[]; stageVelocity: StageVelocity[]
  quota: Quota | null; stageConversion: StageConversion[]
  orgContext: OrgContext; isElevated: boolean; repPerformance: RepRow[] | null
}

// ─── Tokens ───────────────────────────────────────────────────────────────────
const STAGE_PROB: Record<string, number> = { lead: .10, qualified: .25, demo: .40, proposal: .60, negotiation: .80 }
const C = { bg: '#f5f4f0', dark: '#1a1a18', muted: '#6b6960', faint: '#9b9890', border: 'rgba(0,0,0,0.07)', red: '#E24B4A', amber: '#EF9F27', green: '#1D9E75', card: 'white' }

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

// ─── Nav definition ───────────────────────────────────────────────────────────
type NavItem = { id: string; label: string; group: string }
const NAV_ITEMS: NavItem[] = [
  { id: 'funnel', label: 'Funnel', group: 'Pipeline' },
  { id: 'winloss', label: 'Win / loss', group: 'Pipeline' },
  { id: 'conversion', label: 'Stage conversion', group: 'Pipeline' },
  { id: 'agedist', label: 'Deal age dist.', group: 'Pipeline' },
  { id: 'revenue', label: 'Revenue closed', group: 'Revenue' },
  { id: 'forecast', label: 'Forecast', group: 'Revenue' },
  { id: 'quota', label: 'Quota', group: 'Revenue' },
  { id: 'followup', label: 'Follow-ups', group: 'Activity' },
  { id: 'treemap', label: 'By company', group: 'Activity' },
  { id: 'velocity', label: 'Velocity', group: 'Activity' },
  { id: 'atrisk', label: 'At risk', group: 'Problems' },
  { id: 'uninvoiced', label: 'Not invoiced', group: 'Problems' },
  { id: 'loss', label: 'Loss reasons', group: 'Problems' },
  { id: 'team', label: 'Team performance', group: 'Team' },
]

// ─── Charts ───────────────────────────────────────────────────────────────────

function FunnelChart({ deals, stageLabels }: { deals: Deal[]; stageLabels: Record<string, string> }) {
  const stages = ['lead', 'qualified', 'demo', 'proposal', 'negotiation']
  const rows = stages.map(s => ({
    stage: s,
    count: deals.filter(d => d.stage === s).length,
    value: deals.filter(d => d.stage === s).reduce((a, d) => a + (d.value || 0), 0),
  }))
  const maxVal = Math.max(...rows.map(r => r.value), 1)
  const tealStops = ['#c4dde3', '#c4dde3', '#aacfd8', '#d8eaee', '#e8f5f1']
  const textColors = ['#085041', '#085041', '#085041', '#0F6E56', '#1D9E75']
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {rows.map((row, i) => (
        <div key={row.stage} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 76, fontSize: 12, color: C.muted, flexShrink: 0 }}>{stageLabels[row.stage] || row.stage}</div>
          <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
            <motion.div
              initial={{ width: 0 }} animate={{ width: `${Math.max((row.value / maxVal) * 100, row.count > 0 ? 6 : 0)}%` }}
              transition={{ duration: 0.7, delay: i * 0.08, ease: [0.25, 0.46, 0.45, 0.94] }}
              style={{ height: 26, borderRadius: 4, background: tealStops[i], display: 'flex', alignItems: 'center', padding: '0 10px', minWidth: row.count > 0 ? 40 : 0 }}
            >
              {row.count > 0 && <span style={{ fontSize: 12, fontWeight: 500, color: textColors[i], whiteSpace: 'nowrap' }}>{fmt(row.value)}</span>}
            </motion.div>
          </div>
          <div style={{ fontSize: 11, color: C.faint, flexShrink: 0, width: 52, textAlign: 'right' }}>{row.count} deals</div>
        </div>
      ))}
    </div>
  )
}

function WinLossDonut({ deals }: { deals: Deal[] }) {
  const won = deals.filter(d => d.stage === 'closed_won').length
  const lost = deals.filter(d => d.stage === 'closed_lost').length
  const total = won + lost
  const winRate = total > 0 ? Math.round((won / total) * 100) : 0
  const wonPct = total > 0 ? Math.round((won / total) * 100) : 0
  const lostPct = total > 0 ? Math.round((lost / total) * 100) : 0

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 32, fontWeight: 600, color: '#1a1a18', lineHeight: 1 }}>{winRate}%</div>
          <div style={{ fontSize: 11, color: '#9b9890', marginTop: 3 }}>win rate · {total} closed</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: '#6b6960' }}>Won</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#1D9E75' }}>{won}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: '#6b6960' }}>Lost</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#E24B4A' }}>{lost}</span>
          </div>
        </div>
      </div>

      {/* Bar */}
      <div style={{ height: 8, borderRadius: 99, background: 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        {total > 0 && (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${wonPct}%` }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
            style={{ height: '100%', background: '#1D9E75', borderRadius: 99 }}
          />
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
        <span style={{ fontSize: 10, color: '#1D9E75' }}>{wonPct}% won</span>
        <span style={{ fontSize: 10, color: '#E24B4A' }}>{lostPct}% lost</span>
      </div>
    </div>
  )
}

function ConversionChart({ stageConversion, stageLabels }: { stageConversion: StageConversion[]; stageLabels: Record<string, string> }) {
  if (stageConversion.length === 0) return <div style={{ fontSize: 12, color: C.faint }}>Populates as deals progress</div>
  const stages = ['lead', 'qualified', 'demo', 'proposal', 'negotiation']
  const colorMap: Record<string, { bg: string; text: string }> = {
    green: { bg: '#e8f5f1', text: '#085041' },
    amber: { bg: '#fdf3e3', text: '#633806' },
    red: { bg: '#fceaea', text: '#791F1F' },
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {stages.map((stage, i) => {
        const row = stageConversion.find(s => s.stage === stage)
        const rate = row ? Math.round((row.deals_advanced / Math.max(row.deals_entered, 1)) * 100) : 0
        const tier = rate >= 65 ? 'green' : rate >= 45 ? 'amber' : 'red'
        const { bg, text } = colorMap[tier]
        return (
          <div key={stage} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 88, fontSize: 12, color: C.muted, flexShrink: 0 }}>{stageLabels[stage] || stage}</div>
            <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
              <motion.div
                initial={{ width: 0 }} animate={{ width: `${Math.max(rate, 6)}%` }}
                transition={{ duration: 0.6, delay: i * 0.08, ease: [0.25, 0.46, 0.45, 0.94] }}
                style={{ height: 26, borderRadius: 4, background: bg, display: 'flex', alignItems: 'center', padding: '0 10px', minWidth: 40 }}
              >
                <span style={{ fontSize: 12, fontWeight: 500, color: text, whiteSpace: 'nowrap' }}>{rate}%</span>
              </motion.div>
            </div>
            <div style={{ fontSize: 11, color: C.faint, flexShrink: 0, width: 52, textAlign: 'right' }}>{row?.deals_entered ?? 0} deals</div>
          </div>
        )
      })}
    </div>
  )
}

function RevenueBarChart({ deals }: { deals: Deal[] }) {
  const [ref, W] = useContainerWidth(400)
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(); d.setMonth(d.getMonth() - (5 - i))
    const y = d.getFullYear(); const m = d.getMonth()
    return {
      label: d.toLocaleString('default', { month: 'short' }),
      value: deals.filter(d => d.stage === 'closed_won' && d.closed_at).filter(d => { const cd = new Date(d.closed_at!); return cd.getFullYear() === y && cd.getMonth() === m }).reduce((s, d) => s + (d.confirmed_revenue || d.value || 0), 0)
    }
  })
  const maxVal = Math.max(...months.map(m => m.value), 1)
  const VH = 120; const chartH = 90; const pad = 4; const slot = (W - pad * 2) / 6; const barW = Math.max(slot * 0.55, 8)
  return (
    <div ref={ref}>
      <svg width="100%" height={VH} style={{ display: 'block', overflow: 'visible' }}>
        {months.map((m, i) => {
          const barH = m.value > 0 ? Math.max((m.value / maxVal) * chartH, 3) : 0
          const cx = pad + i * slot + slot / 2
          return (
            <g key={i}>
              <rect x={cx - barW / 2} y={0} width={barW} height={chartH} fill={C.bg} rx={5} />
              {barH > 0 && <motion.rect x={cx - barW / 2} width={barW} rx={5} fill={C.dark} initial={{ y: chartH, height: 0 }} animate={{ y: chartH - barH, height: barH }} transition={{ duration: 0.6, delay: i * 0.07, ease: [0.25, 0.46, 0.45, 0.94] }} />}
              {m.value > 0 && <text x={cx} y={chartH - barH - 4} textAnchor="middle" fontSize={8} fill={C.muted} fontWeight="500">{fmt(m.value)}</text>}
              <text x={cx} y={VH - 1} textAnchor="middle" fontSize={9} fill={C.faint}>{m.label}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function ForecastChart({ deals, quota, stageLabels }: { deals: Deal[]; quota: Quota | null; stageLabels: Record<string, string> }) {
  const [ref, W] = useContainerWidth(400)
  const confirmed = quota?.confirmed_revenue || 0
  const bars = ['lead', 'qualified', 'demo', 'proposal', 'negotiation']
    .map(s => ({ label: stageLabels[s] || s, value: deals.filter(d => d.stage === s).reduce((a, d) => a + (d.value || 0) * (STAGE_PROB[s] || 0), 0), color: '#4a7a8a' }))
    .filter(b => b.value > 0)
  const allBars = [...(confirmed > 0 ? [{ label: 'Confirmed', value: confirmed, color: C.green, isConfirmed: true }] : []), ...bars.map(b => ({ ...b, isConfirmed: false }))]
  const hasQuota = !!quota?.quota
  const totalSlots = allBars.length + (hasQuota ? 1 : 0)
  const maxVal = Math.max(confirmed + bars.reduce((s, b) => s + b.value, 0), quota?.quota || 0, 1)
  const VH = 130; const chartH = 95; const pad = 6
  const slot = totalSlots > 0 ? (W - pad * 2) / totalSlots : 36
  const bW = Math.max(slot * 0.58, 6)
  return (
    <div ref={ref}>
      <svg width="100%" height={VH} style={{ display: 'block', overflow: 'visible' }}>
        {allBars.map((b, i) => {
          const barH = Math.max((b.value / maxVal) * chartH, 3)
          const cx = pad + i * slot + slot / 2
          return (
            <g key={i}>
              <rect x={cx - bW / 2} y={0} width={bW} height={chartH} fill={C.bg} rx={4} />
              <motion.rect x={cx - bW / 2} width={bW} rx={4} fill={b.color} opacity={(b as any).isConfirmed ? 1 : 0.75} initial={{ y: chartH, height: 0 }} animate={{ y: chartH - barH, height: barH }} transition={{ duration: 0.6, delay: i * 0.08, ease: [0.25, 0.46, 0.45, 0.94] }} />
              <text x={cx} y={chartH - barH - 3} textAnchor="middle" fontSize={7} fill={C.muted} fontWeight="600">{fmt(b.value)}</text>
              <text x={cx} y={VH - 1} textAnchor="middle" fontSize={8} fill={C.faint}>{b.label.slice(0, 7)}</text>
            </g>
          )
        })}
        {hasQuota && (() => {
          const cx = pad + allBars.length * slot + slot / 2
          const qY = chartH - ((quota!.quota! / maxVal) * chartH)
          return (
            <g key="quota">
              <line x1={cx - bW / 2} y1={qY} x2={cx + bW / 2} y2={qY} stroke={C.amber} strokeWidth={2} strokeDasharray="4 3" />
              <text x={cx} y={qY - 4} textAnchor="middle" fontSize={7} fill={C.amber} fontWeight="600">{fmt(quota!.quota)}</text>
              <text x={cx} y={VH - 1} textAnchor="middle" fontSize={8} fill={C.amber}>Quota</text>
            </g>
          )
        })()}
      </svg>
    </div>
  )
}

function QuotaProgress({ quota }: { quota: Quota }) {
  const pct = clamp(quota.attainment_pct || 0, 0, 100)
  const color = pct >= 75 ? C.green : pct >= 40 ? C.amber : C.red
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <span style={{ fontSize: 28, fontWeight: 600, color, letterSpacing: '-0.03em' }}>{pct.toFixed(1)}%</span>
        <span style={{ fontSize: 12, color: C.faint }}>{quota.quota_period} quota</span>
      </div>
      <div style={{ height: 8, background: C.bg, borderRadius: 4, overflow: 'hidden', marginBottom: 12 }}>
        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.9, ease: [0.25, 0.46, 0.45, 0.94] }} style={{ height: '100%', background: color, borderRadius: 4 }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        {[{ label: 'Confirmed', value: fmt(quota.confirmed_revenue) }, { label: 'Gap', value: fmt(quota.gap_to_quota), red: true }, { label: 'Quota', value: fmt(quota.quota) }].map(s => (
          <div key={s.label} style={{ textAlign: s.label === 'Gap' ? 'center' : s.label === 'Quota' ? 'right' : 'left' }}>
            <div style={{ fontSize: 10, color: C.faint }}>{s.label}</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: s.red ? C.red : C.dark }}>{s.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FollowupCalendar({ contacts }: { contacts: Contact[] }) {
  const todayStr = new Date().toISOString().split('T')[0]
  const overdueCount = contacts.filter(c => c.next_followup_date && c.next_followup_date < todayStr).length
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i)
    const dateStr = d.toISOString().split('T')[0]
    const count = contacts.filter(c => c.next_followup_date === dateStr).length
    return { label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en', { weekday: 'short', day: 'numeric', month: 'short' }), count, isToday: i === 0 }
  }).filter(d => d.count > 0)
  if (days.length === 0) return <div style={{ fontSize: 12, color: C.faint, padding: '12px 0' }}>No follow-ups scheduled in next 14 days</div>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {days.map((day, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 90, fontSize: 11, flexShrink: 0, color: day.isToday ? C.dark : C.muted, fontWeight: day.isToday ? 600 : 400 }}>{day.label}</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', flex: 1, alignItems: 'center' }}>
            {Array.from({ length: day.count }).map((_, j) => {
              const isOverdue = day.isToday && j >= day.count - overdueCount
              return <div key={j} style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: isOverdue ? C.red : day.isToday ? C.green : '#c4dde3' }} />
            })}
          </div>
          <div style={{ fontSize: 12, fontWeight: 500, color: C.dark, width: 20, textAlign: 'right', flexShrink: 0 }}>{day.count}</div>
        </div>
      ))}
    </div>
  )
}

function CompanyPipeline({ deals, companies }: { deals: Deal[]; companies: Company[] }) {
  const active = deals.filter(d => !['closed_won', 'closed_lost'].includes(d.stage))
  const vals = companies
    .map(c => ({ name: c.name, value: active.filter(d => (d as any).company_id === c.id).reduce((s, d) => s + (d.value || 0), 0), dealCount: active.filter(d => (d as any).company_id === c.id).length }))
    .filter(c => c.value > 0).sort((a, b) => b.value - a.value).slice(0, 8)
  if (vals.length === 0) return <div style={{ fontSize: 12, color: C.faint, padding: '12px 0' }}>No company pipeline data</div>
  const maxVal = vals[0].value
  const tealStops = ['#c4dde3', '#c4dde3', '#aacfd8', '#aacfd8', '#d8eaee', '#d8eaee', '#e8f5f1', '#e8f5f1']
  const textColors = ['#085041', '#085041', '#085041', '#085041', '#0F6E56', '#0F6E56', '#1D9E75', '#1D9E75']
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {vals.map((c, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 120, fontSize: 11, color: C.muted, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
          <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
            <motion.div initial={{ width: 0 }} animate={{ width: `${(c.value / maxVal) * 100}%` }} transition={{ duration: 0.6, delay: i * 0.07, ease: [0.25, 0.46, 0.45, 0.94] }}
              style={{ height: 26, borderRadius: 4, background: tealStops[i] || '#e8f5f1', display: 'flex', alignItems: 'center', padding: '0 10px', minWidth: 40 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: textColors[i] || '#1D9E75', whiteSpace: 'nowrap' }}>{fmt(c.value)}</span>
            </motion.div>
          </div>
          <div style={{ fontSize: 11, color: C.faint, flexShrink: 0, width: 24, textAlign: 'right' }}>{c.dealCount}d</div>
        </div>
      ))}
    </div>
  )
}

function VelocityChart({ stageVelocity, stageLabels }: { stageVelocity: StageVelocity[]; stageLabels: Record<string, string> }) {
  if (stageVelocity.length === 0) return <div style={{ fontSize: 12, color: C.faint, padding: '12px 0' }}>Populates as deals move through stages</div>
  const stages = ['lead', 'qualified', 'demo', 'proposal', 'negotiation']
  const maxDays = Math.max(...stageVelocity.map(s => s.avg_days), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {stages.map((stage, i) => {
        const row = stageVelocity.find(s => s.stage === stage); if (!row) return null
        const intensity = row.avg_days / maxDays
        const bg = `rgba(26,26,24,${0.06 + intensity * 0.7})`
        const tc = intensity > 0.5 ? 'white' : C.dark
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

function AtRiskTable({ deals, stageLabels, atRiskDays }: { deals: Deal[]; stageLabels: Record<string, string>; atRiskDays: number }) {
  const atRisk = deals.filter(d => !['closed_won', 'closed_lost'].includes(d.stage) && daysSince(d.last_activity_at) >= atRiskDays).sort((a, b) => daysSince(b.last_activity_at) - daysSince(a.last_activity_at))
  if (atRisk.length === 0) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0' }}>
      <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#e8f5f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 5l2 2 4-4" stroke={C.green} strokeWidth="1.5" fill="none" strokeLinecap="round" /></svg>
      </div>
      <span style={{ fontSize: 12, color: C.muted }}>All clear</span>
    </div>
  )
  return (
    <div>
      {atRisk.map((d, i) => (
        <Link key={d.id} href={`/tracking/deals/${d.id}`} style={{ textDecoration: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: i < atRisk.length - 1 ? `0.5px solid ${C.border}` : 'none' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: C.dark, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</div>
              <div style={{ fontSize: 10, color: C.faint }}>{stageLabels[d.stage] || d.stage}</div>
            </div>
            <div style={{ fontSize: 11, color: C.muted, flexShrink: 0 }}>{fmt(d.value)}</div>
            <div style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 6, background: '#fdeaea', color: C.red, flexShrink: 0 }}>{daysSince(d.last_activity_at)}d</div>
          </div>
        </Link>
      ))}
    </div>
  )
}

function UninvoicedTable({ deals }: { deals: Deal[] }) {
  const uninvoiced = deals.filter(d => d.stage === 'closed_won' && (!d.payment_status || d.payment_status === 'none'))
  const total = uninvoiced.reduce((s, d) => s + (d.confirmed_revenue || d.value || 0), 0)
  if (uninvoiced.length === 0) return <div style={{ fontSize: 12, color: C.faint, padding: '12px 0' }}>All won deals invoiced ✓</div>
  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 600, color: C.red, letterSpacing: '-0.02em', marginBottom: 12 }}>{fmt(total)}</div>
      {uninvoiced.map((d, i) => (
        <Link key={d.id} href={`/tracking/deals/${d.id}`} style={{ textDecoration: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < uninvoiced.length - 1 ? `0.5px solid ${C.border}` : 'none' }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: C.dark, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: 10 }}>{d.name}</div>
            <div style={{ fontSize: 12, color: C.red, fontWeight: 500, flexShrink: 0 }}>{fmt(d.confirmed_revenue || d.value)}</div>
          </div>
        </Link>
      ))}
    </div>
  )
}

function LossReasons({ deals }: { deals: Deal[] }) {
  const lost = deals.filter(d => d.stage === 'closed_lost' && d.loss_reason)
  if (lost.length === 0) return <div style={{ fontSize: 12, color: C.faint }}>No lost deals recorded yet</div>
  const reasons = lost.reduce((acc: Record<string, number>, d) => { acc[d.loss_reason!] = (acc[d.loss_reason!] || 0) + 1; return acc }, {})
  const sorted = Object.entries(reasons).sort((a, b) => b[1] - a[1]); const max = sorted[0][1]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {sorted.map(([reason, count], i) => (
        <div key={reason} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 120, fontSize: 11, color: C.muted, flexShrink: 0 }}>{reason}</div>
          <div style={{ flex: 1, height: 6, background: C.bg, borderRadius: 3, overflow: 'hidden' }}>
            <motion.div initial={{ width: 0 }} animate={{ width: `${(count / max) * 100}%` }} transition={{ duration: 0.6, delay: i * 0.08 }} style={{ height: '100%', background: C.red, opacity: 0.7, borderRadius: 3 }} />
          </div>
          <div style={{ width: 18, fontSize: 11, fontWeight: 600, color: C.dark, textAlign: 'right' }}>{count}</div>
        </div>
      ))}
    </div>
  )
}

function DealAgeDistribution({ deals }: { deals: Deal[] }) {
  const active = deals.filter(d => !['closed_won', 'closed_lost'].includes(d.stage))
  const buckets = [
    { label: '0–7d', min: 0, max: 7 }, { label: '8–14d', min: 8, max: 14 },
    { label: '15–30d', min: 15, max: 30 }, { label: '31–60d', min: 31, max: 60 }, { label: '60d+', min: 61, max: 9999 }
  ].map(b => ({
    ...b,
    count: active.filter(d => { const age = daysSince(d.created_at); return age >= b.min && age <= b.max }).length,
    value: active.filter(d => { const age = daysSince(d.created_at); return age >= b.min && age <= b.max }).reduce((s, d) => s + (d.value || 0), 0)
  }))
  const maxCount = Math.max(...buckets.map(b => b.count), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {buckets.map((b, i) => (
        <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 44, fontSize: 11, color: C.muted, flexShrink: 0 }}>{b.label}</div>
          <div style={{ flex: 1, height: 18, background: C.bg, borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
            <motion.div initial={{ width: 0 }} animate={{ width: `${(b.count / maxCount) * 100}%` }} transition={{ duration: 0.6, delay: i * 0.08 }}
              style={{ height: '100%', background: b.min >= 60 ? C.red : b.min >= 30 ? C.amber : C.green, opacity: 0.75, borderRadius: 4 }} />
            {b.count > 0 && <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 10, fontWeight: 600, color: (b.count / maxCount) > 0.4 ? 'white' : C.muted }}>{b.count}</span>}
          </div>
          <div style={{ width: 40, fontSize: 11, color: C.faint, textAlign: 'right' }}>{fmt(b.value)}</div>
        </div>
      ))}
    </div>
  )
}

function RepPerformanceTable({ repPerformance }: { repPerformance: RepRow[] }) {
  const [sortKey, setSortKey] = useState<keyof RepRow>('attainment_pct')
  const sorted = [...repPerformance].sort((a, b) => ((b[sortKey] as number) || 0) - ((a[sortKey] as number) || 0))
  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 14, flexWrap: 'wrap' }}>
        {([['attainment_pct', 'Quota %'], ['pipeline_value', 'Pipeline'], ['confirmed_revenue', 'Revenue'], ['at_risk_count', 'At risk']] as [keyof RepRow, string][]).map(([key, label]) => (
          <button key={key} onClick={() => setSortKey(key)} style={{ padding: '4px 10px', borderRadius: 14, fontSize: 10, cursor: 'pointer', border: `0.5px solid ${sortKey === key ? C.dark : 'rgba(0,0,0,0.09)'}`, background: sortKey === key ? C.dark : C.card, color: sortKey === key ? 'white' : C.muted, fontFamily: 'inherit', transition: 'all 0.15s' }}>{label}</button>
        ))}
      </div>
      {sorted.map((rep, i) => {
        const attain = rep.attainment_pct ?? 0
        const attainColor = attain >= 75 ? C.green : attain >= 40 ? C.amber : C.red
        const name = rep.email.split('@')[0]
        return (
          <div key={rep.user_id} style={{ padding: '12px 0', borderBottom: i < sorted.length - 1 ? `0.5px solid ${C.border}` : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: C.bg, border: `0.5px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color: C.muted }}>{name.slice(0, 2).toUpperCase()}</div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: C.dark }}>{name}</div>
                  <div style={{ fontSize: 10, color: C.faint, textTransform: 'capitalize' }}>{rep.role}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {rep.at_risk_count > 0 && <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 6, background: '#fdeaea', color: C.red }}>{rep.at_risk_count} at risk</span>}
                {rep.quota && <span style={{ fontSize: 11, fontWeight: 600, color: attainColor }}>{attain.toFixed(0)}%</span>}
              </div>
            </div>
            {rep.quota && <div style={{ height: 4, background: C.bg, borderRadius: 2, marginBottom: 8, overflow: 'hidden' }}><motion.div initial={{ width: 0 }} animate={{ width: `${clamp(attain, 0, 100)}%` }} transition={{ duration: 0.7, delay: i * 0.06 }} style={{ height: '100%', background: attainColor, borderRadius: 2 }} /></div>}
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              {[['Pipeline', fmt(rep.pipeline_value)], ['Confirmed', fmt(rep.confirmed_revenue)], ...(rep.quota ? [['Quota', fmt(rep.quota)]] : []), ...(rep.gap_to_quota && rep.gap_to_quota > 0 ? [['Gap', fmt(rep.gap_to_quota), true]] : [])].map(([label, value, red]) => (
                <div key={label as string}>
                  <div style={{ fontSize: 9, color: C.faint, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: red ? C.red : C.dark }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Insight content per view ─────────────────────────────────────────────────
function getInsight(id: string, deals: Deal[], contacts: Contact[], stageConversion: StageConversion[], stageVelocity: StageVelocity[], quota: Quota | null, atRiskDays: number, repPerformance?: RepRow[] | null): { meaning: string; badges: { text: string; color: string; bg: string }[]; actions: { text: string; color: string }[] } {
  const active = deals.filter(d => !['closed_won', 'closed_lost'].includes(d.stage))
  const won = deals.filter(d => d.stage === 'closed_won')
  const lost = deals.filter(d => d.stage === 'closed_lost')

  switch (id) {
    case 'funnel': {
      const earlyVal = ['lead', 'qualified'].reduce((s, st) => s + deals.filter(d => d.stage === st).reduce((a, d) => a + (d.value || 0), 0), 0)
      const negCount = deals.filter(d => d.stage === 'negotiation').length
      const propCount = deals.filter(d => d.stage === 'proposal').length
      return {
        meaning: `Most of your pipeline value is sitting in Lead and Qualified — early stages with low close probability. The drop to Demo is significant, suggesting qualification or demo-booking may need attention.`,
        badges: [{ text: `${fmt(earlyVal)} in early stages`, color: '#791F1F', bg: '#fceaea' }, { text: 'Demo is the bottleneck', color: '#633806', bg: '#fdf3e3' }],
        actions: [
          { text: `Book demos for qualified deals this week — each day of delay reduces close probability`, color: C.red },
          { text: `${negCount} negotiation deals are your highest-leverage activity right now — prioritise closing these`, color: C.amber },
          { text: `Follow up on ${propCount} proposals — silence after a proposal usually means it's been forgotten, not rejected`, color: C.green },
        ]
      }
    }
    case 'winloss': {
      const winRate = (won.length + lost.length) > 0 ? Math.round(won.length / (won.length + lost.length) * 100) : 0
      return {
        meaning: `Your win rate is ${winRate}%. ${winRate >= 50 ? 'This is healthy — over half of closed deals are won.' : 'This is below 50%, meaning more deals are lost than won.'} Tracking loss reasons helps identify the most common drop-off points.`,
        badges: [{ text: `${won.length} won · ${lost.length} lost`, color: '#085041', bg: '#e8f5f1' }, { text: `${winRate}% win rate`, color: winRate >= 50 ? '#085041' : '#791F1F', bg: winRate >= 50 ? '#e8f5f1' : '#fceaea' }],
        actions: [
          { text: 'Log a loss reason on every lost deal — patterns only emerge with data', color: C.red },
          { text: 'Review your last 5 lost deals for common objections or timing issues', color: C.amber },
          { text: 'Compare win rates by stage to find where most losses occur', color: C.green },
        ]
      }
    }
    case 'conversion': {
      const avgRate = stageConversion.length > 0 ? Math.round(stageConversion.reduce((s, r) => s + r.advance_rate_pct, 0) / stageConversion.length) : 0
      const weakest = [...stageConversion].sort((a, b) => a.advance_rate_pct - b.advance_rate_pct)[0]
      return {
        meaning: `Average advance rate across stages is ${avgRate}%. ${weakest ? `The weakest stage is ${weakest.stage} at ${Math.round(weakest.advance_rate_pct)}% — this is where most deals are stalling or being lost.` : ''}`,
        badges: [{ text: `${avgRate}% avg advance`, color: avgRate >= 60 ? '#085041' : '#633806', bg: avgRate >= 60 ? '#e8f5f1' : '#fdf3e3' }],
        actions: [
          { text: weakest ? `Focus on improving ${weakest.stage} — it's your biggest conversion leak` : 'Log more deals to see conversion patterns', color: C.red },
          { text: 'Review what happens between Demo and Proposal — that gap is often a pricing or timing issue', color: C.amber },
          { text: 'A 5% improvement at each stage compounds significantly across the whole funnel', color: C.green },
        ]
      }
    }
    case 'agedist': {
      const old = active.filter(d => daysSince(d.created_at) > 60).length
      return {
        meaning: `Deal age distribution shows how long active deals have been in your pipeline. Deals older than 60 days that haven't closed are often stalled — they need either a push or to be marked lost.`,
        badges: [{ text: `${old} deals 60d+`, color: old > 0 ? '#791F1F' : '#085041', bg: old > 0 ? '#fceaea' : '#e8f5f1' }],
        actions: [
          { text: `Review all ${old} deals older than 60 days — qualify or close them out`, color: C.red },
          { text: 'Set expected close dates on all deals to force honest forecasting', color: C.amber },
          { text: 'Healthy pipelines have most deals in the 0–30 day range', color: C.green },
        ]
      }
    }
    case 'revenue': {
      const totalWon = won.reduce((s, d) => s + (d.confirmed_revenue || d.value || 0), 0)
      return {
        meaning: `Revenue closed over the last 6 months. Bars represent confirmed revenue from won deals by month. Consistent monthly revenue suggests a healthy, predictable pipeline.`,
        badges: [{ text: `${fmt(totalWon)} total`, color: '#085041', bg: '#e8f5f1' }, { text: `${won.length} deals won`, color: '#085041', bg: '#e8f5f1' }],
        actions: [
          { text: 'Aim for consistent month-on-month growth — spiky revenue signals feast-famine cycles', color: C.amber },
          { text: 'Mark all won deals with confirmed revenue amounts for accurate reporting', color: C.green },
          { text: 'Compare to your pipeline value to sense-check your forecast accuracy', color: C.green },
        ]
      }
    }
    case 'forecast': {
      const weighted = active.reduce((s, d) => s + (d.value || 0) * (STAGE_PROB[d.stage] || 0), 0)
      return {
        meaning: `Weighted forecast applies probability to each stage — negotiation deals count for 80%, leads for just 10%. This gives a more realistic view of likely revenue than raw pipeline value.`,
        badges: [{ text: `${fmt(weighted)} weighted`, color: '#085041', bg: '#e8f5f1' }],
        actions: [
          { text: 'Push late-stage deals to close to convert weighted forecast into confirmed revenue', color: C.red },
          { text: 'A large gap between pipeline and weighted forecast means too many deals are stuck early', color: C.amber },
          { text: 'Compare weighted forecast to quota to understand if you\'re on track', color: C.green },
        ]
      }
    }
    case 'quota': {
      const pct = quota?.attainment_pct || 0
      return {
        meaning: `Quota attainment shows confirmed revenue vs your target for this period. ${pct >= 75 ? 'You\'re on track.' : pct >= 40 ? 'You\'re behind pace — focus on late-stage deals.' : 'You\'re significantly behind. Urgent action needed on high-value deals.'}`,
        badges: [{ text: `${pct.toFixed(0)}% attained`, color: pct >= 75 ? '#085041' : pct >= 40 ? '#633806' : '#791F1F', bg: pct >= 75 ? '#e8f5f1' : pct >= 40 ? '#fdf3e3' : '#fceaea' }],
        actions: [
          { text: 'Invoice all won deals immediately — uninvoiced revenue doesn\'t count toward quota', color: C.red },
          { text: 'Focus closing effort on highest-value negotiation deals first', color: C.amber },
          { text: 'Review pipeline to confirm enough deals exist to close the gap', color: C.green },
        ]
      }
    }
    case 'followup': {
      const todayStr = new Date().toISOString().split('T')[0]
      const overdueCount = contacts.filter(c => c.next_followup_date && c.next_followup_date < todayStr).length
      return {
        meaning: `Follow-up calendar shows contacts with scheduled follow-up dates in the next 14 days. Green dots are today's, red dots are overdue. Consistent follow-up is the single biggest driver of deal velocity.`,
        badges: [{ text: `${overdueCount} overdue`, color: overdueCount > 0 ? '#791F1F' : '#085041', bg: overdueCount > 0 ? '#fceaea' : '#e8f5f1' }],
        actions: [
          { text: `Complete ${overdueCount} overdue follow-ups today before adding new ones`, color: C.red },
          { text: 'Set a follow-up date every time you contact someone — never leave a conversation open-ended', color: C.amber },
          { text: 'Contacts without a follow-up date are relationship decay waiting to happen', color: C.green },
        ]
      }
    }
    case 'treemap': {
      return {
        meaning: `Pipeline value by company shows where your revenue concentration risk lies. Heavy reliance on one or two companies makes your pipeline fragile — diversification is healthier.`,
        badges: [],
        actions: [
          { text: 'If one company represents >30% of pipeline, that\'s a concentration risk worth addressing', color: C.amber },
          { text: 'Use this view to identify which companies need more deal activity', color: C.green },
          { text: 'Companies with no active pipeline may be ripe for re-engagement', color: C.green },
        ]
      }
    }
    case 'velocity': {
      const slowest = [...stageVelocity].sort((a, b) => b.avg_days - a.avg_days)[0]
      return {
        meaning: `Stage velocity shows how many days deals typically spend in each stage. Longer times indicate friction — either the stage is hard to exit, or deals are being neglected there.`,
        badges: slowest ? [{ text: `${slowest.stage} is slowest at ${slowest.avg_days}d`, color: '#633806', bg: '#fdf3e3' }] : [],
        actions: [
          { text: slowest ? `Investigate why deals linger in ${slowest.stage} — is there a clear exit criteria?` : 'Log more stage transitions to see velocity data', color: C.red },
          { text: 'Set stage-exit criteria (e.g. "proposal sent") to prevent deals from stalling', color: C.amber },
          { text: 'Compare velocity to your expected sales cycle length', color: C.green },
        ]
      }
    }
    case 'atrisk': {
      const atRiskCount = active.filter(d => daysSince(d.last_activity_at) >= atRiskDays).length
      return {
        meaning: `At-risk deals have had no activity for ${atRiskDays}+ days. Silence in a deal is rarely neutral — it usually means momentum has stalled and the deal is drifting toward lost.`,
        badges: [{ text: `${atRiskCount} at risk`, color: atRiskCount > 0 ? '#791F1F' : '#085041', bg: atRiskCount > 0 ? '#fceaea' : '#e8f5f1' }],
        actions: [
          { text: 'Contact at-risk deals today with a direct, low-friction check-in', color: C.red },
          { text: 'If a deal hasn\'t moved in 30 days, consider marking it lost to clean your pipeline', color: C.amber },
          { text: 'Set follow-up tasks immediately after every deal interaction', color: C.green },
        ]
      }
    }
    case 'uninvoiced': {
      const uninvoiced = deals.filter(d => d.stage === 'closed_won' && (!d.payment_status || d.payment_status === 'none'))
      const total = uninvoiced.reduce((s, d) => s + (d.confirmed_revenue || d.value || 0), 0)
      return {
        meaning: `These are won deals that haven't been invoiced yet. This is real revenue sitting uncollected. Every day of delay increases the risk of payment disputes or deals being questioned.`,
        badges: [{ text: `${fmt(total)} uninvoiced`, color: '#791F1F', bg: '#fceaea' }, { text: `${uninvoiced.length} deals`, color: '#791F1F', bg: '#fceaea' }],
        actions: [
          { text: 'Invoice all won deals within 24 hours of closing — set this as a rule', color: C.red },
          { text: 'Add invoice reference numbers to deals to track payment status accurately', color: C.amber },
          { text: 'Uninvoiced won revenue doesn\'t count toward confirmed revenue or quota', color: C.green },
        ]
      }
    }
    case 'loss': {
      return {
        meaning: `Loss reasons reveal patterns in why deals don't close. Without this data you're flying blind — every lost deal is an opportunity to improve your process, pricing, or messaging.`,
        badges: [{ text: `${lost.length} deals lost`, color: lost.length > 5 ? '#791F1F' : '#633806', bg: lost.length > 5 ? '#fceaea' : '#fdf3e3' }],
        actions: [
          { text: 'Always record a loss reason — even "unknown" is better than nothing', color: C.red },
          { text: 'The most common loss reason is usually the highest-leverage thing to fix', color: C.amber },
          { text: 'Share loss patterns with the whole team quarterly to improve collectively', color: C.green },
        ]
      }
    }
    case 'team': {
      const totalAtRisk = repPerformance ? repPerformance.reduce((s, r) => s + r.at_risk_count, 0) : 0
      const belowQuota = repPerformance ? repPerformance.filter(r => r.quota && (r.attainment_pct || 0) < 40).length : 0
      return {
        meaning: `Team performance tracks each rep's quota attainment, pipeline value, and at-risk deals. Use this to spot who needs support and who is on track. Attainment below 40% needs immediate attention — either coaching, deal help, or quota recalibration.`,
        badges: [
          ...(belowQuota > 0 ? [{ text: `${belowQuota} rep${belowQuota > 1 ? 's' : ''} below 40% quota`, color: '#791F1F', bg: '#fceaea' }] : []),
          ...(totalAtRisk > 0 ? [{ text: `${totalAtRisk} at-risk deals across team`, color: '#633806', bg: '#fdf3e3' }] : []),
        ],
        actions: [
          { text: 'Meet with any rep below 40% attainment this week — early intervention prevents end-of-quarter scrambles', color: C.red },
          { text: `Review the ${totalAtRisk} at-risk deals across the team — assign owners and set follow-up tasks`, color: C.amber },
          { text: 'Reps with high pipeline but low confirmed revenue likely need help closing, not prospecting', color: C.green },
        ]
      }
    }
    default: return { meaning: '', badges: [], actions: [] }
  }
}

// ─── View title/subtitle map ──────────────────────────────────────────────────
const VIEW_META: Record<string, { title: string; subtitle: string }> = {
  funnel: { title: 'Pipeline funnel', subtitle: 'Deal value currently sitting in each stage' },
  winloss: { title: 'Win / loss', subtitle: 'All-time closed deal outcomes' },
  conversion: { title: 'Stage conversion', subtitle: '% of deals advancing to next stage' },
  agedist: { title: 'Deal age distribution', subtitle: 'How long active deals have been in pipeline' },
  revenue: { title: 'Revenue closed', subtitle: 'Confirmed revenue from won deals · last 6 months' },
  forecast: { title: 'Revenue forecast', subtitle: 'Weighted pipeline by stage probability' },
  quota: { title: 'Quota attainment', subtitle: 'Confirmed revenue vs target' },
  followup: { title: 'Follow-up calendar', subtitle: 'Contacts with scheduled follow-ups · next 14 days' },
  treemap: { title: 'Pipeline by company', subtitle: 'Active deal value per company' },
  velocity: { title: 'Stage velocity', subtitle: 'Average days deals spend in each stage' },
  atrisk: { title: 'At-risk deals', subtitle: 'Deals with no recent activity' },
  uninvoiced: { title: 'Not invoiced', subtitle: 'Won deals pending invoice' },
  loss: { title: 'Loss reasons', subtitle: 'Why deals were lost' },
  team: { title: 'Team performance', subtitle: 'Rep quota attainment and pipeline' },
}

// ─── Quickstart banner ────────────────────────────────────────────────────────
function QuickstartBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}
      style={{ background: C.card, border: `0.5px solid ${C.border}`, borderRadius: 18, padding: '18px 20px', marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.dark, marginBottom: 2 }}>Your analytics playbook</div>
          <div style={{ fontSize: 11, color: C.faint }}>Three habits that make these charts useful — not just pretty.</div>
        </div>
        <button onClick={onDismiss} style={{ fontSize: 10, color: C.faint, background: 'none', border: 'none', cursor: 'pointer', padding: 4, fontFamily: 'inherit' }}>Dismiss ×</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
        {[
          { n: 1, title: 'Log every deal, even small ones', body: 'Pipeline value is only accurate if all deals are in. Missing deals skew your funnel and make forecasts unreliable. Use Capture to add fast.' },
          { n: 2, title: 'Move stages in real time', body: 'Stage velocity and conversion only work if you update stages as they happen — not weekly. A stale stage is worse than no stage.' },
          { n: 3, title: 'Set follow-up dates on every contact', body: 'The follow-up calendar is your early warning system. Without dates, relationship decay goes unnoticed until deals go cold.' },
        ].map(s => (
          <div key={s.n} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div style={{ width: 20, height: 20, borderRadius: '50%', background: C.dark, color: 'white', fontSize: 9, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{s.n}</div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.dark, marginBottom: 3 }}>{s.title}</div>
              <div style={{ fontSize: 11, color: C.faint, lineHeight: 1.5 }}>{s.body}</div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

// ─── Left nav ─────────────────────────────────────────────────────────────────
function LeftNav({ activeId, onSelect }: { activeId: string; onSelect: (id: string) => void }) {
  const groups = Array.from(new Set(NAV_ITEMS.map(n => n.group)))
  const groupIcons: Record<string, React.ReactNode> = {
    Pipeline: <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="1" y="2" width="10" height="8" rx="1.5" stroke="currentColor" strokeWidth="1"/><path d="M1 5h10" stroke="currentColor" strokeWidth="1"/></svg>,
    Revenue: <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 9l3-3 2 2 3-4 2 1.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/></svg>,
    Activity: <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1"/><path d="M6 3.5v2.5l2 1" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/></svg>,
    Problems: <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 2L1 10h10L6 2z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"/><path d="M6 6v2M6 8.5v.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/></svg>,
  }
  return (
    <div style={{ width: 152, flexShrink: 0 }}>
      {groups.map(group => (
        <div key={group}>
          <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.faint, padding: '10px 8px 4px', display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ color: C.faint }}>{groupIcons[group]}</span>
            {group}
          </div>
          {NAV_ITEMS.filter(n => n.group === group).map(item => (
            <button key={item.id} onClick={() => onSelect(item.id)}
              style={{ display: 'flex', alignItems: 'center', width: '100%', textAlign: 'left', padding: '6px 10px', borderRadius: 8, fontSize: 11, fontFamily: 'inherit', cursor: 'pointer', border: 'none', marginBottom: 1, background: activeId === item.id ? C.dark : 'transparent', color: activeId === item.id ? 'white' : C.muted, fontWeight: activeId === item.id ? 500 : 400, transition: 'background 0.12s, color 0.12s' }}>
              {item.label}
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function AnalyticsClient({ deals, contacts, companies, tasks, stageVelocity, quota, stageConversion, orgContext, isElevated, repPerformance }: Props) {
  const isDesktop = useIsDesktop()
  const stageLabels = buildStageLabelMap(orgContext.stage_template)
  const atRiskDays = orgContext.at_risk_days || 14

  const active = deals.filter(d => !['closed_won', 'closed_lost'].includes(d.stage))
  const won = deals.filter(d => d.stage === 'closed_won')
  const pipelineVal = active.reduce((s, d) => s + (d.value || 0), 0)
  const winRate = (won.length + deals.filter(d => d.stage === 'closed_lost').length) > 0
    ? Math.round(won.length / (won.length + deals.filter(d => d.stage === 'closed_lost').length) * 100) : 0
  const atRiskCount = active.filter(d => daysSince(d.last_activity_at) >= atRiskDays).length

  const [activeView, setActiveView] = useState('funnel')
  const [showQuickstart, setShowQuickstart] = useState(true)

  const meta = VIEW_META[activeView] || { title: activeView, subtitle: '' }
  const insight = getInsight(activeView, deals, contacts, stageConversion, stageVelocity, quota, atRiskDays, repPerformance)

  // Summary stats for header
  const headerStats = [
    { label: 'Pipeline', value: fmt(pipelineVal), sub: `${active.length} deals` },
    { label: 'Win rate', value: `${winRate}%`, sub: `${won.length}W · ${deals.filter(d => d.stage === 'closed_lost').length}L`, color: winRate >= 50 ? C.green : C.amber },
    { label: 'At risk', value: String(atRiskCount), sub: `${atRiskDays}d+ inactive`, color: atRiskCount > 0 ? C.red : C.green },
    { label: 'Follow-ups', value: String(contacts.filter(c => daysUntil(c.next_followup_date) !== null && daysUntil(c.next_followup_date)! <= 0).length), sub: 'due today', color: C.amber },
  ]

  function renderChart() {
    switch (activeView) {
      case 'funnel': return <FunnelChart deals={deals} stageLabels={stageLabels} />
      case 'winloss': return <WinLossDonut deals={deals} />
      case 'conversion': return <ConversionChart stageConversion={stageConversion} stageLabels={stageLabels} />
      case 'agedist': return <DealAgeDistribution deals={deals} />
      case 'revenue': return <RevenueBarChart deals={deals} />
      case 'forecast': return <ForecastChart deals={deals} quota={quota} stageLabels={stageLabels} />
      case 'quota': return quota?.quota ? <QuotaProgress quota={quota} /> : <div style={{ fontSize: 12, color: C.faint }}>No quota set — configure in Settings</div>
      case 'followup': return <FollowupCalendar contacts={contacts} />
      case 'treemap': return <CompanyPipeline deals={deals} companies={companies} />
      case 'velocity': return <VelocityChart stageVelocity={stageVelocity} stageLabels={stageLabels} />
      case 'atrisk': return <AtRiskTable deals={deals} stageLabels={stageLabels} atRiskDays={atRiskDays} />
      case 'uninvoiced': return <UninvoicedTable deals={deals} />
      case 'loss': return <LossReasons deals={deals} />
      case 'team': return isElevated && repPerformance?.length ? <RepPerformanceTable repPerformance={repPerformance} /> : <div style={{ fontSize: 12, color: '#9b9890' }}>Team data not available</div>
      default: return null
    }
  }

  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div style={{ paddingTop: 8, paddingBottom: 40 }}>

      {/* ── Header ── */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 500, color: C.dark, margin: 0, marginBottom: 2 }}>Analytics</h1>
        <div style={{ fontSize: 12, color: C.faint }}>{today}{orgContext.industry ? ` · ${orgContext.industry}` : ''}</div>
      </motion.div>

      {/* ── Summary strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
        {headerStats.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06, duration: 0.3 }}
            style={{ background: C.card, border: `0.5px solid ${C.border}`, borderRadius: 14, padding: '12px 14px' }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: C.faint, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: s.color || C.dark, letterSpacing: '-0.02em', lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 10, color: C.faint, marginTop: 3 }}>{s.sub}</div>
          </motion.div>
        ))}
      </div>

      {/* ── Quickstart ── */}
      <AnimatePresence>
        {showQuickstart && <QuickstartBanner onDismiss={() => setShowQuickstart(false)} />}
      </AnimatePresence>

      {/* ── Main layout: left nav + content ── */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>

        {isDesktop && <LeftNav activeId={activeView} onSelect={setActiveView} />}

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* Mobile nav */}
          {!isDesktop && (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 4 }}>
              {NAV_ITEMS.map(item => (
                <button key={item.id} onClick={() => setActiveView(item.id)}
                  style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, cursor: 'pointer', border: `0.5px solid ${activeView === item.id ? C.dark : 'rgba(0,0,0,0.09)'}`, background: activeView === item.id ? C.dark : C.card, color: activeView === item.id ? 'white' : C.muted, fontFamily: 'inherit', transition: 'all 0.15s' }}>
                  {item.label}
                </button>
              ))}
            </div>
          )}

          {/* Chart card */}
          <AnimatePresence mode="wait">
            <motion.div key={activeView} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }}
              style={{ background: C.card, border: `0.5px solid ${C.border}`, borderRadius: 18, overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px 12px', borderBottom: `0.5px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.dark }}>{meta.title}</div>
                  <div style={{ fontSize: 11, color: C.faint, marginTop: 2 }}>{meta.subtitle}</div>
                </div>
              </div>
              <div style={{ padding: '16px 18px' }}>
                {renderChart()}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* What this means */}
          {insight.meaning && (
            <AnimatePresence mode="wait">
              <motion.div key={`meaning-${activeView}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, delay: 0.05 }}
                style={{ background: C.card, border: `0.5px solid ${C.border}`, borderRadius: 18, padding: '14px 18px' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.dark, marginBottom: 8 }}>What this means</div>
                <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.7, marginBottom: insight.badges.length > 0 ? 10 : 0 }}>{insight.meaning}</div>
                {insight.badges.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {insight.badges.map((b, i) => (
                      <span key={i} style={{ fontSize: 10, padding: '3px 9px', borderRadius: 10, background: b.bg, color: b.color }}>{b.text}</span>
                    ))}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          )}

          {/* Suggested actions */}
          {insight.actions.length > 0 && (
            <AnimatePresence mode="wait">
              <motion.div key={`actions-${activeView}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, delay: 0.1 }}
                style={{ background: C.card, border: `0.5px solid ${C.border}`, borderRadius: 18, padding: '14px 18px' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.dark, marginBottom: 10 }}>Suggested actions</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {insight.actions.map((a, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: a.color, marginTop: 4, flexShrink: 0 }} />
                      <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.6 }}>{a.text}</div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>
          )}



        </div>
      </div>

      <style>{`button { font-family: inherit; }`}</style>
    </div>
  )
}