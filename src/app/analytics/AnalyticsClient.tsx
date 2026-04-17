'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'

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

type Props = {
  deals: Deal[]; contacts: Contact[]; companies: Company[]
  tasks: Task[]; stageVelocity: StageVelocity[]
  quota: Quota | null; stageConversion: StageConversion[]
}

type Category = 'all' | 'deals' | 'contacts' | 'companies'
type Focus = 'all' | 'dynamic' | 'history' | 'performance' | 'potential' | 'problems'

// ─── Constants ────────────────────────────────────────────────────────────────
const STAGES = ['lead','qualified','demo','proposal','negotiation','closed_won','closed_lost']
const STAGE_LABELS: Record<string,string> = {
  lead:'Lead', qualified:'Qualified', demo:'Demo', proposal:'Proposal',
  negotiation:'Negotiation', closed_won:'Won', closed_lost:'Lost'
}
const STAGE_PROB: Record<string,number> = { lead:.10, qualified:.25, demo:.40, proposal:.60, negotiation:.80 }
const STAGE_COLOR: Record<string,string> = {
  lead:'#9b9890', qualified:'#6b6960', demo:'#3d7de4', proposal:'#EF9F27',
  negotiation:'#E24B4A', closed_won:'#1D9E75', closed_lost:'#d0cec9'
}
const C = {
  bg: '#f5f4f0', dark: '#1a1a18', muted: '#6b6960', faint: '#9b9890',
  border: 'rgba(0,0,0,0.07)', red: '#E24B4A', amber: '#EF9F27', green: '#1D9E75',
  card: 'white'
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (v?: number) => {
  if (!v) return '—'
  if (v >= 1000000) return `€${(v/1000000).toFixed(1)}m`
  if (v >= 1000) return `€${(v/1000).toFixed(0)}k`
  return `€${v}`
}
const daysSince = (d?: string) => d ? Math.floor((Date.now()-new Date(d).getTime())/86400000) : 999
const daysUntil = (d?: string) => d ? Math.ceil((new Date(d).getTime()-Date.now())/86400000) : null
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

// ─── Card wrapper ─────────────────────────────────────────────────────────────
function Card({ title, subtitle, children, span = 1, tags = [] }: {
  title: string; subtitle?: string; children: React.ReactNode
  span?: 1|2|3; tags?: string[]
}) {
  return (
    <div style={{
      background: C.card, border: `0.5px solid ${C.border}`, borderRadius: 18,
      overflow: 'hidden', gridColumn: `span ${span}`,
    }}>
      <div style={{
        padding: '14px 18px 12px', borderBottom: `0.5px solid ${C.border}`,
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: C.dark, letterSpacing: '-0.01em' }}>{title}</span>
          {subtitle && <span style={{ fontSize: 11, color: C.faint }}>{subtitle}</span>}
        </div>
        {tags.length > 0 && (
          <div style={{ display: 'flex', gap: 4 }}>
            {tags.map(t => (
              <span key={t} style={{ fontSize: 10, color: C.faint, background: C.bg, borderRadius: 5, padding: '1px 6px' }}>{t}</span>
            ))}
          </div>
        )}
      </div>
      <div style={{ padding: '16px 18px' }}>{children}</div>
    </div>
  )
}

// ─── Stat strip ───────────────────────────────────────────────────────────────
function StatStrip({ stats }: { stats: { label: string; value: string; sub?: string; color?: string }[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${stats.length}, 1fr)`, gap: 0 }}>
      {stats.map((s, i) => (
        <div key={i} style={{
          padding: '18px 20px',
          borderRight: i < stats.length - 1 ? `0.5px solid ${C.border}` : 'none',
        }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: C.faint, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{s.label}</div>
          <div style={{ fontSize: 28, fontWeight: 500, color: s.color || C.dark, letterSpacing: '-0.03em', lineHeight: 1 }}>{s.value}</div>
          {s.sub && <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{s.sub}</div>}
        </div>
      ))}
    </div>
  )
}

// ─── CHART: Pipeline Funnel ───────────────────────────────────────────────────
function FunnelChart({ deals, stageConversion }: { deals: Deal[]; stageConversion: StageConversion[] }) {
  const activeStages = ['lead','qualified','demo','proposal','negotiation']
  const counts = activeStages.map(s => ({
    stage: s,
    count: deals.filter(d => d.stage === s).length,
    value: deals.filter(d => d.stage === s).reduce((a,d) => a + (d.value||0), 0),
    conversion: stageConversion.find(sc => sc.stage === s)?.advance_rate_pct ?? null,
  }))
  const maxCount = Math.max(...counts.map(c => c.count), 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {counts.map((row, i) => {
        const barPct = (row.count / maxCount) * 100
        const dropPct = i < counts.length - 1 && row.conversion !== null
          ? `${Math.round(100 - row.conversion)}% drop` : null
        return (
          <div key={row.stage}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 3 }}>
              <div style={{ width: 72, fontSize: 11, color: C.muted, flexShrink: 0 }}>{STAGE_LABELS[row.stage]}</div>
              <div style={{ flex: 1, height: 20, background: C.bg, borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                <div style={{
                  width: `${barPct}%`, height: '100%',
                  background: STAGE_COLOR[row.stage],
                  borderRadius: 4,
                  transition: 'width 0.6s ease',
                  opacity: 0.85,
                }} />
                {row.count > 0 && (
                  <span style={{
                    position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)',
                    fontSize: 10, fontWeight: 600, color: barPct > 30 ? 'white' : C.muted
                  }}>{row.count}</span>
                )}
              </div>
              <div style={{ width: 48, fontSize: 11, color: C.muted, textAlign: 'right', flexShrink: 0 }}>{fmt(row.value)}</div>
            </div>
            {dropPct && row.count > 0 && (
              <div style={{ paddingLeft: 82, fontSize: 10, color: C.red, marginBottom: 4 }}>↓ {dropPct}</div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── CHART: Win/Loss Donut ────────────────────────────────────────────────────
function WinLossDonut({ deals }: { deals: Deal[] }) {
  const won = deals.filter(d => d.stage === 'closed_won').length
  const lost = deals.filter(d => d.stage === 'closed_lost').length
  const total = won + lost
  const winRate = total > 0 ? Math.round((won / total) * 100) : 0
  const r = 38; const cx = 50; const cy = 50; const stroke = 10
  const circumference = 2 * Math.PI * r
  const wonArc = total > 0 ? (won / total) * circumference : 0
  const lostArc = total > 0 ? (lost / total) * circumference : 0

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
      <svg width={100} height={100} viewBox="0 0 100 100">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.bg} strokeWidth={stroke} />
        {total === 0 ? (
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.border} strokeWidth={stroke}
            strokeDasharray={`${circumference}`} />
        ) : (<>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.green} strokeWidth={stroke}
            strokeDasharray={`${wonArc} ${circumference}`}
            strokeLinecap="round"
            transform={`rotate(-90 ${cx} ${cy})`} />
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.red} strokeWidth={stroke}
            strokeDasharray={`${lostArc} ${circumference - lostArc}`}
            strokeDashoffset={-wonArc}
            strokeLinecap="round"
            transform={`rotate(-90 ${cx} ${cy})`} />
        </>)}
        <text x={cx} y={cy-4} textAnchor="middle" fontSize={14} fontWeight={600} fill={C.dark}>{winRate}%</text>
        <text x={cx} y={cy+10} textAnchor="middle" fontSize={8} fill={C.faint}>win rate</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <div style={{ fontSize: 10, color: C.faint, marginBottom: 2 }}>WON</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: C.green }} />
            <span style={{ fontSize: 20, fontWeight: 600, color: C.dark, letterSpacing: '-0.02em' }}>{won}</span>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: C.faint, marginBottom: 2 }}>LOST</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: C.red }} />
            <span style={{ fontSize: 20, fontWeight: 600, color: C.dark, letterSpacing: '-0.02em' }}>{lost}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── CHART: Revenue Bars (monthly) ───────────────────────────────────────────
function RevenueBarChart({ deals }: { deals: Deal[] }) {
  const months: { label: string; value: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(); d.setMonth(d.getMonth() - i)
    const label = d.toLocaleString('default', { month: 'short' })
    const y = d.getFullYear(); const m = d.getMonth()
    const value = deals
      .filter(d => d.stage === 'closed_won' && d.closed_at)
      .filter(d => { const cd = new Date(d.closed_at!); return cd.getFullYear() === y && cd.getMonth() === m })
      .reduce((s, d) => s + (d.confirmed_revenue || d.value || 0), 0)
    months.push({ label, value })
  }
  const maxVal = Math.max(...months.map(m => m.value), 1)
  const chartH = 80

  return (
    <div>
      <svg width="100%" height={chartH + 24} viewBox={`0 0 ${months.length * 44} ${chartH + 24}`} preserveAspectRatio="none">
        {months.map((m, i) => {
          const barH = maxVal > 0 ? (m.value / maxVal) * chartH : 2
          const x = i * 44 + 4; const w = 36
          return (
            <g key={i}>
              <rect x={x} y={chartH - barH} width={w} height={barH}
                fill={m.value > 0 ? C.dark : C.bg} rx={4} />
              {m.value > 0 && (
                <text x={x + w/2} y={chartH - barH - 4} textAnchor="middle" fontSize={8} fill={C.muted}>
                  {fmt(m.value)}
                </text>
              )}
              <text x={x + w/2} y={chartH + 16} textAnchor="middle" fontSize={9} fill={C.faint}>{m.label}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ─── CHART: Stage Velocity Heatmap ───────────────────────────────────────────
function VelocityHeatmap({ stageVelocity }: { stageVelocity: StageVelocity[] }) {
  const stages = ['lead','qualified','demo','proposal','negotiation']
  const maxDays = Math.max(...stageVelocity.map(s => s.avg_days), 1)

  if (stageVelocity.length === 0) {
    return <div style={{ fontSize: 12, color: C.faint, padding: '12px 0' }}>Populates as deals move through stages</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {stages.map(stage => {
        const row = stageVelocity.find(s => s.stage === stage)
        if (!row) return null
        const intensity = row.avg_days / maxDays
        const bg = `rgba(26,26,24,${0.06 + intensity * 0.7})`
        const textColor = intensity > 0.5 ? 'white' : C.dark
        return (
          <div key={stage} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 80, fontSize: 11, color: C.muted }}>{STAGE_LABELS[stage]}</div>
            <div style={{
              flex: 1, height: 28, background: bg, borderRadius: 6,
              display: 'flex', alignItems: 'center', paddingLeft: 10, gap: 8,
              transition: 'background 0.3s',
            }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: textColor }}>{row.avg_days}d</span>
              <span style={{ fontSize: 10, color: intensity > 0.5 ? 'rgba(255,255,255,0.6)' : C.faint }}>avg · {row.transitions} transitions</span>
            </div>
            {intensity > 0.6 && (
              <span style={{ fontSize: 10, color: C.amber }}>bottleneck</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── CHART: Deal Age Scatter ──────────────────────────────────────────────────
function DealAgeScatter({ deals }: { deals: Deal[] }) {
  const active = deals.filter(d => !['closed_won','closed_lost'].includes(d.stage) && d.value)
  if (active.length === 0) return <div style={{ fontSize: 12, color: C.faint }}>No active deals</div>

  const W = 300; const H = 120
  const maxAge = Math.max(...active.map(d => daysSince(d.created_at)), 1)
  const maxVal = Math.max(...active.map(d => d.value || 0), 1)

  return (
    <div style={{ position: 'relative' }}>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        {/* Axes */}
        <line x1={24} y1={H-16} x2={W-4} y2={H-16} stroke={C.border} strokeWidth={1} />
        <line x1={24} y1={4} x2={24} y2={H-16} stroke={C.border} strokeWidth={1} />
        {/* Axis labels */}
        <text x={W/2} y={H-2} textAnchor="middle" fontSize={8} fill={C.faint}>Age (days)</text>
        <text x={8} y={H/2} textAnchor="middle" fontSize={8} fill={C.faint} transform={`rotate(-90 8 ${H/2})`}>Value</text>
        {/* Points */}
        {active.map(d => {
          const x = 24 + ((daysSince(d.created_at) / maxAge) * (W - 32))
          const y = (H - 20) - ((d.value! / maxVal) * (H - 28))
          const atRisk = daysSince(d.last_activity_at) > 14
          const color = atRisk ? C.red : STAGE_COLOR[d.stage] || C.dark
          return (
            <g key={d.id}>
              <circle cx={x} cy={y} r={5} fill={color} opacity={0.75} />
              <circle cx={x} cy={y} r={5} fill="none" stroke={color} strokeWidth={1} opacity={0.4} />
            </g>
          )
        })}
      </svg>
      <div style={{ display: 'flex', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
        {['lead','qualified','demo','proposal','negotiation'].filter(s => active.some(d => d.stage === s)).map(s => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: STAGE_COLOR[s] }} />
            <span style={{ fontSize: 10, color: C.faint }}>{STAGE_LABELS[s]}</span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.red }} />
          <span style={{ fontSize: 10, color: C.faint }}>At risk</span>
        </div>
      </div>
    </div>
  )
}

// ─── CHART: Weighted Revenue Waterfall ───────────────────────────────────────
function RevenueWaterfall({ deals, quota }: { deals: Deal[]; quota: Quota | null }) {
  const confirmed = quota?.confirmed_revenue || 0
  const stages = ['lead','qualified','demo','proposal','negotiation']
  const bars = stages.map(s => ({
    label: STAGE_LABELS[s],
    value: deals.filter(d => d.stage === s).reduce((a, d) => a + (d.value||0) * (STAGE_PROB[s]||0), 0),
    raw: deals.filter(d => d.stage === s).reduce((a, d) => a + (d.value||0), 0),
    color: STAGE_COLOR[s],
  })).filter(b => b.value > 0)

  const total = confirmed + bars.reduce((s, b) => s + b.value, 0)
  const maxVal = Math.max(total, quota?.quota || 0, 1)
  const H = 90; const barW = 32; const gap = 12

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: gap, height: H + 32 }}>
        {/* Confirmed */}
        {confirmed > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ fontSize: 9, color: C.muted, fontWeight: 600 }}>{fmt(confirmed)}</div>
            <div style={{
              width: barW, background: C.green, borderRadius: '4px 4px 0 0',
              height: (confirmed / maxVal) * H,
            }} />
            <div style={{ fontSize: 9, color: C.faint, maxWidth: barW+8, textAlign: 'center' }}>Confirmed</div>
          </div>
        )}
        {/* Weighted by stage */}
        {bars.map((b, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ fontSize: 9, color: C.muted, fontWeight: 600 }}>{fmt(b.value)}</div>
            <div style={{
              width: barW, background: b.color, borderRadius: '4px 4px 0 0', opacity: 0.7,
              height: (b.value / maxVal) * H,
            }} />
            <div style={{ fontSize: 9, color: C.faint, maxWidth: barW+8, textAlign: 'center' }}>{b.label}</div>
          </div>
        ))}
        {/* Quota line marker */}
        {quota?.quota && (
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ fontSize: 9, color: C.amber, fontWeight: 600 }}>{fmt(quota.quota)}</div>
            <div style={{ width: barW, height: (quota.quota / maxVal) * H, background: 'transparent', borderTop: `2px dashed ${C.amber}`, position: 'relative' }}>
            </div>
            <div style={{ fontSize: 9, color: C.amber, maxWidth: barW+8, textAlign: 'center' }}>Quota</div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── CHART: Conversion Waterfall ─────────────────────────────────────────────
function ConversionWaterfall({ stageConversion }: { stageConversion: StageConversion[] }) {
  const stages = ['lead','qualified','demo','proposal','negotiation']
  if (stageConversion.length === 0) {
    return <div style={{ fontSize: 12, color: C.faint }}>Populates as deals progress</div>
  }

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2 }}>
      {stages.map((stage, i) => {
        const row = stageConversion.find(s => s.stage === stage)
        const rate = row ? Math.round((row.deals_advanced / Math.max(row.deals_entered,1)) * 100) : 0
        const color = rate >= 60 ? C.green : rate >= 35 ? C.amber : C.red
        const H = 80
        return (
          <div key={stage} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ fontSize: 9, fontWeight: 600, color }}>{rate}%</div>
            <div style={{ width: '80%', background: C.bg, borderRadius: 4, height: H, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', overflow: 'hidden' }}>
              <div style={{ width: '100%', background: color, opacity: 0.8, height: `${rate}%`, borderRadius: 4, transition: 'height 0.5s ease' }} />
            </div>
            <div style={{ fontSize: 9, color: C.faint, textAlign: 'center' }}>{STAGE_LABELS[stage].slice(0,4)}</div>
            {row && row.deals_lost_here > 0 && (
              <div style={{ fontSize: 8, color: C.red }}>−{row.deals_lost_here}</div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── CHART: Company Treemap ───────────────────────────────────────────────────
function CompanyTreemap({ deals, companies }: { deals: Deal[]; companies: Company[] }) {
  const active = deals.filter(d => !['closed_won','closed_lost'].includes(d.stage))
  const companyValues = companies
    .map(c => {
      const val = active.filter(d => (d as any).company_id === c.id).reduce((s, d) => s + (d.value||0), 0)
      return { name: c.name, value: val }
    })
    .filter(c => c.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)

  if (companyValues.length === 0) return <div style={{ fontSize: 12, color: C.faint }}>No company pipeline data</div>

  const total = companyValues.reduce((s, c) => s + c.value, 0)

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {companyValues.map((c, i) => {
        const pctW = (c.value / total) * 100
        const minW = 15
        const w = Math.max(minW, pctW)
        const opacity = 0.2 + (c.value / companyValues[0].value) * 0.8
        return (
          <div key={i} style={{
            background: `rgba(26,26,24,${opacity})`,
            borderRadius: 8,
            padding: '8px 10px',
            minWidth: `${minW}%`,
            flexGrow: pctW,
            cursor: 'default',
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: opacity > 0.5 ? 'white' : C.dark, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
            <div style={{ fontSize: 10, color: opacity > 0.5 ? 'rgba(255,255,255,0.7)' : C.muted }}>{fmt(c.value)}</div>
          </div>
        )
      })}
    </div>
  )
}

// ─── CHART: Follow-up Calendar ────────────────────────────────────────────────
function FollowupCalendar({ contacts }: { contacts: Contact[] }) {
  const days: { label: string; date: string; count: number; names: string[] }[] = []
  for (let i = 0; i < 14; i++) {
    const d = new Date(); d.setDate(d.getDate() + i)
    const dateStr = d.toISOString().split('T')[0]
    const matching = contacts.filter(c => c.next_followup_date === dateStr)
    days.push({
      label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en', { weekday: 'short', day: 'numeric' }),
      date: dateStr,
      count: matching.length,
      names: matching.map(c => c.full_name).slice(0, 3),
    })
  }
  const maxCount = Math.max(...days.map(d => d.count), 1)

  return (
    <div style={{ display: 'flex', gap: 4, overflowX: 'auto' }} className="no-scrollbar">
      {days.map((day, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0, minWidth: 44 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: day.count > 0 ? `rgba(26,26,24,${0.1 + (day.count / maxCount) * 0.85})` : C.bg,
            border: day.count > 0 ? 'none' : `0.5px solid ${C.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 600,
            color: day.count > 0 ? (day.count / maxCount > 0.5 ? 'white' : C.dark) : C.faint,
          }}>
            {day.count > 0 ? day.count : '·'}
          </div>
          <div style={{ fontSize: 9, color: C.faint, textAlign: 'center', maxWidth: 40 }}>{day.label}</div>
        </div>
      ))}
    </div>
  )
}

