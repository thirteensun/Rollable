'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import FilterPills, { PillOption } from '@/components/FilterPills'

interface Deal {
  id: string
  name: string
  value: number | null
  stage: string
  priority: string | null
  last_activity_at: string | null
  companies: { name: string } | { name: string }[] | null
}

const STAGE_LABELS: Record<string, string> = {
  lead: 'Lead', qualified: 'Qualified', demo: 'Demo',
  proposal: 'Proposal', negotiation: 'Negotiation',
  closed_won: 'Won', closed_lost: 'Lost',
}

const STAGE_COLORS: Record<string, { bg: string; color: string }> = {
  lead:        { bg: 'rgba(0,0,0,0.05)',      color: '#6b6960' },
  qualified:   { bg: 'rgba(74,122,138,0.1)',  color: '#4a7a8a' },
  demo:        { bg: 'rgba(160,136,64,0.1)',  color: '#8a7040' },
  proposal:    { bg: 'rgba(239,159,39,0.12)', color: '#b87a10' },
  negotiation: { bg: 'rgba(226,75,74,0.1)',   color: '#c03030' },
  closed_won:  { bg: 'rgba(29,158,117,0.1)',  color: '#1D9E75' },
  closed_lost: { bg: 'rgba(0,0,0,0.05)',      color: '#9b9890' },
}

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical',
  p0: 'P0', p1: 'P1', p2: 'P2', p3: 'P3',
}

const PRIORITY_COLORS: Record<string, { bg: string; color: string }> = {
  low:      { bg: 'rgba(29,158,117,0.1)',   color: '#1D9E75' },
  medium:   { bg: 'rgba(160,136,64,0.1)',   color: '#8a7040' },
  high:     { bg: 'rgba(239,159,39,0.12)',  color: '#b87a10' },
  critical: { bg: 'rgba(226,75,74,0.1)',    color: '#c03030' },
  p0:       { bg: 'rgba(226,75,74,0.1)',    color: '#c03030' },
  p1:       { bg: 'rgba(239,159,39,0.12)',  color: '#b87a10' },
  p2:       { bg: 'rgba(160,136,64,0.1)',   color: '#8a7040' },
  p3:       { bg: 'rgba(29,158,117,0.1)',   color: '#1D9E75' },
}

const STAGE_ORDER    = ['lead','qualified','demo','proposal','negotiation','closed_won','closed_lost']
const PRIORITY_ORDER = ['critical','high','medium','low','p0','p1','p2','p3']

function getCompanyName(companies: Deal['companies']): string | null {
  if (!companies) return null
  if (Array.isArray(companies)) return (companies as any[])[0]?.name ?? null
  return (companies as any).name ?? null
}

function formatValue(v?: number | null) {
  if (!v) return null
  if (v >= 1000000) return `€${(v / 1000000).toFixed(1)}M`
  if (v >= 1000) return `€${(v / 1000).toFixed(0)}k`
  return `€${v}`
}

