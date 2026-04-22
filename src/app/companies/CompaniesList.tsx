'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'

interface Company {
  id: string
  name: string
  industry: string | null
  created_at: string
}

function timeAgo(dateStr: string) {
  const d = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
  if (d === 0) return 'Today'
  if (d === 1) return 'Yesterday'
  return `${d}d ago`
}

function companyInitials(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div style={{ position: 'relative', marginBottom: 16 }}>
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
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    if (!query.trim()) return companies
    const q = query.toLowerCase()
    return companies.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.industry?.toLowerCase().includes(q)
    )
  }, [companies, query])

  return (
    <>
      <SearchInput value={query} onChange={setQuery} placeholder={`Search ${companies.length} companies…`} />

      {query.trim() && (
        <p style={{ margin: '0 0 12px', fontSize: 12, color: '#9b9890' }}>
          {filtered.length} result{filtered.length !== 1 ? 's' : ''} for "{query}"
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
                {c.industry && <div style={{ fontSize: 12, color: '#9b9890' }}>{c.industry}</div>}
              </div>
              <div style={{ fontSize: 11, color: '#9b9890', flexShrink: 0 }}>{timeAgo(c.created_at)}</div>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="#c8c5be" strokeWidth="1.4" strokeLinecap="round"/></svg>
            </div>
          </Link>
        ))}

        {filtered.length === 0 && (
          <div style={{ background: 'white', borderRadius: 16, border: '0.5px solid rgba(0,0,0,0.07)', padding: 32, textAlign: 'center' }}>
            <p style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 500, color: '#1a1a18' }}>
              {query ? `No companies matching "${query}"` : 'No companies yet'}
            </p>
            <p style={{ margin: 0, fontSize: 13, color: '#9b9890' }}>
              {query ? 'Try a different search' : 'Use Capture to add your first company'}
            </p>
          </div>
        )}
      </div>
    </>
  )
}
