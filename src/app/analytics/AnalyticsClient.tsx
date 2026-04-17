'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

type Deal = {
  id: string
  name: string
  stage: string
  value?: number
  confirmed_revenue?: number
  updated_at: string
  payment_status?: string
  expected_close_date?: string
  loss_reason?: string
  stage_entered_at?: string
  closed_at?: string
  last_activity_at?: string
  created_at: string
}

type Contact = {
  id: string
  full_name: string
  role?: string
  company_name?: string
  last_contacted_at?: string
  next_followup_date?: string
  created_at: string
}

type Company = {
  id: string
  name: string
  industry?: string
  created_at: string
}

type Task = {
  id: string
  title?: string
  status?: string
  done?: boolean
  due_date?: string
  priority?: string
  deal_id?: string
  contact_id?: string
}

type StageVelocity = {
  stage: string
  avg_days: number
  transitions: number
}

type StageConversion = {
  stage: string
  deals_entered: number
  deals_advanced: number
  deals_lost_here: number
  advance_rate_pct: number
}

type Quota = {
  quota?: number
  quota_period?: string
  confirmed_revenue?: number
  pipeline_value?: number
  attainment_pct?: number
  gap_to_quota?: number
}

type Props = {
  deals: Deal[]
  contacts: Contact[]
  companies: Company[]
  tasks: Task[]
  stageVelocity: StageVelocity[]
  quota: Quota | null
  stageConversion: StageConversion[]
}

type Category = 'deals' | 'contacts' | 'companies'
type Focus = 'dynamic' | 'history' | 'performance' | 'potential' | 'problems'

// ─── Constants ────────────────────────────────────────────────────────────────

const STAGE_ORDER = ['lead', 'qualified', 'demo', 'proposal', 'negotiation', 'closed_won', 'closed_lost']
const STAGE_LABELS: Record<string, string> = {
  lead: 'Lead', qualified: 'Qualified', demo: 'Demo',
  proposal: 'Proposal', negotiation: 'Negotiation',
  closed_won: 'Won', closed_lost: 'Lost',
}
const STAGE_PROB: Record<string, number> = {
  lead: 0.10, qualified: 0.25, demo: 0.40, proposal: 0.60, negotiation: 0.80,
}

const CATEGORIES: { key: Category; label: string }[] = [
  { key: 'deals', label: 'Deals' },
  { key: 'contacts', label: 'Contacts' },
  { key: 'companies', label: 'Companies' },
]

const FOCUSES: { key: Focus; label: string; description: string }[] = [
  { key: 'dynamic',     label: 'Dynamic',     description: 'What\'s moving right now' },
  { key: 'history',     label: 'History',     description: 'Past performance & patterns' },
  { key: 'performance', label: 'Performance', description: 'Efficiency & conversion rates' },
  { key: 'potential',   label: 'Potential',   description: 'Forecast & future value' },
  { key: 'problems',    label: 'Problems',    description: 'At-risk & needs attention' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(v?: number) {
  if (!v) return '—'
  if (v >= 1000000) return `€${(v / 1000000).toFixed(1)}m`
  if (v >= 1000) return `€${(v / 1000).toFixed(0)}k`
  return `€${v}`
}

function daysSince(dateStr?: string) {
  if (!dateStr) return 999
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

function daysUntil(dateStr?: string) {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
}

function pct(n: number, total: number) {
  if (!total) return '—'
  return `${Math.round((n / total) * 100)}%`
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{
      background: 'white',
      border: '0.5px solid rgba(0,0,0,0.07)',
      borderRadius: 16,
      padding: '18px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
    }}>
      <div style={{ fontSize: 11, color: '#9b9890', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 500, color: color || '#1a1a18', letterSpacing: '-0.02em' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#6b6960' }}>{sub}</div>}
    </div>
  )
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'white',
      border: '0.5px solid rgba(0,0,0,0.07)',
      borderRadius: 16,
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '14px 18px',
        borderBottom: '0.5px solid rgba(0,0,0,0.06)',
        fontSize: 13,
        fontWeight: 500,
        color: '#1a1a18',
      }}>{title}</div>
      <div style={{ padding: '14px 18px' }}>{children}</div>
    </div>
  )
}

