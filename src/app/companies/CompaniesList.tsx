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

const STATUS_ORDER = ['active', 'at_risk', 'churned', 'dormant']
const TYPE_ORDER   = ['prospect', 'customer', 'partner', 'competitor', 'investor', 'other']

function timeAgo(dateStr: string) {
  const d = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
  if (d < 0)   return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  if (d === 0) return 'Today'
  if (d === 1) return 'Yesterday'
  return `${d}d ago`
}

function companyInitials(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div style={{ position: 'relative', marginBottom: 12 }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9b9890" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
      </svg>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', boxSizing: 'border-box',
          background: 'white', border: '0.5px solid rgba(0,0,0,0.09)',
          borderRadius: 12, padding: '10px 36px 10px 36px',
          fontSize: 14, color: '#1a1a18', outline: 'none',
          fontFamily: 'inherit', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      />
      {value && (
        <button onClick={() => onChange('')} style={{
          position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
          background: 'none', border: 'none', cursor: 'pointer', color: '#9b9890',
          display: 'flex', alignItems: 'center', padding: 2,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      )}
    </div>
  )
}

export default function CompaniesList({ companies }: { companies: Company[] }) {
  const [query, setQuery]         = useState('')
  const [statusFilter, setStatus] = useState('all')
  const [typeFilter, setType]     = useState('all')
  const [industryFilter, setIndustry] = useState('all')

  // Status pills — data-driven
  const statusOptions = useMemo<PillOption[]>(() => {
    const vals = Array.from(new Set(companies.map(c => c.status).filter(Boolean) as string[]))
      .sort((a, b) => STATUS_ORDER.indexOf(a) - STATUS_ORDER.indexOf(b))
    return [
      { value: 'all', label: `All · ${companies.length}` },
      ...vals.map(v => ({ value: v, label: STATUS_LABELS[v] ?? v, colors: STATUS_COLORS[v] })),
    ]
  }, [companies])

  // Type pills — data-driven
  const typeOptions = useMemo<PillOption[]>(() => {
    const vals = Array.from(new Set(companies.map(c => c.type).filter(Boolean) as string[]))
      .sort((a, b) => TYPE_ORDER.indexOf(a) - TYPE_ORDER.indexOf(b))
    return [
      { value: 'all', label: 'All types' },
      ...vals.map(v => ({ value: v, label: TYPE_LABELS[v] ?? v })),
    ]
  }, [companies])

  // Industry pills — built from actual free-text values, capped at top 8 by frequency
  const industryOptions = useMemo<PillOption[]>(() => {
    const counts: Record<string, number> = {}
    for (const c of companies) {
      if (c.industry) counts[c.industry] = (counts[c.industry] ?? 0) + 1
    }
    const vals = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([v]) => v)
    if (vals.length < 2) return [{ value: 'all', label: 'All industries' }] // not enough variety
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
      <SearchInput value={query} onChange={setQuery} placeholder={`Search ${companies.length} companies…`} />

      <FilterPills options={statusOptions}   active={statusFilter}   onChange={setStatus} />
      <FilterPills options={typeOptions}     active={typeFilter}     onChange={setType} />
      <FilterPills options={industryOptions} active={industryFilter} onChange={setIndustry} />

      {hasActiveFilter && (
        <p style={{ margin: '0 0 12px', fontSize: 12, color: '#9b9890' }}>
          {filtered.length} {filtered.length === 1 ? 'company' : 'companies'}
          {query.trim() ? ` matching "${query}"` : ''}
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map(c => (
          <Link key={c.id} href={`/companies/${c.id}`} style={{ textDecoration: 'none' }}>
            <div
              style={{
                background: 'white', border: '0.5px solid rgba(0,0,0,0.07)',
                borderRadius: 16, padding: '14px 16px',
                display: 'flex', alignItems: 'center', gap: 12,
                transition: 'box-shadow 0.15s ease',
              }}
              onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.07)')}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
            >
              <div style={{
                width: 38, height: 38, borderRadius: 12,
                background: '#f5f4f0', border: '0.5px solid rgba(0,0,0,0.07)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, fontSize: 13, fontWeight: 600, color: '#6b6960',
              }}>
                {companyInitials(c.name)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#1a1a18', marginBottom: 2 }}>{c.name}</div>
                <div style={{ fontSize: 12, color: '#9b9890', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  {c.industry && <span>{c.industry}</span>}
                  {c.type && <span style={{ color: '#c8c5be' }}>{TYPE_LABELS[c.type] ?? c.type}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                {c.status && c.status !== 'active' && (
                  <span style={{
                    fontSize: 10, fontWeight: 500,
                    background: STATUS_COLORS[c.status]?.bg ?? 'rgba(0,0,0,0.05)',
                    color: STATUS_COLORS[c.status]?.color ?? '#6b6960',
                    padding: '2px 7px', borderRadius: 5,
                  }}>
                    {STATUS_LABELS[c.status] ?? c.status}
                  </span>
                )}
                <div style={{ fontSize: 11, color: '#9b9890' }}>{timeAgo(c.created_at)}</div>
              </div>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="#c8c5be" strokeWidth="1.4" strokeLinecap="round"/></svg>
            </div>
          </Link>
        ))}

        {filtered.length === 0 && (
          <div style={{ background: 'white', borderRadius: 16, border: '0.5px solid rgba(0,0,0,0.07)', padding: 32, textAlign: 'center' }}>
            <p style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 500, color: '#1a1a18' }}>
              {hasActiveFilter ? 'No companies match your filters' : 'No companies yet'}
            </p>
            <p style={{ margin: 0, fontSize: 13, color: '#9b9890' }}>
              {hasActiveFilter ? 'Try clearing your search or filters' : 'Use Capture to add your first company'}
            </p>
          </div>
        )}
      </div>
    </>
  )
}
