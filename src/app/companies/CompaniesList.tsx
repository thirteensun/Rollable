'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import FilterPills, { PillOption } from '@/components/FilterPills'

interface Company {
  id: string
  name: string
  industry: string | null
  created_at: string
  status: string | null
  type: string | null
}

const STATUS_LABELS: Record<string, string> = {
  active:  'Active',
  at_risk: 'At risk',
  churned: 'Churned',
  dormant: 'Dormant',
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  active:  { bg: 'rgba(29,158,117,0.1)',   color: '#1D9E75' },
  at_risk: { bg: 'rgba(239,159,39,0.12)',  color: '#b87a10' },
  churned: { bg: 'rgba(226,75,74,0.1)',    color: '#c03030' },
  dormant: { bg: 'rgba(0,0,0,0.05)',       color: '#6b6960' },
}

const TYPE_LABELS: Record<string, string> = {
  prospect:   'Prospect',
  customer:   'Customer',
  partner:    'Partner',
  competitor: 'Competitor',
  investor:   'Investor',
  other:      'Other',
}

const TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  prospect:   { bg: 'rgba(74,122,138,0.1)',  color: '#4a7a8a' },
  customer:   { bg: 'rgba(29,158,117,0.1)',  color: '#1D9E75' },
  partner:    { bg: 'rgba(74,122,138,0.08)', color: '#4a7a8a' },
  competitor: { bg: 'rgba(226,75,74,0.08)',  color: '#c03030' },
  investor:   { bg: 'rgba(160,136,64,0.1)',  color: '#8a7040' },
  other:      { bg: 'rgba(0,0,0,0.05)',      color: '#6b6960' },
}

const STATUS_ORDER = ['active', 'at_risk', 'churned', 'dormant']
const TYPE_ORDER   = ['prospect', 'customer', 'partner', 'competitor', 'investor', 'other']

function timeAgo(dateStr: string) {
  const d = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
  if (d < 0)   return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  if (d === 0) return 'Today'
  if (d === 1) return 'Yesterday'
  if (d < 30)  return `${d}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function companyInitials(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

const COL = '2fr 1.5fr 96px 90px 80px 32px'

const TH_STYLE: React.CSSProperties = {
  fontSize: 10, color: '#9b9890', fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: '0.07em',
  fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
}

export default function CompaniesList({ companies }: { companies: Company[] }) {
  const [query, setQuery]         = useState('')
  const [statusFilter, setStatus] = useState('all')
  const [typeFilter, setType]     = useState('all')
  const [industryFilter, setIndustry] = useState('all')

  const statusOptions = useMemo<PillOption[]>(() => [
    { value: 'all', label: `All · ${companies.length}` },
    ...STATUS_ORDER.map(v => ({ value: v, label: STATUS_LABELS[v] ?? v, colors: STATUS_COLORS[v] })),
  ], [companies])

  const typeOptions = useMemo<PillOption[]>(() => [
    { value: 'all', label: 'All types' },
    ...TYPE_ORDER.map(v => ({ value: v, label: TYPE_LABELS[v] ?? v })),
  ], [])

  const industryOptions = useMemo<PillOption[]>(() => {
    const counts: Record<string, number> = {}
    for (const c of companies) {
      if (c.industry) counts[c.industry] = (counts[c.industry] ?? 0) + 1
    }
    const vals = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([v]) => v)
    if (vals.length < 2) return [{ value: 'all', label: 'All industries' }]
    return [
      { value: 'all', label: 'All industries' },
      ...vals.map(v => ({ value: v, label: v })),
    ]
  }, [companies])

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    return companies.filter(c => {
      const matchesQuery    = !q || c.name.toLowerCase().includes(q) || c.industry?.toLowerCase().includes(q)
      const matchesStatus   = statusFilter   === 'all' || c.status   === statusFilter
      const matchesType     = typeFilter     === 'all' || c.type     === typeFilter
      const matchesIndustry = industryFilter === 'all' || c.industry === industryFilter
      return matchesQuery && matchesStatus && matchesType && matchesIndustry
    })
  }, [companies, query, statusFilter, typeFilter, industryFilter])

  const hasActiveFilter = query.trim() || statusFilter !== 'all' || typeFilter !== 'all' || industryFilter !== 'all'

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
          placeholder={`Search ${companies.length} companies…`}
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

      <FilterPills options={statusOptions}   active={statusFilter}   onChange={setStatus} />
      <FilterPills options={typeOptions}     active={typeFilter}     onChange={setType} />
      <FilterPills options={industryOptions} active={industryFilter} onChange={setIndustry} />

      {hasActiveFilter && (
        <p style={{ margin: '0 0 10px', fontSize: 12, color: '#9b9890' }}>
          {filtered.length} {filtered.length === 1 ? 'company' : 'companies'}
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
          minWidth: 520,
        }}>
          {['Name', 'Industry', 'Type', 'Status', 'Added', ''].map((h, i) => (
            <span key={i} style={TH_STYLE}>{h}</span>
          ))}
        </div>

        {/* Rows */}
        {filtered.length === 0 ? (
          <div style={{ padding: '28px 16px', textAlign: 'center' }}>
            <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 500, color: '#1a1a18' }}>
              {hasActiveFilter ? 'No companies match your filters' : 'No companies yet'}
            </p>
            <p style={{ margin: 0, fontSize: 12, color: '#9b9890' }}>
              {hasActiveFilter ? 'Try clearing your search or filters' : 'Use Capture to add your first company'}
            </p>
          </div>
        ) : (
          filtered.map((c, i) => {
            const sc = c.status ? STATUS_COLORS[c.status] : null
            const tc = c.type ? TYPE_COLORS[c.type] : null
            return (
              <Link
                key={c.id}
                href={`/companies/${c.id}`}
                className="data-table-row"
                style={{
                  gridTemplateColumns: COL,
                  borderBottom: i < filtered.length - 1 ? '0.5px solid rgba(0,0,0,0.04)' : 'none',
                  minWidth: 520,
                }}
              >
                {/* Name */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 8,
                    background: '#f5f4f0', border: '0.5px solid rgba(0,0,0,0.07)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, fontSize: 10, fontWeight: 600, color: '#6b6960',
                  }}>
                    {companyInitials(c.name)}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#1a1a18', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.name}
                  </span>
                </div>

                {/* Industry */}
                <span style={{ fontSize: 12, color: '#6b6960', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.industry ?? <span style={{ color: '#c8c5be' }}>—</span>}
                </span>

                {/* Type */}
                <div>
                  {c.type && tc ? (
                    <span style={{
                      fontSize: 10, fontWeight: 500,
                      background: tc.bg, color: tc.color,
                      padding: '2px 7px', borderRadius: 5,
                    }}>
                      {TYPE_LABELS[c.type] ?? c.type}
                    </span>
                  ) : (
                    <span style={{ color: '#c8c5be', fontSize: 12 }}>—</span>
                  )}
                </div>

                {/* Status */}
                <div>
                  {c.status && sc ? (
                    <span style={{
                      fontSize: 10, fontWeight: 500,
                      background: sc.bg, color: sc.color,
                      padding: '2px 7px', borderRadius: 5,
                    }}>
                      {STATUS_LABELS[c.status] ?? c.status}
                    </span>
                  ) : (
                    <span style={{ color: '#c8c5be', fontSize: 12 }}>—</span>
                  )}
                </div>

                {/* Added */}
                <span style={{ fontSize: 12, color: '#9b9890' }}>
                  {timeAgo(c.created_at)}
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