function BarRow({ label, value, max, count, color = '#1a1a18' }: {
  label: string; value: number; max: number; count?: number | string; color?: string
}) {
  const pctWidth = max > 0 ? Math.max(4, (value / max) * 100) : 4
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
      <div style={{ width: 90, fontSize: 12, color: '#6b6960', flexShrink: 0 }}>{label}</div>
      <div style={{ flex: 1, height: 6, background: '#f5f4f0', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pctWidth}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.4s ease' }} />
      </div>
      <div style={{ width: 40, fontSize: 12, color: '#6b6960', textAlign: 'right', flexShrink: 0 }}>{count ?? fmt(value)}</div>
    </div>
  )
}

function Tag({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 500, padding: '2px 7px',
      borderRadius: 6, color, background: bg,
    }}>{label}</span>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 13, color: '#9b9890' }}>
      {message}
    </div>
  )
}

// ─── Report: Deals × Dynamic ─────────────────────────────────────────────────
function DealsDynamic({ deals }: { deals: Deal[] }) {
  const active = deals.filter(d => !['closed_won', 'closed_lost'].includes(d.stage))
  const recentlyMoved = [...active]
    .filter(d => d.stage_entered_at)
    .sort((a, b) => new Date(b.stage_entered_at!).getTime() - new Date(a.stage_entered_at!).getTime())
    .slice(0, 5)
  const recentActivity = [...active]
    .sort((a, b) => daysSince(a.last_activity_at) - daysSince(b.last_activity_at))
    .slice(0, 5)
  const totalValue = active.reduce((s, d) => s + (d.value || 0), 0)
  const avgDaysInStage = active
    .filter(d => d.stage_entered_at)
    .map(d => daysSince(d.stage_entered_at))
  const avgStage = avgDaysInStage.length
    ? Math.round(avgDaysInStage.reduce((a, b) => a + b, 0) / avgDaysInStage.length)
    : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <StatCard label="Active deals" value={String(active.length)} sub="in pipeline" />
        <StatCard label="Pipeline value" value={fmt(totalValue)} sub="active deals" />
        <StatCard label="Avg days in stage" value={`${avgStage}d`} sub="current stage" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <SectionCard title="Recently moved stages">
          {recentlyMoved.length === 0 ? <EmptyState message="No recent stage changes" /> : (
            recentlyMoved.map(d => (
              <Link key={d.id} href={`/tracking/deals/${d.id}`} style={{ textDecoration: 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#1a1a18' }}>{d.name}</div>
                    <div style={{ fontSize: 11, color: '#9b9890' }}>{STAGE_LABELS[d.stage]} · {daysSince(d.stage_entered_at)}d ago</div>
                  </div>
                  <div style={{ fontSize: 12, color: '#6b6960' }}>{fmt(d.value)}</div>
                </div>
              </Link>
            ))
          )}
        </SectionCard>

        <SectionCard title="Most recently active">
          {recentActivity.map(d => (
            <Link key={d.id} href={`/tracking/deals/${d.id}`} style={{ textDecoration: 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#1a1a18' }}>{d.name}</div>
                  <div style={{ fontSize: 11, color: '#9b9890' }}>{STAGE_LABELS[d.stage]}</div>
                </div>
                <Tag label={`${daysSince(d.last_activity_at)}d ago`}
                  color={daysSince(d.last_activity_at) > 7 ? '#EF9F27' : '#1D9E75'}
                  bg={daysSince(d.last_activity_at) > 7 ? '#fdf3e3' : '#e8f5f0'} />
              </div>
            </Link>
          ))}
        </SectionCard>
      </div>
    </div>
  )
}

// ─── Report: Deals × History ──────────────────────────────────────────────────
function DealsHistory({ deals }: { deals: Deal[] }) {
  const won = deals.filter(d => d.stage === 'closed_won')
  const lost = deals.filter(d => d.stage === 'closed_lost')
  const totalClosed = won.length + lost.length
  const winRate = totalClosed > 0 ? Math.round((won.length / totalClosed) * 100) : 0
  const avgWonValue = won.length ? won.reduce((s, d) => s + (d.confirmed_revenue || d.value || 0), 0) / won.length : 0
  const lossReasons = lost.reduce((acc: Record<string, number>, d) => {
    const r = d.loss_reason || 'Unknown'
    acc[r] = (acc[r] || 0) + 1
    return acc
  }, {})
  const topReasons = Object.entries(lossReasons).sort((a, b) => b[1] - a[1]).slice(0, 5)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <StatCard label="Total closed" value={String(totalClosed)} sub="all time" />
        <StatCard label="Won" value={String(won.length)} color="#1D9E75" />
        <StatCard label="Lost" value={String(lost.length)} color="#E24B4A" />
        <StatCard label="Win rate" value={`${winRate}%`} sub="of closed deals" color={winRate >= 50 ? '#1D9E75' : '#EF9F27'} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <SectionCard title="Closed won deals">
          {won.length === 0 ? <EmptyState message="No won deals yet" /> : (
            won.slice(0, 6).map(d => (
              <Link key={d.id} href={`/tracking/deals/${d.id}`} style={{ textDecoration: 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#1a1a18' }}>{d.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: '#1D9E75', fontWeight: 500 }}>{fmt(d.confirmed_revenue || d.value)}</span>
                  </div>
                </div>
              </Link>
            ))
          )}
          {won.length > 0 && (
            <div style={{ borderTop: '0.5px solid rgba(0,0,0,0.06)', paddingTop: 10, marginTop: 4 }}>
              <div style={{ fontSize: 12, color: '#6b6960' }}>Avg deal size: <strong>{fmt(avgWonValue)}</strong></div>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Loss reasons">
          {lost.length === 0 ? <EmptyState message="No lost deals yet" /> : (
            topReasons.map(([reason, count]) => (
              <BarRow key={reason} label={reason} value={count} max={topReasons[0][1]} count={count} />
            ))
          )}
        </SectionCard>
      </div>
    </div>
  )
}

// ─── Report: Deals × Performance ─────────────────────────────────────────────
function DealsPerformance({ deals, stageVelocity, stageConversion, quota }: {
  deals: Deal[]; stageVelocity: StageVelocity[]; stageConversion: StageConversion[]; quota: Quota | null
}) {
  const maxVelocity = Math.max(...stageVelocity.map(s => s.avg_days), 1)
  const maxEntered = Math.max(...stageConversion.map(s => s.deals_entered), 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <StatCard
          label="Quota attainment"
          value={quota?.attainment_pct != null ? `${quota.attainment_pct}%` : '—'}
          sub={quota?.quota_period ?? ''}
          color={quota?.attainment_pct && quota.attainment_pct >= 75 ? '#1D9E75' : '#EF9F27'}
        />
        <StatCard
          label="Confirmed revenue"
          value={fmt(quota?.confirmed_revenue)}
          sub={`of ${fmt(quota?.quota)} quota`}
        />
        <StatCard
          label="Gap to quota"
          value={fmt(quota?.gap_to_quota)}
          color={quota?.gap_to_quota ? '#E24B4A' : '#1D9E75'}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <SectionCard title="Stage velocity — avg days">
          {stageVelocity.length === 0 ? <EmptyState message="Not enough closed deals yet" /> : (
            STAGE_ORDER.slice(0, 5).map(stage => {
              const row = stageVelocity.find(s => s.stage === stage)
              if (!row) return null
              return <BarRow key={stage} label={STAGE_LABELS[stage]} value={row.avg_days} max={maxVelocity} count={`${row.avg_days}d`} />
            })
          )}
        </SectionCard>

        <SectionCard title="Stage conversion rates">
          {stageConversion.length === 0 ? <EmptyState message="Not enough deal history yet" /> : (
            STAGE_ORDER.slice(0, 5).map(stage => {
              const row = stageConversion.find(s => s.stage === stage)
              if (!row) return null
              const rate = row.deals_entered > 0
                ? Math.round((row.deals_advanced / row.deals_entered) * 100)
                : 0
              return (
                <BarRow
                  key={stage}
                  label={STAGE_LABELS[stage]}
                  value={rate}
                  max={100}
                  count={`${rate}%`}
                  color={rate >= 60 ? '#1D9E75' : rate >= 35 ? '#EF9F27' : '#E24B4A'}
                />
              )
            })
          )}
        </SectionCard>
      </div>
    </div>
  )
}

// ─── Report: Deals × Potential ────────────────────────────────────────────────
function DealsPotential({ deals, quota }: { deals: Deal[]; quota: Quota | null }) {
  const active = deals.filter(d => !['closed_won', 'closed_lost'].includes(d.stage))
  const weighted = active.reduce((s, d) => s + (d.value || 0) * (STAGE_PROB[d.stage] || 0), 0)
  const closingSoon = active
    .filter(d => {
      const days = daysUntil(d.expected_close_date)
      return days !== null && days >= 0 && days <= 30
    })
    .sort((a, b) => daysUntil(a.expected_close_date)! - daysUntil(b.expected_close_date)!)
  const noCloseDate = active.filter(d => !d.expected_close_date)
  const coverage = quota?.gap_to_quota && quota.gap_to_quota > 0
    ? Math.round((weighted / quota.gap_to_quota) * 100)
    : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <StatCard label="Weighted forecast" value={fmt(weighted)} sub="probability-adjusted" />
        <StatCard label="Pipeline coverage" value={coverage !== null ? `${coverage}%` : '—'} sub="of quota gap" color={coverage && coverage >= 100 ? '#1D9E75' : '#EF9F27'} />
        <StatCard label="Closing in 30d" value={String(closingSoon.length)} sub="deals with close dates" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <SectionCard title="Closing soon">
          {closingSoon.length === 0 ? <EmptyState message="No deals with expected close dates in 30 days" /> : (
            closingSoon.map(d => {
              const days = daysUntil(d.expected_close_date)!
              return (
                <Link key={d.id} href={`/tracking/deals/${d.id}`} style={{ textDecoration: 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#1a1a18' }}>{d.name}</div>
                      <div style={{ fontSize: 11, color: '#9b9890' }}>{STAGE_LABELS[d.stage]}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: '#1a1a18' }}>{fmt(d.value)}</div>
                      <Tag label={`${days}d`} color={days <= 7 ? '#1D9E75' : '#6b6960'} bg={days <= 7 ? '#e8f5f0' : '#f5f4f0'} />
                    </div>
                  </div>
                </Link>
              )
            })
          )}
        </SectionCard>

        <SectionCard title={`No close date set (${noCloseDate.length})`}>
          {noCloseDate.length === 0 ? <EmptyState message="All active deals have close dates ✓" /> : (
            noCloseDate.slice(0, 6).map(d => (
              <Link key={d.id} href={`/tracking/deals/${d.id}`} style={{ textDecoration: 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#1a1a18' }}>{d.name}</div>
                  <div style={{ fontSize: 12, color: '#9b9890' }}>{STAGE_LABELS[d.stage]}</div>
                </div>
              </Link>
            ))
          )}
        </SectionCard>
      </div>
    </div>
  )
}

// ─── Report: Deals × Problems ─────────────────────────────────────────────────
function DealsProblems({ deals, tasks }: { deals: Deal[]; tasks: Task[] }) {
  const active = deals.filter(d => !['closed_won', 'closed_lost'].includes(d.stage))
  const atRisk = active.filter(d => daysSince(d.last_activity_at) >= 14)
    .sort((a, b) => daysSince(b.last_activity_at) - daysSince(a.last_activity_at))
  const stalled = active.filter(d => daysSince(d.stage_entered_at) >= 21)
    .sort((a, b) => daysSince(b.stage_entered_at) - daysSince(a.stage_entered_at))
  const uninvoiced = deals.filter(d => d.stage === 'closed_won' && (!d.payment_status || d.payment_status === 'none'))
  const overdueTasks = tasks.filter(t => !t.done && t.due_date && daysUntil(t.due_date)! < 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <StatCard label="At risk" value={String(atRisk.length)} sub="no activity 14d+" color={atRisk.length > 0 ? '#E24B4A' : '#1D9E75'} />
        <StatCard label="Stalled" value={String(stalled.length)} sub="21d+ in same stage" color={stalled.length > 0 ? '#EF9F27' : '#1D9E75'} />
        <StatCard label="Uninvoiced" value={fmt(uninvoiced.reduce((s, d) => s + (d.confirmed_revenue || d.value || 0), 0))} sub={`${uninvoiced.length} won deals`} color={uninvoiced.length > 0 ? '#E24B4A' : '#1D9E75'} />
        <StatCard label="Overdue tasks" value={String(overdueTasks.length)} color={overdueTasks.length > 0 ? '#EF9F27' : '#1D9E75'} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <SectionCard title={`At risk — no activity 14+ days (${atRisk.length})`}>
          {atRisk.length === 0 ? <EmptyState message="No at-risk deals right now ✓" /> : (
            atRisk.slice(0, 6).map(d => (
              <Link key={d.id} href={`/tracking/deals/${d.id}`} style={{ textDecoration: 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#1a1a18' }}>{d.name}</div>
                    <div style={{ fontSize: 11, color: '#9b9890' }}>{STAGE_LABELS[d.stage]}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12, color: '#6b6960' }}>{fmt(d.value)}</div>
                    <Tag label={`${daysSince(d.last_activity_at)}d silent`} color="#E24B4A" bg="#fdeaea" />
                  </div>
                </div>
              </Link>
            ))
          )}
        </SectionCard>

        <SectionCard title={`Stalled deals — 21+ days in stage (${stalled.length})`}>
          {stalled.length === 0 ? <EmptyState message="No stalled deals ✓" /> : (
            stalled.slice(0, 6).map(d => (
              <Link key={d.id} href={`/tracking/deals/${d.id}`} style={{ textDecoration: 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#1a1a18' }}>{d.name}</div>
                    <div style={{ fontSize: 11, color: '#9b9890' }}>{STAGE_LABELS[d.stage]}</div>
                  </div>
                  <Tag label={`${daysSince(d.stage_entered_at)}d in stage`} color="#EF9F27" bg="#fdf3e3" />
                </div>
              </Link>
            ))
          )}
        </SectionCard>
      </div>
    </div>
  )
}

// ─── Report: Contacts × Dynamic ───────────────────────────────────────────────
function ContactsDynamic({ contacts }: { contacts: Contact[] }) {
  const dueToday = contacts.filter(c => {
    const days = daysUntil(c.next_followup_date)
    return days !== null && days <= 0
  })
  const dueThisWeek = contacts.filter(c => {
    const days = daysUntil(c.next_followup_date)
    return days !== null && days > 0 && days <= 7
  })
  const recentlyContacted = [...contacts]
    .filter(c => c.last_contacted_at)
    .sort((a, b) => daysSince(a.last_contacted_at) - daysSince(b.last_contacted_at))
    .slice(0, 6)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <StatCard label="Follow-ups due" value={String(dueToday.length)} sub="today or overdue" color={dueToday.length > 0 ? '#E24B4A' : '#1D9E75'} />
        <StatCard label="Due this week" value={String(dueThisWeek.length)} sub="next 7 days" />
        <StatCard label="Total contacts" value={String(contacts.length)} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <SectionCard title="Follow-ups due today">
          {dueToday.length === 0 ? <EmptyState message="No follow-ups due today ✓" /> : (
            dueToday.slice(0, 6).map(c => (
              <Link key={c.id} href={`/contacts/${c.id}`} style={{ textDecoration: 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#1a1a18' }}>{c.full_name}</div>
                    <div style={{ fontSize: 11, color: '#9b9890' }}>{[c.role, c.company_name].filter(Boolean).join(' · ')}</div>
                  </div>
                  <Tag label="Due" color="#E24B4A" bg="#fdeaea" />
                </div>
              </Link>
            ))
          )}
        </SectionCard>

        <SectionCard title="Recently contacted">
          {recentlyContacted.length === 0 ? <EmptyState message="No contact activity recorded" /> : (
            recentlyContacted.map(c => (
              <Link key={c.id} href={`/contacts/${c.id}`} style={{ textDecoration: 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#1a1a18' }}>{c.full_name}</div>
                    <div style={{ fontSize: 11, color: '#9b9890' }}>{c.company_name}</div>
                  </div>
                  <Tag label={`${daysSince(c.last_contacted_at)}d ago`}
                    color={daysSince(c.last_contacted_at) > 14 ? '#EF9F27' : '#1D9E75'}
                    bg={daysSince(c.last_contacted_at) > 14 ? '#fdf3e3' : '#e8f5f0'} />
                </div>
              </Link>
            ))
          )}
        </SectionCard>
      </div>
    </div>
  )
}

// ─── Report: Contacts × Problems ──────────────────────────────────────────────
function ContactsProblems({ contacts }: { contacts: Contact[] }) {
  const noFollowup = contacts.filter(c => !c.next_followup_date)
  const longSilent = contacts.filter(c => daysSince(c.last_contacted_at) > 30)
    .sort((a, b) => daysSince(b.last_contacted_at) - daysSince(a.last_contacted_at))
  const overdue = contacts.filter(c => {
    const days = daysUntil(c.next_followup_date)
    return days !== null && days < 0
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <StatCard label="Overdue follow-ups" value={String(overdue.length)} color={overdue.length > 0 ? '#E24B4A' : '#1D9E75'} />
        <StatCard label="Gone silent 30d+" value={String(longSilent.length)} color={longSilent.length > 0 ? '#EF9F27' : '#1D9E75'} />
        <StatCard label="No follow-up set" value={String(noFollowup.length)} color={noFollowup.length > 0 ? '#EF9F27' : '#1D9E75'} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <SectionCard title={`Gone silent — 30+ days (${longSilent.length})`}>
          {longSilent.length === 0 ? <EmptyState message="No contacts gone silent ✓" /> : (
            longSilent.slice(0, 6).map(c => (
              <Link key={c.id} href={`/contacts/${c.id}`} style={{ textDecoration: 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#1a1a18' }}>{c.full_name}</div>
                    <div style={{ fontSize: 11, color: '#9b9890' }}>{c.company_name}</div>
                  </div>
                  <Tag label={`${daysSince(c.last_contacted_at)}d`} color="#EF9F27" bg="#fdf3e3" />
                </div>
              </Link>
            ))
          )}
        </SectionCard>

        <SectionCard title={`No follow-up scheduled (${noFollowup.length})`}>
          {noFollowup.length === 0 ? <EmptyState message="All contacts have follow-ups ✓" /> : (
            noFollowup.slice(0, 6).map(c => (
              <Link key={c.id} href={`/contacts/${c.id}`} style={{ textDecoration: 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#1a1a18' }}>{c.full_name}</div>
                  <div style={{ fontSize: 11, color: '#9b9890' }}>{[c.role, c.company_name].filter(Boolean).join(' · ')}</div>
                </div>
              </Link>
            ))
          )}
        </SectionCard>
      </div>
    </div>
  )
}

// ─── Report: Companies × Dynamic ─────────────────────────────────────────────
function CompaniesDynamic({ companies, deals }: { companies: Company[]; deals: Deal[] }) {
  const dealsByCompany = deals.reduce((acc: Record<string, Deal[]>, d) => {
    const key = (d as any).company_id || 'none'
    if (!acc[key]) acc[key] = []
    acc[key].push(d)
    return acc
  }, {})

  const recentCompanies = [...companies]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 6)

  const industriyBreakdown = companies.reduce((acc: Record<string, number>, c) => {
    const ind = c.industry || 'Unknown'
    acc[ind] = (acc[ind] || 0) + 1
    return acc
  }, {})
  const topIndustries = Object.entries(industriyBreakdown).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const maxInd = topIndustries[0]?.[1] || 1

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <StatCard label="Total companies" value={String(companies.length)} />
        <StatCard label="With active deals" value={String(companies.filter(c => deals.some(d => !['closed_won','closed_lost'].includes(d.stage) && (d as any).company_id === c.id)).length)} />
        <StatCard label="Industries" value={String(Object.keys(industriyBreakdown).length)} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <SectionCard title="Recently added">
          {recentCompanies.map(c => (
            <Link key={c.id} href={`/companies/${c.id}`} style={{ textDecoration: 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#1a1a18' }}>{c.name}</div>
                  {c.industry && <div style={{ fontSize: 11, color: '#9b9890' }}>{c.industry}</div>}
                </div>
                <Tag label={`${daysSince(c.created_at)}d ago`} color="#6b6960" bg="#f5f4f0" />
              </div>
            </Link>
          ))}
        </SectionCard>

        <SectionCard title="By industry">
          {topIndustries.length === 0 ? <EmptyState message="No industry data" /> : (
            topIndustries.map(([ind, count]) => (
              <BarRow key={ind} label={ind} value={count} max={maxInd} count={count} />
            ))
          )}
        </SectionCard>
      </div>
    </div>
  )
}

// ─── Report: Companies × Potential ────────────────────────────────────────────
function CompaniesPotential({ companies, deals }: { companies: Company[]; deals: Deal[] }) {
  const activeDeals = deals.filter(d => !['closed_won', 'closed_lost'].includes(d.stage))
  const companiesWithDeals = companies
    .map(c => {
      const companyDeals = activeDeals.filter(d => (d as any).company_id === c.id)
      const totalValue = companyDeals.reduce((s, d) => s + (d.value || 0), 0)
      const weighted = companyDeals.reduce((s, d) => s + (d.value || 0) * (STAGE_PROB[d.stage] || 0), 0)
      return { ...c, dealCount: companyDeals.length, totalValue, weighted }
    })
    .filter(c => c.dealCount > 0)
    .sort((a, b) => b.weighted - a.weighted)

  const maxVal = companiesWithDeals[0]?.totalValue || 1

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <StatCard label="Companies in pipeline" value={String(companiesWithDeals.length)} />
        <StatCard label="Total pipeline value" value={fmt(companiesWithDeals.reduce((s, c) => s + c.totalValue, 0))} />
        <StatCard label="Weighted forecast" value={fmt(companiesWithDeals.reduce((s, c) => s + c.weighted, 0))} />
      </div>

      <SectionCard title="Companies by pipeline value">
        {companiesWithDeals.length === 0 ? <EmptyState message="No companies with active deals" /> : (
          companiesWithDeals.map(c => (
            <div key={c.id} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <Link href={`/companies/${c.id}`} style={{ textDecoration: 'none' }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#1a1a18' }}>{c.name}</span>
                </Link>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: '#9b9890' }}>{c.dealCount} deal{c.dealCount > 1 ? 's' : ''}</span>
                  <span style={{ fontSize: 12, fontWeight: 500, color: '#1a1a18' }}>{fmt(c.totalValue)}</span>
                </div>
              </div>
              <div style={{ height: 4, background: '#f5f4f0', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: `${(c.totalValue / maxVal) * 100}%`, height: '100%', background: '#1a1a18', borderRadius: 2 }} />
              </div>
            </div>
          ))
        )}
      </SectionCard>
    </div>
  )
}

// ─── Generic fallback for unbuilt combinations ────────────────────────────────
function GenericReport({ category, focus, deals, contacts, companies }: {
  category: Category; focus: Focus; deals: Deal[]; contacts: Contact[]; companies: Company[]
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
      <StatCard label="Total deals" value={String(deals.length)} />
      <StatCard label="Total contacts" value={String(contacts.length)} />
      <StatCard label="Total companies" value={String(companies.length)} />
    </div>
  )
}

// ─── Report Router ────────────────────────────────────────────────────────────
function ReportRouter({ category, focus, deals, contacts, companies, tasks, stageVelocity, stageConversion, quota }: Props & { category: Category; focus: Focus }) {
  if (category === 'deals') {
    if (focus === 'dynamic') return <DealsDynamic deals={deals} />
    if (focus === 'history') return <DealsHistory deals={deals} />
    if (focus === 'performance') return <DealsPerformance deals={deals} stageVelocity={stageVelocity} stageConversion={stageConversion} quota={quota} />
    if (focus === 'potential') return <DealsPotential deals={deals} quota={quota} />
    if (focus === 'problems') return <DealsProblems deals={deals} tasks={tasks} />
  }
  if (category === 'contacts') {
    if (focus === 'dynamic') return <ContactsDynamic contacts={contacts} />
    if (focus === 'problems') return <ContactsProblems contacts={contacts} />
  }
  if (category === 'companies') {
    if (focus === 'dynamic') return <CompaniesDynamic companies={companies} deals={deals} />
    if (focus === 'potential') return <CompaniesPotential companies={companies} deals={deals} />
  }
  return <GenericReport category={category} focus={focus} deals={deals} contacts={contacts} companies={companies} />
}

// ─── Report title + description ───────────────────────────────────────────────
const REPORT_META: Record<string, Record<string, { title: string; description: string }>> = {
  deals: {
    dynamic:     { title: 'Deal momentum',       description: 'What\'s moving, recent stage changes, activity velocity' },
    history:     { title: 'Win/loss history',    description: 'Closed deals, win rate, loss patterns and reasons' },
    performance: { title: 'Sales performance',   description: 'Quota attainment, stage velocity, conversion rates' },
    potential:   { title: 'Revenue forecast',    description: 'Weighted pipeline, expected close dates, quota coverage' },
    problems:    { title: 'Deal health issues',  description: 'At-risk, stalled deals, uninvoiced revenue, overdue tasks' },
  },
  contacts: {
    dynamic:     { title: 'Contact activity',    description: 'Follow-ups due, recently contacted, outreach momentum' },
    history:     { title: 'Contact history',     description: 'Engagement patterns, contact frequency over time' },
    performance: { title: 'Contact performance', description: 'Deals won per contact, top contributors' },
    potential:   { title: 'Contact potential',   description: 'Contacts on hot deals, upsell opportunities' },
    problems:    { title: 'Contact gaps',        description: 'Overdue follow-ups, silent contacts, missing data' },
  },
  companies: {
    dynamic:     { title: 'Company activity',    description: 'Recently added, industry breakdown, new relationships' },
    history:     { title: 'Company history',     description: 'Companies with closed deals, revenue by account' },
    performance: { title: 'Account performance', description: 'Revenue per company, win rates by account' },
    potential:   { title: 'Account potential',   description: 'Companies in pipeline, weighted value by account' },
    problems:    { title: 'Account risks',       description: 'Companies with stalled or at-risk deals' },
  },
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AnalyticsClient(props: Props) {
  const [category, setCategory] = useState<Category>('deals')
  const [focus, setFocus] = useState<Focus>('dynamic')

  const meta = REPORT_META[category]?.[focus] ?? { title: 'Analytics', description: '' }

  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div style={{ paddingTop: 8 }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 500, color: '#1a1a18', margin: 0, marginBottom: 4 }}>Analytics</h1>
        <div style={{ fontSize: 13, color: '#9b9890' }}>{today}</div>
      </div>

      {/* Selector row */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>

        {/* Category pills */}
        <div style={{ display: 'flex', gap: 6 }}>
          {CATEGORIES.map(c => (
            <button
              key={c.key}
              onClick={() => setCategory(c.key)}
              style={{
                padding: '7px 16px',
                borderRadius: 20,
                border: '0.5px solid rgba(0,0,0,0.1)',
                background: category === c.key ? '#1a1a18' : 'white',
                color: category === c.key ? 'white' : '#6b6960',
                fontSize: 13,
                fontWeight: category === c.key ? 500 : 400,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Focus pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {FOCUSES.map(f => (
            <button
              key={f.key}
              onClick={() => setFocus(f.key)}
              style={{
                padding: '6px 14px',
                borderRadius: 20,
                border: `0.5px solid ${focus === f.key ? 'transparent' : 'rgba(0,0,0,0.08)'}`,
                background: focus === f.key ? '#f5f4f0' : 'white',
                color: focus === f.key ? '#1a1a18' : '#9b9890',
                fontSize: 12,
                fontWeight: focus === f.key ? 500 : 400,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Report header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 500, color: '#1a1a18', marginBottom: 3 }}>{meta.title}</div>
        <div style={{ fontSize: 12, color: '#9b9890' }}>{meta.description}</div>
      </div>

      {/* Report content */}
      <ReportRouter {...props} category={category} focus={focus} />

      <style>{`
        button { font-family: inherit; }
      `}</style>
    </div>
  )
}