// ─── CHART: Task Gauge ────────────────────────────────────────────────────────
function TaskGauge({ tasks }: { tasks: Task[] }) {
  const total = tasks.length
  const done = tasks.filter(t => t.done || t.status === 'done').length
  const overdue = tasks.filter(t => !t.done && t.due_date && daysUntil(t.due_date)! < 0).length
  const rate = total > 0 ? Math.round((done / total) * 100) : 0
  const r = 32; const cx = 40; const cy = 42; const stroke = 8
  const arc = Math.PI * r // half circle
  const filled = (rate / 100) * arc

  // half-circle arc
  const startX = cx - r; const startY = cy
  const endX = cx + r; const endY = cy

  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
      <svg width={80} height={50}>
        <path d={`M ${startX} ${startY} A ${r} ${r} 0 0 1 ${endX} ${endY}`}
          fill="none" stroke={C.bg} strokeWidth={stroke} strokeLinecap="round" />
        <path d={`M ${startX} ${startY} A ${r} ${r} 0 0 1 ${endX} ${endY}`}
          fill="none" stroke={rate >= 50 ? C.green : rate >= 25 ? C.amber : C.red}
          strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${filled} ${arc}`} />
        <text x={cx} y={cy-2} textAnchor="middle" fontSize={14} fontWeight={700} fill={C.dark}>{rate}%</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div>
          <div style={{ fontSize: 10, color: C.faint }}>COMPLETED</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: C.dark }}>{done} / {total}</div>
        </div>
        {overdue > 0 && (
          <div style={{ fontSize: 11, color: C.red }}>{overdue} overdue</div>
        )}
      </div>
    </div>
  )
}

// ─── CHART: Loss Reasons ──────────────────────────────────────────────────────
function LossReasons({ deals }: { deals: Deal[] }) {
  const lost = deals.filter(d => d.stage === 'closed_lost' && d.loss_reason)
  if (lost.length === 0) return <div style={{ fontSize: 12, color: C.faint }}>No lost deals recorded yet</div>

  const reasons = lost.reduce((acc: Record<string, number>, d) => {
    const r = d.loss_reason!; acc[r] = (acc[r]||0) + 1; return acc
  }, {})
  const sorted = Object.entries(reasons).sort((a,b) => b[1]-a[1])
  const max = sorted[0][1]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {sorted.map(([reason, count]) => (
        <div key={reason} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 130, fontSize: 11, color: C.muted, flexShrink: 0 }}>{reason}</div>
          <div style={{ flex: 1, height: 6, background: C.bg, borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: `${(count/max)*100}%`, height: '100%', background: C.red, opacity: 0.7, borderRadius: 3 }} />
          </div>
          <div style={{ width: 20, fontSize: 11, fontWeight: 600, color: C.dark, textAlign: 'right' }}>{count}</div>
        </div>
      ))}
    </div>
  )
}

// ─── CHART: Deal Age Distribution ────────────────────────────────────────────
function DealAgeDistribution({ deals }: { deals: Deal[] }) {
  const active = deals.filter(d => !['closed_won','closed_lost'].includes(d.stage))
  const buckets = [
    { label: '0–7d',  min: 0, max: 7 },
    { label: '8–14d', min: 8, max: 14 },
    { label: '15–30d',min: 15, max: 30 },
    { label: '31–60d',min: 31, max: 60 },
    { label: '60d+',  min: 61, max: 9999 },
  ].map(b => ({
    ...b,
    count: active.filter(d => { const age = daysSince(d.created_at); return age >= b.min && age <= b.max }).length,
    value: active.filter(d => { const age = daysSince(d.created_at); return age >= b.min && age <= b.max }).reduce((s,d) => s+(d.value||0), 0),
  }))
  const maxCount = Math.max(...buckets.map(b => b.count), 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {buckets.map(b => (
        <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 44, fontSize: 11, color: C.muted, flexShrink: 0 }}>{b.label}</div>
          <div style={{ flex: 1, height: 18, background: C.bg, borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
            <div style={{
              width: `${(b.count/maxCount)*100}%`, height: '100%',
              background: b.min >= 60 ? C.red : b.min >= 30 ? C.amber : C.green,
              opacity: 0.75, borderRadius: 4,
            }} />
            {b.count > 0 && (
              <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 10, fontWeight: 600, color: (b.count/maxCount) > 0.4 ? 'white' : C.muted }}>
                {b.count}
              </span>
            )}
          </div>
          <div style={{ width: 42, fontSize: 11, color: C.faint, textAlign: 'right' }}>{fmt(b.value)}</div>
        </div>
      ))}
    </div>
  )
}

// ─── TABLE: At-risk deals ─────────────────────────────────────────────────────
function AtRiskTable({ deals }: { deals: Deal[] }) {
  const atRisk = deals
    .filter(d => !['closed_won','closed_lost'].includes(d.stage) && daysSince(d.last_activity_at) >= 14)
    .sort((a,b) => daysSince(b.last_activity_at) - daysSince(a.last_activity_at))

  if (atRisk.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0' }}>
        <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#e8f5f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 5l2 2 4-4" stroke={C.green} strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>
        </div>
        <span style={{ fontSize: 12, color: C.muted }}>No at-risk deals right now</span>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {atRisk.map((d, i) => (
        <Link key={d.id} href={`/tracking/deals/${d.id}`} style={{ textDecoration: 'none' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0',
            borderBottom: i < atRisk.length - 1 ? `0.5px solid ${C.border}` : 'none',
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: C.dark }}>{d.name}</div>
              <div style={{ fontSize: 10, color: C.faint }}>{STAGE_LABELS[d.stage]}</div>
            </div>
            <div style={{ fontSize: 12, color: C.muted }}>{fmt(d.value)}</div>
            <div style={{
              fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 6,
              background: '#fdeaea', color: C.red
            }}>{daysSince(d.last_activity_at)}d</div>
          </div>
        </Link>
      ))}
    </div>
  )
}

// ─── TABLE: Closing soon ──────────────────────────────────────────────────────
function ClosingSoonTable({ deals }: { deals: Deal[] }) {
  const closing = deals
    .filter(d => !['closed_won','closed_lost'].includes(d.stage) && d.expected_close_date)
    .map(d => ({ ...d, daysLeft: daysUntil(d.expected_close_date)! }))
    .filter(d => d.daysLeft >= 0 && d.daysLeft <= 30)
    .sort((a,b) => a.daysLeft - b.daysLeft)

  if (closing.length === 0) {
    return <div style={{ fontSize: 12, color: C.faint, padding: '12px 0' }}>No deals with close dates in 30 days</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {closing.map((d, i) => (
        <Link key={d.id} href={`/tracking/deals/${d.id}`} style={{ textDecoration: 'none' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0',
            borderBottom: i < closing.length - 1 ? `0.5px solid ${C.border}` : 'none',
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: C.dark }}>{d.name}</div>
              <div style={{ fontSize: 10, color: C.faint }}>{STAGE_LABELS[d.stage]}</div>
            </div>
            <div style={{ fontSize: 12, color: C.muted }}>{fmt(d.value)}</div>
            <div style={{
              fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 6,
              background: d.daysLeft <= 7 ? '#e8f5f0' : C.bg,
              color: d.daysLeft <= 7 ? C.green : C.muted,
            }}>{d.daysLeft === 0 ? 'Today' : `${d.daysLeft}d`}</div>
          </div>
        </Link>
      ))}
    </div>
  )
}

// ─── TABLE: Uninvoiced ────────────────────────────────────────────────────────
function UninvoicedTable({ deals }: { deals: Deal[] }) {
  const uninvoiced = deals.filter(d => d.stage === 'closed_won' && (!d.payment_status || d.payment_status === 'none'))
  const total = uninvoiced.reduce((s,d) => s + (d.confirmed_revenue || d.value || 0), 0)

  if (uninvoiced.length === 0) {
    return <div style={{ fontSize: 12, color: C.faint, padding: '12px 0' }}>All won deals invoiced ✓</div>
  }

  return (
    <div>
      <div style={{ fontSize: 22, fontWeight: 600, color: C.red, letterSpacing: '-0.02em', marginBottom: 12 }}>{fmt(total)}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {uninvoiced.map((d, i) => (
          <Link key={d.id} href={`/tracking/deals/${d.id}`} style={{ textDecoration: 'none' }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0',
              borderBottom: i < uninvoiced.length - 1 ? `0.5px solid ${C.border}` : 'none',
            }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: C.dark }}>{d.name}</div>
              <div style={{ fontSize: 12, color: C.red, fontWeight: 500 }}>{fmt(d.confirmed_revenue || d.value)}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

// ─── Quota Progress Bar ───────────────────────────────────────────────────────
function QuotaProgress({ quota }: { quota: Quota }) {
  const pct = clamp(quota.attainment_pct || 0, 0, 100)
  const weightedTotal = (quota.pipeline_value || 0)
  const color = pct >= 75 ? C.green : pct >= 40 ? C.amber : C.red

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <span style={{ fontSize: 28, fontWeight: 600, color, letterSpacing: '-0.03em' }}>{pct.toFixed(1)}%</span>
        <span style={{ fontSize: 12, color: C.faint }}>{quota.quota_period} quota</span>
      </div>
      {/* Stacked bar: confirmed + weighted pipeline */}
      <div style={{ height: 8, background: C.bg, borderRadius: 4, overflow: 'hidden', marginBottom: 10, position: 'relative' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${pct}%`, background: color, borderRadius: 4, transition: 'width 0.6s ease' }} />
        {/* Quota line */}
        {quota.quota && (
          <div style={{ position: 'absolute', left: '100%', top: -2, width: 2, height: 12, background: C.amber, transform: 'translateX(-1px)' }} />
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 10, color: C.faint }}>CONFIRMED</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.dark }}>{fmt(quota.confirmed_revenue)}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: C.faint }}>GAP</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.red }}>{fmt(quota.gap_to_quota)}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: C.faint }}>QUOTA</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.dark }}>{fmt(quota.quota)}</div>
        </div>
      </div>
    </div>
  )
}