function timeAgo(dateStr: string) {
  const d = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
  if (d < 0)   return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  if (d === 0) return 'Today'
  if (d === 1) return 'Yesterday'
  if (d < 30)  return `${d}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const COL = '2fr 1.5fr 72px 108px 88px 96px 32px'

const TH_STYLE: React.CSSProperties = {
  fontSize: 10, color: '#9b9890', fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: '0.07em',
  fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
}

export default function DealsList({ deals }: { deals: Deal[] }) {
  const [query, setQuery]             = useState('')
  const [stageFilter, setStageFilter] = useState('all')
  const [priorityFilter, setPriority] = useState('all')
  const [riskFilter, setRisk]         = useState('all')

  const stageOptions = useMemo<PillOption[]>(() => {
    const vals = Array.from(new Set(deals.map(d => d.stage)))
      .sort((a, b) => STAGE_ORDER.indexOf(a) - STAGE_ORDER.indexOf(b))
    return [
      { value: 'all', label: `All · ${deals.length}` },
      ...vals.map(v => ({ value: v, label: STAGE_LABELS[v] ?? v, colors: STAGE_COLORS[v] })),
    ]
  }, [deals])

  const priorityOptions = useMemo<PillOption[]>(() => {
    const usedVals = new Set(deals.map(d => d.priority).filter(Boolean) as string[])
    const pScale = usedVals.has('p0') || usedVals.has('p1') || usedVals.has('p2') || usedVals.has('p3')
      ? ['p0','p1','p2','p3']
      : ['critical','high','medium','low']
    return [
      { value: 'all', label: 'All priorities' },
      ...pScale.map(v => ({ value: v, label: PRIORITY_LABELS[v] ?? v, colors: PRIORITY_COLORS[v] })),
    ]
  }, [deals])

  const riskOptions = useMemo<PillOption[]>(() => {
    const atRiskCount = deals.filter(d => {
      if (d.stage === 'closed_won' || d.stage === 'closed_lost') return false
      if (!d.last_activity_at) return false
      return (Date.now() - new Date(d.last_activity_at).getTime()) / 86400000 >= 14
    }).length
    if (atRiskCount === 0) return [{ value: 'all', label: 'All activity' }]
    return [
      { value: 'all', label: 'All activity' },
      { value: 'at_risk', label: `At risk · ${atRiskCount}`, colors: { bg: 'rgba(239,159,39,0.12)', color: '#b87a10' } },
    ]
  }, [deals])

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    return deals.filter(d => {
      const days = d.last_activity_at
        ? Math.floor((Date.now() - new Date(d.last_activity_at).getTime()) / 86400000)
        : null
      const isAtRisk = days !== null && days >= 14 && d.stage !== 'closed_won' && d.stage !== 'closed_lost'
      const matchesQuery    = !q ||
        d.name.toLowerCase().includes(q) ||
        getCompanyName(d.companies)?.toLowerCase().includes(q) ||
        STAGE_LABELS[d.stage]?.toLowerCase().includes(q)
      const matchesStage    = stageFilter    === 'all' || d.stage    === stageFilter
      const matchesPriority = priorityFilter === 'all' || d.priority === priorityFilter
      const matchesRisk     = riskFilter     === 'all' || (riskFilter === 'at_risk' && isAtRisk)
      return matchesQuery && matchesStage && matchesPriority && matchesRisk
    })
  }, [deals, query, stageFilter, priorityFilter, riskFilter])

  const hasActiveFilter = query.trim() || stageFilter !== 'all' || priorityFilter !== 'all' || riskFilter !== 'all'

  return (
    <>
      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 12 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9b9890" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={`Search ${deals.length} deals…`}
          style={{
            width: '100%', boxSizing: 'border-box',
            background: 'white', border: '0.5px solid rgba(0,0,0,0.09)',
            borderRadius: 10, padding: '9px 34px 9px 34px',
            fontSize: 13, color: '#1a1a18', outline: 'none', fontFamily: 'inherit',
          }}
        />
        {query && (
          <button onClick={() => setQuery('')} style={{
            position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer', color: '#9b9890',
            display: 'flex', alignItems: 'center', padding: 2,
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        )}
      </div>

      <FilterPills options={stageOptions}    active={stageFilter}    onChange={setStageFilter} />
      <FilterPills options={priorityOptions} active={priorityFilter} onChange={setPriority} />
      <FilterPills options={riskOptions}     active={riskFilter}     onChange={setRisk} />

      {hasActiveFilter && (
        <p style={{ margin: '0 0 10px', fontSize: 12, color: '#9b9890' }}>
          {filtered.length} deal{filtered.length !== 1 ? 's' : ''}
          {query.trim() ? ` matching "${query}"` : ''}
        </p>
      )}

      {/* Table */}
      <div style={{ border: '1px solid rgba(0,0,0,0.07)', borderRadius: 12, overflow: 'hidden', background: 'white', overflowX: 'auto' }}>
        {/* Header */}
        <div style={{
          display: 'grid', gridTemplateColumns: COL,
          padding: '0 16px', height: 36, alignItems: 'center',
          background: '#faf9f7', borderBottom: '0.5px solid rgba(0,0,0,0.06)',
          minWidth: 620,
        }}>
          {['Name', 'Company', 'Value', 'Stage', 'Priority', 'Activity', ''].map((h, i) => (
            <span key={i} style={TH_STYLE}>{h}</span>
          ))}
        </div>

        {/* Rows */}
        {filtered.length === 0 ? (
          <div style={{ padding: '28px 16px', textAlign: 'center' }}>
            <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 500, color: '#1a1a18' }}>
              {hasActiveFilter ? 'No deals match your filters' : 'No deals yet'}
            </p>
            <p style={{ margin: 0, fontSize: 12, color: '#9b9890' }}>
              {hasActiveFilter ? 'Try clearing your search or filters' : 'Use Capture to add your first deal'}
            </p>
          </div>
        ) : (
          filtered.map((deal, i) => {
            const days = deal.last_activity_at
              ? Math.floor((Date.now() - new Date(deal.last_activity_at).getTime()) / 86400000)
              : null
            const atRisk = days !== null && days >= 14 && deal.stage !== 'closed_won' && deal.stage !== 'closed_lost'
            const sc = STAGE_COLORS[deal.stage] ?? { bg: 'rgba(0,0,0,0.05)', color: '#6b6960' }
            const pc = deal.priority ? PRIORITY_COLORS[deal.priority] : null
            const company = getCompanyName(deal.companies)

            return (
              <Link
                key={deal.id}
                href={`/deals/${deal.id}`}
                className="data-table-row"
                style={{
                  gridTemplateColumns: COL,
                  borderBottom: i < filtered.length - 1 ? '0.5px solid rgba(0,0,0,0.04)' : 'none',
                  borderLeft: atRisk ? '2px solid #EF9F27' : '2px solid transparent',
                  minWidth: 620,
                }}
              >
                {/* Name */}
                <span style={{ fontSize: 13, fontWeight: 500, color: '#1a1a18', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {deal.name}
                </span>

                {/* Company */}
                <span style={{ fontSize: 12, color: '#6b6960', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {company ?? <span style={{ color: '#c8c5be' }}>—</span>}
                </span>

                {/* Value */}
                <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a18' }}>
                  {formatValue(deal.value) ?? <span style={{ fontSize: 12, fontWeight: 400, color: '#c8c5be' }}>—</span>}
                </span>

                {/* Stage */}
                <div>
                  <span style={{
                    fontSize: 10, fontWeight: 500,
                    background: sc.bg, color: sc.color,
                    padding: '2px 7px', borderRadius: 5,
                  }}>
                    {STAGE_LABELS[deal.stage] ?? deal.stage}
                  </span>
                </div>

                {/* Priority */}
                <div>
                  {deal.priority && pc ? (
                    <span style={{
                      fontSize: 10, fontWeight: 500,
                      background: pc.bg, color: pc.color,
                      padding: '2px 7px', borderRadius: 5,
                    }}>
                      {PRIORITY_LABELS[deal.priority] ?? deal.priority}
                    </span>
                  ) : (
                    <span style={{ color: '#c8c5be', fontSize: 12 }}>—</span>
                  )}
                </div>

                {/* Activity */}
                <span style={{ fontSize: 12, color: atRisk ? '#EF9F27' : '#9b9890', fontWeight: atRisk ? 500 : 400 }}>
                  {atRisk && days !== null
                    ? `${days}d idle`
                    : deal.last_activity_at
                      ? timeAgo(deal.last_activity_at)
                      : <span style={{ color: '#c8c5be' }}>—</span>
                  }
                </span>

                {/* Action */}
                <div className="row-action" style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                    <path d="M6 4l4 4-4 4" stroke="#9b9890" strokeWidth="1.4" strokeLinecap="round"/>
                  </svg>
                </div>
              </Link>
            )
          })
        )}
      </div>
    </>
  )
}
