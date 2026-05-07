'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import FilterPills, { PillOption } from '@/components/FilterPills'

interface Contact {
  id: string
  full_name: string
  role: string | null
  email: string | null
  companies: { name: string } | { name: string }[] | null
  last_contacted_at: string | null
  status: string | null
  seniority_level: string | null
}

const STATUS_LABELS: Record<string, string> = {
  active:          'Active',
  inactive:        'Inactive',
  churned:         'Churned',
  do_not_contact:  'Do not contact',
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  active:         { bg: 'rgba(29,158,117,0.1)',  color: '#1D9E75' },
  inactive:       { bg: 'rgba(0,0,0,0.05)',      color: '#6b6960' },
  churned:        { bg: 'rgba(226,75,74,0.1)',   color: '#c03030' },
  do_not_contact: { bg: 'rgba(226,75,74,0.08)',  color: '#c03030' },
}

const SENIORITY_LABELS: Record<string, string> = {
  intern:  'Intern',
  junior:  'Junior',
  mid:     'Mid-level',
  senior:  'Senior',
  lead:    'Lead',
  exec:    'Exec',
  c_level: 'C-level',
}

const STATUS_ORDER    = ['active', 'inactive', 'churned', 'do_not_contact']
const SENIORITY_ORDER = ['intern', 'junior', 'mid', 'senior', 'lead', 'exec', 'c_level']

function getCompanyName(companies: Contact['companies']): string | null {
  if (!companies) return null
  if (Array.isArray(companies)) return (companies as any[])[0]?.name ?? null
  return (companies as any).name ?? null
}

function timeAgo(dateStr: string) {
  const d = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
  if (d === 0) return 'Today'
  if (d === 1) return 'Yesterday'
  return `${d}d ago`
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

export default function ContactsList({ contacts }: { contacts: Contact[] }) {
  const [query, setQuery]                 = useState('')
  const [statusFilter, setStatus]         = useState('all')
  const [seniorityFilter, setSeniority]   = useState('all')

  const statusOptions = useMemo<PillOption[]>(() => {
    const vals = Array.from(new Set(contacts.map(c => c.status).filter(Boolean) as string[]))
      .sort((a, b) => STATUS_ORDER.indexOf(a) - STATUS_ORDER.indexOf(b))
    return [
      { value: 'all', label: `All · ${contacts.length}` },
      ...vals.map(v => ({ value: v, label: STATUS_LABELS[v] ?? v, colors: STATUS_COLORS[v] })),
    ]
  }, [contacts])

  const seniorityOptions = useMemo<PillOption[]>(() => {
    const vals = Array.from(new Set(contacts.map(c => c.seniority_level).filter(Boolean) as string[]))
      .sort((a, b) => SENIORITY_ORDER.indexOf(a) - SENIORITY_ORDER.indexOf(b))
    return [
      { value: 'all', label: 'All seniorities' },
      ...vals.map(v => ({ value: v, label: SENIORITY_LABELS[v] ?? v })),
    ]
  }, [contacts])

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    return contacts.filter(c => {
      const matchesQuery    = !q ||
        c.full_name.toLowerCase().includes(q) ||
        c.role?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        getCompanyName(c.companies)?.toLowerCase().includes(q)
      const matchesStatus   = statusFilter   === 'all' || c.status          === statusFilter
      const matchesSeniority = seniorityFilter === 'all' || c.seniority_level === seniorityFilter
      return matchesQuery && matchesStatus && matchesSeniority
    })
  }, [contacts, query, statusFilter, seniorityFilter])

  const hasActiveFilter = query.trim() || statusFilter !== 'all' || seniorityFilter !== 'all'

  return (
    <>
      <SearchInput value={query} onChange={setQuery} placeholder={`Search ${contacts.length} contacts…`} />

      <FilterPills options={statusOptions}   active={statusFilter}   onChange={setStatus} />
      <FilterPills options={seniorityOptions} active={seniorityFilter} onChange={setSeniority} />

      {hasActiveFilter && (
        <p style={{ margin: '0 0 12px', fontSize: 12, color: '#9b9890' }}>
          {filtered.length} {filtered.length === 1 ? 'contact' : 'contacts'}
          {query.trim() ? ` matching "${query}"` : ''}
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map(c => (
          <Link key={c.id} href={`/contacts/${c.id}`} style={{ textDecoration: 'none' }}>
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
                width: 38, height: 38, borderRadius: '50%', background: '#1a1a18',
                color: 'white', fontSize: 12, fontWeight: 600, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {c.full_name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#1a1a18', marginBottom: 2 }}>{c.full_name}</div>
                <div style={{ fontSize: 12, color: '#9b9890', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {[c.role, getCompanyName(c.companies)].filter(Boolean).join(' · ')}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                {c.seniority_level && (
                  <span style={{ fontSize: 11, color: '#c8c5be' }}>
                    {SENIORITY_LABELS[c.seniority_level] ?? c.seniority_level}
                  </span>
                )}
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
                {c.last_contacted_at && (
                  <div style={{ fontSize: 11, color: '#9b9890' }}>{timeAgo(c.last_contacted_at)}</div>
                )}
              </div>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="#c8c5be" strokeWidth="1.4" strokeLinecap="round"/></svg>
            </div>
          </Link>
        ))}

        {filtered.length === 0 && (
          <div style={{ background: 'white', borderRadius: 16, border: '0.5px solid rgba(0,0,0,0.07)', padding: 32, textAlign: 'center' }}>
            <p style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 500, color: '#1a1a18' }}>
              {hasActiveFilter ? 'No contacts match your filters' : 'No contacts yet'}
            </p>
            <p style={{ margin: 0, fontSize: 13, color: '#9b9890' }}>
              {hasActiveFilter ? 'Try clearing your search or filters' : 'Use Capture to add your first contact'}
            </p>
          </div>
        )}
      </div>
    </>
  )
}
