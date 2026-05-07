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
  if (d < 0)  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  if (d === 0) return 'Today'
  if (d === 1) return 'Yesterday'
  return `${d}d ago`
}

export default function DealsList({ deals }: { deals: Deal[] }) {
  const [query, setQuery]               = useState('')
  const [stageFilter, setStageFilter]   = useState('all')
  const [priorityFilter, setPriority]   = useState('all')

  const stageOptions = useMemo<PillOption[]>(() => {
    const vals = Array.from(new Set(deals.map(d => d.stage)))
      .sort((a, b) => STAGE_ORDER.indexOf(a) - STAGE_ORDER.indexOf(b))
    return [
      { value: 'all', label: `All · ${deals.length}` },
      ...vals.map(v => ({ value: v, label: STAGE_LABELS[v] ?? v, colors: STAGE_COLORS[v] })),
    ]
  }, [deals])

  const priorityOptions = useMemo<PillOption[]>(() => {
    const vals = Array.from(new Set(deals.map(d => d.priority).filter(Boolean) as string[]))
      .sort((a, b) => PRIORITY_ORDER.indexOf(a) - PRIORITY_ORDER.indexOf(b))
    return [
      { value: 'all', label: 'All priorities' },
      ...vals.map(v => ({ value: v, label: PRIORITY_LABELS[v] ?? v, colors: PRIORITY_COLORS[v] })),
    ]
  }, [deals])

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    return deals.filter(d => {
      const matchesQuery    = !q ||
        d.name.toLowerCase().includes(q) ||
        getCompanyName(d.companies)?.toLowerCase().includes(q) ||
        STAGE_LABELS[d.stage]?.toLowerCase().includes(q)
      const matchesStage    = stageFilter   === 'all' || d.stage    === stageFilter
      const matchesPriority = priorityFilter === 'all' || d.priority === priorityFilter
      return matchesQuery && matchesStage && matchesPriority
    })
  }, [deals, query, stageFilter, priorityFilter])

  const hasActiveFilter = query.trim() || stageFilter !== 'all' || priorityFilter !== 'all'

  return (
    <>
      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 12 }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9b9890" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={`Search ${deals.length} deals…`}
          style={{
            width: '100%', boxSizing: 'border-box',
            background: 'white', border: '0.5px solid rgba(0,0,0,0.09)',
            borderRadius: 12, padding: '10px 36px 10px 36px',
            fontSize: 14, color: '#1a1a18', outline: 'none',
            fontFamily: 'inherit', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        />
        {query && (
          <button onClick={() => setQuery('')} style={{
            position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer', color: '#9b9890',
            display: 'flex', alignItems: 'center', padding: 2,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        )}
      </div>

      {/* Stage + priority filter pills */}
      <FilterPills options={stageOptions}    active={stageFilter}    onChange={setStageFilter} />
      <FilterPills options={priorityOptions} active={priorityFilter} onChange={setPriority} />

      {/* Result count when filtering */}
      {hasActiveFilter && (
        <p style={{ margin: '0 0 12px', fontSize: 12, color: '#9b9890' }}>
          {filtered.length} deal{filtered.length !== 1 ? 's' : ''}
          {query.trim() ? ` matching "${query}"` : ''}
        </p>
      )}

      {/* List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map(deal => {
          const days = deal.last_activity_at
            ? Math.floor((Date.now() - new Date(deal.last_activity_at).getTime()) / 86400000)
            : null
          const atRisk = days !== null && days >= 14 && deal.stage !== 'closed_won' && deal.stage !== 'closed_lost'
          const sc = STAGE_COLORS[deal.stage] ?? { bg: 'rgba(0,0,0,0.05)', color: '#6b6960' }
          const value = formatValue(deal.value)
          const pc = deal.priority ? PRIORITY_COLORS[deal.priority] : null

          return (
            <Link key={deal.id} href={`/deals/${deal.id}`} style={{ textDecoration: 'none' }}>
              <div
                style={{
                  background: 'white',
                  border: atRisk ? '0.5px solid rgba(239,159,39,0.3)' : '0.5px solid rgba(0,0,0,0.07)',
                  borderLeft: atRisk ? '2.5px solid #EF9F27' : undefined,
                  borderRadius: 16, padding: '14px 16px',
                  transition: 'box-shadow 0.15s ease',
                }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.07)')}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: '#1a1a18', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {deal.name}
                    </div>
                    {getCompanyName(deal.companies) && (
                      <div style={{ fontSize: 12, color: '#9b9890' }}>{getCompanyName(deal.companies)}</div>
                    )}
                  </div>
                  {value && (
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#1a1a18', flexShrink: 0 }}>{value}</div>
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{
                      fontSize: 11, fontWeight: 500,
                      background: sc.bg, color: sc.color,
                      padding: '3px 9px', borderRadius: 6,
                    }}>
                      {STAGE_LABELS[deal.stage] ?? deal.stage}
                    </span>
                    {deal.priority && pc && (
                      <span style={{
                        fontSize: 11, fontWeight: 500,
                        background: pc.bg, color: pc.color,
                        padding: '3px 9px', borderRadius: 6,
                      }}>
                        {PRIORITY_LABELS[deal.priority] ?? deal.priority}
                      </span>
                    )}
                  </div>
                  {atRisk && days !== null && (
                    <span style={{ fontSize: 11, color: '#EF9F27', fontWeight: 500 }}>
                      {days}d no activity
                    </span>
                  )}
                  {!atRisk && deal.last_activity_at && (
                    <span style={{ fontSize: 11, color: '#9b9890' }}>
                      {timeAgo(deal.last_activity_at)}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          )
        })}

        {filtered.length === 0 && (
          <div style={{ background: 'white', borderRadius: 16, border: '0.5px solid rgba(0,0,0,0.07)', padding: 32, textAlign: 'center' }}>
            <p style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 500, color: '#1a1a18' }}>
              {hasActiveFilter ? 'No deals match your filters' : 'No deals yet'}
            </p>
            <p style={{ margin: 0, fontSize: 13, color: '#9b9890' }}>
              {hasActiveFilter ? 'Try clearing your search or filters' : 'Use Capture to add your first deal'}
            </p>
          </div>
        )}
      </div>
    </>
  )
}