// ─── Filter pills ─────────────────────────────────────────────────────────────
const CATS: { key: Category; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'deals', label: 'Deals' },
  { key: 'contacts', label: 'Contacts' },
  { key: 'companies', label: 'Companies' },
]
const FOCI: { key: Focus; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'dynamic', label: 'Live' },
  { key: 'performance', label: 'Performance' },
  { key: 'potential', label: 'Forecast' },
  { key: 'history', label: 'History' },
  { key: 'problems', label: 'Problems' },
]

// ─── Card visibility map ──────────────────────────────────────────────────────
type CardDef = {
  id: string
  category: Category | Category[]
  focus: Focus | Focus[]
}
const CARD_MAP: CardDef[] = [
  { id: 'quota',        category: 'deals',    focus: ['performance','potential','all'] },
  { id: 'top-stats',    category: 'all',      focus: 'all' },
  { id: 'funnel',       category: 'deals',    focus: ['dynamic','performance','all'] },
  { id: 'win-loss',     category: 'deals',    focus: ['history','performance','all'] },
  { id: 'revenue-bars', category: 'deals',    focus: ['history','dynamic','all'] },
  { id: 'waterfall',    category: 'deals',    focus: ['potential','performance','all'] },
  { id: 'conversion',   category: 'deals',    focus: ['performance','all'] },
  { id: 'velocity',     category: 'deals',    focus: ['performance','all'] },
  { id: 'age-scatter',  category: 'deals',    focus: ['dynamic','all'] },
  { id: 'age-dist',     category: 'deals',    focus: ['dynamic','history','all'] },
  { id: 'at-risk',      category: 'deals',    focus: ['problems','dynamic','all'] },
  { id: 'closing-soon', category: 'deals',    focus: ['potential','dynamic','all'] },
  { id: 'uninvoiced',   category: 'deals',    focus: ['problems','all'] },
  { id: 'loss-reasons', category: 'deals',    focus: ['history','problems','all'] },
  { id: 'followup-cal', category: 'contacts', focus: ['dynamic','all'] },
  { id: 'tasks',        category: 'all',      focus: ['problems','dynamic','all'] },
  { id: 'treemap',      category: 'companies',focus: ['potential','all'] },
]

