'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import FilterBar from '@/components/FilterBar'
import type { FilterOption } from '@/components/FilterBar'

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

const DAY = 86400000

function getLastContactedBucket(last_contacted_at: string | null): 'recent' | 'this_month' | 'older' | 'never' {
  if (!last_contacted_at) return 'never'
  const days = (Date.now() - new Date(last_contacted_at).getTime()) / DAY
  if (days <= 7)  return 'recent'
  if (days <= 30) return 'this_month'
  return 'older'
}

function getCompanyName(companies: Contact['companies']): string | null {
  if (!companies) return null
  if (Array.isArray(companies)) return (companies as any[])[0]?.name ?? null
  return (companies as any).name ?? null
}

function timeAgo(dateStr: string) {
  const d = Math.floor((Date.now() - new Date(dateStr).getTime()) / DAY)
  if (d < 0)   return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  if (d === 0) return 'Today'
  if (d === 1) return 'Yesterday'
  if (d < 30)  return `${d}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const COL = '2fr 1.5fr 1fr 90px 106px 32px'

const TH_STYLE: React.CSSProperties = {
  fontSize: 10, color: '#9b9890', fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: '0.07em',
  fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
}

export default function ContactsList({ contacts, labels }: {
  contacts: Contact[]
  labels?: { company?: string; singular?: string; plural?: string }
}) {
  const companyHeader = labels?.company ?? 'Company'
  const one = labels?.singular ?? 'contact'
  const many = labels?.plural ?? 'contacts'
  const [query, setQuery]               = useState('')
  const [statusFilter, setStatus]       = useState('all')
  const [seniorityFilter, setSeniority] = useState('all')
  const [recencyFilter, setRecency]     = useState('all')

  const statusOptions = useMemo<FilterOption[]>(() => [
    { value: 'all', label: 'All statuses' },
    ...STATUS_ORDER.map(v => ({ value: v, label: STATUS_LABELS[v] ?? v })),
  ], [])

  const seniorityOptions = useMemo<FilterOption[]>(() => [
    { value: 'all', label: 'All seniorities' },
    ...SENIORITY_ORDER.map(v => ({ value: v, label: SENIORITY_LABELS[v] ?? v })),
  ], [])

  const recencyOptions = useMemo<FilterOption[]>(() => {
    const counts = { recent: 0, this_month: 0, older: 0, never: 0 }
    for (const c of contacts) counts[getLastContactedBucket(c.last_contacted_at)]++
    const opts: FilterOption[] = [{ value: 'all', label: 'Any time' }]
    if (counts.recent)     opts.push({ value: 'recent',     label: `Last 7 days · ${counts.recent}` })
    if (counts.this_month) opts.push({ value: 'this_month', label: `Last 30 days · ${counts.this_month}` })
    if (counts.older)      opts.push({ value: 'older',      label: `Older · ${counts.older}` })
    if (counts.never)      opts.push({ value: 'never',      label: `Never contacted · ${counts.never}` })
    return opts
  }, [contacts])

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    return contacts.filter(c => {
      const matchesQuery     = !q ||
        c.full_name.toLowerCase().includes(q) ||
        c.role?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        getCompanyName(c.companies)?.toLowerCase().includes(q)
      const matchesStatus    = statusFilter    === 'all' || c.status          === statusFilter
      const matchesSeniority = seniorityFilter === 'all' || c.seniority_level === seniorityFilter
      const matchesRecency   = recencyFilter   === 'all' || getLastContactedBucket(c.last_contacted_at) === recencyFilter
      return matchesQuery && matchesStatus && matchesSeniority && matchesRecency
    })
  }, [contacts, query, statusFilter, seniorityFilter, recencyFilter])

  const hasActiveFilter = query.trim() || statusFilter !== 'all' || seniorityFilter !== 'all' || recencyFilter !== 'all'

  return (
    <>
      <FilterBar
        query={query}
        onQuery={setQuery}
        placeholder={`Search ${contacts.length} ${many}…`}
        filters={[
          { key: 'status',    options: statusOptions,    active: statusFilter,    onChange: setStatus },
          { key: 'recency',   options: recencyOptions,   active: recencyFilter,   onChange: setRecency },
          { key: 'seniority', options: seniorityOptions, active: seniorityFilter, onChange: setSeniority },
        ]}
      />

      {hasActiveFilter && (
        <p style={{ margin: '0 0 10px', fontSize: 12, color: '#9b9890' }}>
          {filtered.length} {filtered.length === 1 ? one : many}
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
          minWidth: 560,
        }}>
          {['Name', companyHeader, 'Role', 'Status', 'Last contact', ''].map((h, i) => (
            <span key={i} style={TH_STYLE}>{h}</span>
          ))}
        </div>

        {/* Rows */}
        {filtered.length === 0 ? (
          <div style={{ padding: '28px 16px', textAlign: 'center' }}>
            <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 500, color: '#1a1a18' }}>
              {hasActiveFilter ? `No ${many} match your filters` : `No ${many} yet`}
            </p>
            <p style={{ margin: 0, fontSize: 12, color: '#9b9890' }}>
              {hasActiveFilter ? 'Try clearing your search or filters' : `Use Capture to add your first ${one}`}
            </p>
          </div>
        ) : (
          filtered.map((c, i) => {
            const company = getCompanyName(c.companies)
            const sc = c.status ? STATUS_COLORS[c.status] : null
            return (
              <Link
                key={c.id}
                href={`/contacts/${c.id}`}
                className="data-table-row"
                style={{
                  gridTemplateColumns: COL,
                  borderBottom: i < filtered.length - 1 ? '0.5px solid rgba(0,0,0,0.04)' : 'none',
                  minWidth: 560,
                }}
              >
                {/* Name */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', background: '#1a1a18',
                    color: 'white', fontSize: 10, fontWeight: 600, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {c.full_name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#1a1a18', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.full_name}
                  </span>
                </div>

                {/* Company */}
                <span style={{ fontSize: 12, color: '#6b6960', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {company ?? <span style={{ color: '#c8c5be' }}>—</span>}
                </span>

                {/* Role */}
                <span style={{ fontSize: 12, color: '#6b6960', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.role ? (
                    c.seniority_level ? `${SENIORITY_LABELS[c.seniority_level] ?? c.seniority_level} · ${c.role}` : c.role
                  ) : (
                    c.seniority_level ? SENIORITY_LABELS[c.seniority_level] ?? c.seniority_level : <span style={{ color: '#c8c5be' }}>—</span>
                  )}
                </span>

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

                {/* Last contacted */}
                <span style={{ fontSize: 12, color: '#9b9890' }}>
                  {c.last_contacted_at ? timeAgo(c.last_contacted_at) : <span style={{ color: '#c8c5be' }}>Never</span>}
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
