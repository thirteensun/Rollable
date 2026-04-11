'use client'

import { useMemo } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Deal = {
  id: string
  name: string
  stage: string
  value?: number
  confirmed_revenue?: number
  created_at: string
  updated_at: string
  payment_status?: string
}

type Event = {
  id: string
  event_type: string
  created_at: string
}

type Task = {
  id: string
  status?: string
  created_at: string
  due_date?: string
}

type Props = {
  deals: Deal[]
  events: Event[]
  tasks: Task[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STAGES = ['lead','qualified','demo','proposal','negotiation','closed_won','closed_lost']
const STAGE_LABELS: Record<string, string> = {
  lead: 'Lead', qualified: 'Qualified', demo: 'Demo',
  proposal: 'Proposal', negotiation: 'Negotiation',
  closed_won: 'Won', closed_lost: 'Lost',
}

function fmt(v: number) {
  if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}m`
  if (v >= 1000) return `$${(v / 1000).toFixed(0)}k`
  return `$${v}`
}

function monthKey(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function last6Months() {
  const months = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    months.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleString('default', { month: 'short' }),
    })
  }
  return months
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricCard({ label, value, delta, deltaUp }: {
  label: string
  value: string
  delta?: string
  deltaUp?: boolean
}) {
  return (
    <div style={{
      background: 'white',
      border: '0.5px solid rgba(0,0,0,0.07)',
      borderRadius: 16,
      padding: '16px 18px',
    }}>
      <div style={{ fontSize: 11, color: '#9b9890', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 500, color: '#1a1a18', marginBottom: 4 }}>{value}</div>
      {delta && (
        <div style={{ fontSize: 11, color: deltaUp ? '#1D9E75' : '#E24B4A' }}>
          {deltaUp ? '↑' : '↓'} {delta}
        </div>
      )}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 500, color: '#1a1a18', marginBottom: 14 }}>
      {children}
    </div>
  )
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'white',
      border: '0.5px solid rgba(0,0,0,0.07)',
      borderRadius: 16,
      padding: '18px 20px',
      ...style,
    }}>
      {children}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AnalyticsClient({ deals, events, tasks }: Props) {
  const months = useMemo(() => last6Months(), [])

  // ── Core metrics ──────────────────────────────────────────────────────────
  const activeDeals = deals.filter(d => d.stage !== 'closed_won' && d.stage !== 'closed_lost')
  const wonDeals    = deals.filter(d => d.stage === 'closed_won')
  const lostDeals   = deals.filter(d => d.stage === 'closed_lost')

  const pipelineValue = activeDeals.reduce((s, d) => s + (d.value ?? 0), 0)
  const closedRevenue = wonDeals.reduce((s, d) => s + (d.confirmed_revenue ?? d.value ?? 0), 0)
  const winRate = deals.length > 0
    ? Math.round((wonDeals.length / (wonDeals.length + lostDeals.length || 1)) * 100)
    : 0
  const avgDealSize = wonDeals.length > 0
    ? Math.round(closedRevenue / wonDeals.length)
    : 0

  const uninvoiced = wonDeals.filter(d => !d.payment_status || d.payment_status === 'none')
  const uninvoicedValue = uninvoiced.reduce((s, d) => s + (d.confirmed_revenue ?? d.value ?? 0), 0)

  // ── Revenue by month (closed_won deals) ───────────────────────────────────
  const revenueByMonth = useMemo(() => {
    const map: Record<string, number> = {}
    wonDeals.forEach(d => {
      const k = monthKey(d.updated_at)
      map[k] = (map[k] ?? 0) + (d.confirmed_revenue ?? d.value ?? 0)
    })
    return months.map(m => ({ ...m, value: map[m.key] ?? 0 }))
  }, [wonDeals, months])

  const maxRevenue = Math.max(...revenueByMonth.map(m => m.value), 1)

  // ── Activity volume by month ───────────────────────────────────────────────
  const activityByMonth = useMemo(() => {
    const map: Record<string, number> = {}
    events.forEach(e => {
      const k = monthKey(e.created_at)
      map[k] = (map[k] ?? 0) + 1
    })
    return months.map(m => ({ ...m, count: map[m.key] ?? 0 }))
  }, [events, months])

  const maxActivity = Math.max(...activityByMonth.map(m => m.count), 1)

  // ── Funnel ────────────────────────────────────────────────────────────────
  const funnelStages = STAGES.filter(s => s !== 'closed_lost')
  const funnelCounts = funnelStages.map(s => ({
    stage: s,
    label: STAGE_LABELS[s],
    count: deals.filter(d => d.stage === s).length,
    value: deals.filter(d => d.stage === s).reduce((sum, d) => sum + (d.value ?? 0), 0),
  }))
  const maxFunnelCount = Math.max(...funnelCounts.map(f => f.count), 1)

  // ── Task completion ────────────────────────────────────────────────────────
  const doneTasks = tasks.filter(t => t.status === 'done' || t.status === 'completed')
  const taskRate = tasks.length > 0 ? Math.round((doneTasks.length / tasks.length) * 100) : 0

  // ── At-risk deals ─────────────────────────────────────────────────────────
  const atRisk = activeDeals.filter(d => {
    const days = Math.floor((Date.now() - new Date(d.updated_at).getTime()) / 86400000)
    return days >= 14
  }).sort((a, b) => {
    const da = Math.floor((Date.now() - new Date(a.updated_at).getTime()) / 86400000)
    const db = Math.floor((Date.now() - new Date(b.updated_at).getTime()) / 86400000)
    return db - da
  })

  return (
    <div style={{
      padding: '24px 24px 40px',
      maxWidth: 1100,
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column',
      gap: 20,
    }}>

      {/* Page title */}
      <div style={{ marginBottom: 4 }}>
        <h1 style={{ fontSize: 20, fontWeight: 500, color: '#1a1a18', marginBottom: 4 }}>Analytics</h1>
        <p style={{ fontSize: 13, color: '#9b9890' }} suppressHydrationWarning>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* ── Metric cards ──────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}
        className="metrics-grid">
        <MetricCard
          label="Pipeline value"
          value={fmt(pipelineValue)}
          delta={`${activeDeals.length} active deals`}
          deltaUp
        />
        <MetricCard
          label="Closed revenue"
          value={fmt(closedRevenue)}
          delta={`${wonDeals.length} deals won`}
          deltaUp={wonDeals.length > 0}
        />
        <MetricCard
          label="Win rate"
          value={`${winRate}%`}
          delta={`${lostDeals.length} lost`}
          deltaUp={winRate >= 40}
        />
        <MetricCard
          label="Avg deal size"
          value={avgDealSize > 0 ? fmt(avgDealSize) : '—'}
          delta="closed deals"
          deltaUp
        />
      </div>

      {/* ── Revenue + Activity charts ──────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}
        className="charts-grid">

        {/* Revenue bar chart */}
        <Card>
          <SectionTitle>Revenue closed · last 6 months</SectionTitle>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 110 }}>
            {revenueByMonth.map((m, i) => {
              const isLast = i === revenueByMonth.length - 1
              const h = maxRevenue > 0 ? Math.max(4, Math.round((m.value / maxRevenue) * 100)) : 4
              return (
                <div key={m.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
                  <div style={{ fontSize: 9, color: m.value > 0 ? '#1a1a18' : '#9b9890' }}>
                    {m.value > 0 ? fmt(m.value) : ''}
                  </div>
                  <div style={{
                    width: '100%',
                    height: h,
                    background: isLast ? '#1D9E75' : '#1a1a18',
                    borderRadius: '4px 4px 0 0',
                    opacity: isLast ? 1 : 0.7 + (i * 0.04),
                    transition: 'height 0.3s ease',
                  }} />
                  <div style={{ fontSize: 10, color: '#9b9890' }}>{m.label}</div>
                </div>
              )
            })}
          </div>
        </Card>

        {/* Activity volume */}
        <Card>
          <SectionTitle>Capture activity · last 6 months</SectionTitle>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 110 }}>
            {activityByMonth.map((m, i) => {
              const isLast = i === activityByMonth.length - 1
              const h = maxActivity > 0 ? Math.max(4, Math.round((m.count / maxActivity) * 100)) : 4
              return (
                <div key={m.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
                  <div style={{ fontSize: 9, color: m.count > 0 ? '#1a1a18' : '#9b9890' }}>
                    {m.count > 0 ? m.count : ''}
                  </div>
                  <div style={{
                    width: '100%',
                    height: h,
                    background: isLast ? '#1a1a18' : '#1a1a18',
                    borderRadius: '4px 4px 0 0',
                    opacity: 0.3 + (i * 0.12),
                  }} />
                  <div style={{ fontSize: 10, color: '#9b9890' }}>{m.label}</div>
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      {/* ── Funnel + At-risk ──────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}
        className="charts-grid">

        {/* Pipeline funnel */}
        <Card>
          <SectionTitle>Pipeline funnel</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {funnelCounts.map(f => (
              <div key={f.stage} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ fontSize: 12, color: '#6b6960', width: 80, flexShrink: 0 }}>
                  {f.label}
                </div>
                <div style={{ flex: 1, height: 20, background: '#f5f4f0', borderRadius: 5, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.max(4, Math.round((f.count / maxFunnelCount) * 100))}%`,
                    background: f.stage === 'closed_won' ? '#1D9E75' : '#1a1a18',
                    borderRadius: 5,
                    opacity: f.stage === 'closed_won' ? 1 : 0.75,
                    transition: 'width 0.4s ease',
                  }} />
                </div>
                <div style={{ fontSize: 12, fontWeight: 500, color: '#1a1a18', width: 24, textAlign: 'right' }}>
                  {f.count}
                </div>
                <div style={{ fontSize: 11, color: '#9b9890', width: 44, textAlign: 'right' }}>
                  {f.value > 0 ? fmt(f.value) : ''}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* At-risk deals */}
        <Card>
          <SectionTitle>At-risk · no activity 14+ days</SectionTitle>
          {atRisk.length === 0 ? (
            <div style={{ fontSize: 13, color: '#9b9890', paddingTop: 8 }}>
              No at-risk deals right now.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {atRisk.map(d => {
                const days = Math.floor((Date.now() - new Date(d.updated_at).getTime()) / 86400000)
                return (
                  <div key={d.id} style={{
                    background: '#fdf8f0',
                    border: '0.5px solid rgba(239,159,39,0.2)',
                    borderLeft: '2.5px solid #EF9F27',
                    borderRadius: 10,
                    padding: '10px 12px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#1a1a18', marginBottom: 2 }}>{d.name}</div>
                      <div style={{ fontSize: 11, color: '#9b9890' }}>{STAGE_LABELS[d.stage]} · {fmt(d.value ?? 0)}</div>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: '#EF9F27', flexShrink: 0 }}>
                      {days}d silent
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>

      {/* ── Uninvoiced + Task completion ──────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}
        className="charts-grid">

        {/* Uninvoiced won deals */}
        <Card>
          <SectionTitle>Revenue not yet invoiced</SectionTitle>
          {uninvoiced.length === 0 ? (
            <div style={{ fontSize: 13, color: '#9b9890' }}>All won deals are invoiced.</div>
          ) : (
            <>
              <div style={{ fontSize: 22, fontWeight: 500, color: '#E24B4A', marginBottom: 12 }}>
                {fmt(uninvoicedValue)}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {uninvoiced.slice(0, 4).map(d => (
                  <div key={d.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '7px 10px',
                    background: '#fdeaea',
                    borderRadius: 8,
                  }}>
                    <span style={{ fontSize: 12, color: '#1a1a18' }}>{d.name}</span>
                    <span style={{ fontSize: 12, fontWeight: 500, color: '#E24B4A' }}>
                      {fmt(d.confirmed_revenue ?? d.value ?? 0)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>

        {/* Task completion */}
        <Card>
          <SectionTitle>Task completion rate</SectionTitle>
          <div style={{ fontSize: 22, fontWeight: 500, color: '#1a1a18', marginBottom: 14 }}>
            {taskRate}%
          </div>
          <div style={{ height: 8, background: '#f5f4f0', borderRadius: 4, overflow: 'hidden', marginBottom: 10 }}>
            <div style={{
              height: '100%',
              width: `${taskRate}%`,
              background: taskRate >= 70 ? '#1D9E75' : taskRate >= 40 ? '#EF9F27' : '#E24B4A',
              borderRadius: 4,
              transition: 'width 0.4s ease',
            }} />
          </div>
          <div style={{ fontSize: 12, color: '#9b9890' }}>
            {doneTasks.length} of {tasks.length} tasks completed
          </div>
          {tasks.length === 0 && (
            <div style={{ fontSize: 12, color: '#9b9890', marginTop: 4 }}>No tasks yet.</div>
          )}
        </Card>
      </div>

      <style>{`
        @media (max-width: 767px) {
          .metrics-grid { grid-template-columns: 1fr 1fr !important; }
          .charts-grid  { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