function isVisible(def: CardDef, cat: Category, focus: Focus) {
  const cats = Array.isArray(def.category) ? def.category : [def.category]
  const foci = Array.isArray(def.focus) ? def.focus : [def.focus]
  const catMatch = cat === 'all' || cats.includes('all') || cats.includes(cat)
  const focusMatch = focus === 'all' || foci.includes('all') || foci.includes(focus)
  return catMatch && focusMatch
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function AnalyticsClient({ deals, contacts, companies, tasks, stageVelocity, quota, stageConversion }: Props) {
  const [cat, setCat] = useState<Category>('all')
  const [focus, setFocus] = useState<Focus>('all')

  const vis = useMemo(() => {
    const set = new Set(CARD_MAP.filter(c => isVisible(c, cat, focus)).map(c => c.id))
    return set
  }, [cat, focus])

  const active = deals.filter(d => !['closed_won','closed_lost'].includes(d.stage))
  const won = deals.filter(d => d.stage === 'closed_won')
  const lost = deals.filter(d => d.stage === 'closed_lost')
  const pipelineVal = active.reduce((s,d) => s+(d.value||0), 0)
  const weighted = active.reduce((s,d) => s+(d.value||0)*(STAGE_PROB[d.stage]||0), 0)
  const winRate = (won.length + lost.length) > 0 ? Math.round(won.length / (won.length + lost.length) * 100) : 0
  const avgDeal = won.length > 0 ? won.reduce((s,d) => s+(d.confirmed_revenue||d.value||0), 0) / won.length : 0

  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div style={{ paddingTop: 8, paddingBottom: 40 }}>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 500, color: C.dark, margin: 0, marginBottom: 2 }}>Analytics</h1>
        <div style={{ fontSize: 12, color: C.faint }}>{today}</div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 5 }}>
          {CATS.map(c => (
            <button key={c.key} onClick={() => setCat(c.key)} style={{
              padding: '6px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
              border: `0.5px solid ${cat === c.key ? C.dark : 'rgba(0,0,0,0.1)'}`,
              background: cat === c.key ? C.dark : C.card,
              color: cat === c.key ? 'white' : C.muted,
              fontWeight: cat === c.key ? 500 : 400,
              fontFamily: 'inherit', transition: 'all 0.15s',
            }}>{c.label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {FOCI.map(f => (
            <button key={f.key} onClick={() => setFocus(f.key)} style={{
              padding: '5px 12px', borderRadius: 20, fontSize: 11, cursor: 'pointer',
              border: `0.5px solid ${focus === f.key ? C.dark : 'rgba(0,0,0,0.08)'}`,
              background: focus === f.key ? C.bg : C.card,
              color: focus === f.key ? C.dark : C.faint,
              fontWeight: focus === f.key ? 500 : 400,
              fontFamily: 'inherit', transition: 'all 0.15s',
            }}>{f.label}</button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

        {/* Quota progress — full width */}
        {vis.has('quota') && quota?.quota && (
          <div style={{ gridColumn: 'span 2' }}>
            <Card title="Quota attainment" subtitle={quota.quota_period} tags={['revenue']}>
              <QuotaProgress quota={quota} />
            </Card>
          </div>
        )}

        {/* Top stats strip — full width */}
        {vis.has('top-stats') && (
          <div style={{ gridColumn: 'span 2', background: C.card, border: `0.5px solid ${C.border}`, borderRadius: 18, overflow: 'hidden' }}>
            <StatStrip stats={[
              { label: 'Pipeline value', value: fmt(pipelineVal), sub: `${active.length} active deals` },
              { label: 'Weighted forecast', value: fmt(weighted), sub: 'probability-adjusted' },
              { label: 'Win rate', value: `${winRate}%`, sub: `${won.length} won · ${lost.length} lost`, color: winRate >= 50 ? C.green : C.amber },
              { label: 'Avg deal size', value: fmt(avgDeal), sub: 'closed won' },
              { label: 'Contacts', value: String(contacts.length), sub: `${contacts.filter(c => daysUntil(c.next_followup_date) !== null && daysUntil(c.next_followup_date)! <= 0).length} follow-ups due` },
            ]} />
          </div>
        )}

        {/* Pipeline funnel */}
        {vis.has('funnel') && (
          <Card title="Pipeline funnel" subtitle="active stages" tags={['deals']}>
            <FunnelChart deals={deals} stageConversion={stageConversion} />
          </Card>
        )}

        {/* Win/loss donut */}
        {vis.has('win-loss') && (
          <Card title="Win / loss" subtitle="all time" tags={['deals','history']}>
            <WinLossDonut deals={deals} />
          </Card>
        )}

        {/* Revenue bars */}
        {vis.has('revenue-bars') && (
          <Card title="Revenue closed" subtitle="last 6 months" tags={['deals','history']}>
            <RevenueBarChart deals={deals} />
          </Card>
        )}

        {/* Weighted waterfall */}
        {vis.has('waterfall') && (
          <Card title="Revenue forecast" subtitle="weighted by stage" tags={['forecast']}>
            <RevenueWaterfall deals={deals} quota={quota} />
          </Card>
        )}

        {/* Conversion rates */}
        {vis.has('conversion') && (
          <Card title="Stage conversion" subtitle="advance rate per stage" tags={['performance']}>
            <ConversionWaterfall stageConversion={stageConversion} />
          </Card>
        )}

        {/* Velocity heatmap */}
        {vis.has('velocity') && (
          <Card title="Stage velocity" subtitle="avg days spent" tags={['performance']}>
            <VelocityHeatmap stageVelocity={stageVelocity} />
          </Card>
        )}

        {/* Deal age scatter */}
        {vis.has('age-scatter') && (
          <Card title="Deal age vs value" subtitle="active pipeline" tags={['deals','live']} span={2}>
            <DealAgeScatter deals={deals} />
          </Card>
        )}

        {/* Age distribution */}
        {vis.has('age-dist') && (
          <Card title="Deal age distribution" subtitle="how old are active deals" tags={['deals']}>
            <DealAgeDistribution deals={deals} />
          </Card>
        )}

        {/* Loss reasons */}
        {vis.has('loss-reasons') && (
          <Card title="Loss reasons" subtitle="why deals were lost" tags={['history']}>
            <LossReasons deals={deals} />
          </Card>
        )}

        {/* At-risk */}
        {vis.has('at-risk') && (
          <Card title="At-risk deals" subtitle="no activity 14+ days" tags={['problems']}>
            <AtRiskTable deals={deals} />
          </Card>
        )}

        {/* Closing soon */}
        {vis.has('closing-soon') && (
          <Card title="Closing soon" subtitle="expected in 30 days" tags={['forecast']}>
            <ClosingSoonTable deals={deals} />
          </Card>
        )}

        {/* Uninvoiced */}
        {vis.has('uninvoiced') && (
          <Card title="Revenue not invoiced" subtitle="won deals pending" tags={['problems']}>
            <UninvoicedTable deals={deals} />
          </Card>
        )}

        {/* Follow-up calendar */}
        {vis.has('followup-cal') && (
          <Card title="Follow-up calendar" subtitle="next 14 days" tags={['contacts']} span={2}>
            <FollowupCalendar contacts={contacts} />
          </Card>
        )}

        {/* Tasks gauge */}
        {vis.has('tasks') && (
          <Card title="Task completion" subtitle="all tasks" tags={['tasks']}>
            <TaskGauge tasks={tasks} />
          </Card>
        )}

        {/* Company treemap */}
        {vis.has('treemap') && (
          <Card title="Pipeline by company" subtitle="active deal value" tags={['companies']} span={2}>
            <CompanyTreemap deals={deals} companies={companies} />
          </Card>
        )}

      </div>

      {vis.size === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: C.faint, fontSize: 13 }}>
          No charts match this combination. Try adjusting the filters.
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