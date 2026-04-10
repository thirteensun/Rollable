'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

interface SearchResult {
  contacts: { id: string; full_name: string; role: string | null; companies: { name: string } | null }[]
  deals: { id: string; name: string; stage: string; value: number | null }[]
  companies: { id: string; name: string; industry: string | null }[]
  mode?: string
}

const STAGE_COLORS: Record<string, { bg: string; text: string }> = {
  lead:        { bg: 'rgba(155,152,144,0.1)', text: '#9b9890' },
  qualified:   { bg: 'rgba(59,130,246,0.1)',  text: '#3b82f6' },
  demo:        { bg: 'rgba(239,159,39,0.1)',  text: '#EF9F27' },
  proposal:    { bg: 'rgba(239,159,39,0.1)',  text: '#EF9F27' },
  negotiation: { bg: 'rgba(239,159,39,0.1)',  text: '#EF9F27' },
  closed_won:  { bg: 'rgba(29,158,117,0.1)',  text: '#1D9E75' },
  closed_lost: { bg: 'rgba(226,75,74,0.1)',   text: '#E24B4A' },
}

const STAGE_LABELS: Record<string, string> = {
  lead: 'Lead', qualified: 'Qualified', demo: 'Demo',
  proposal: 'Proposal', negotiation: 'Negotiation',
  closed_won: 'Won', closed_lost: 'Lost',
}

function formatCurrency(val?: number | null) {
  if (val == null) return ''
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val)
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

const SUGGESTIONS = [
  'Show me at risk deals',
  'Contacts from last week',
  'Deals in negotiation',
  'Won deals',
]

export default function SearchModal({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!query.trim()) { setResults(null); return }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query }),
        })
        const data = await res.json()
        setResults(data)
      } catch {
        setResults(null)
      } finally {
        setLoading(false)
      }
    }, 400)
    return () => clearTimeout(debounceRef.current)
  }, [query])

  const hasResults = results && (results.contacts.length > 0 || results.deals.length > 0 || results.companies.length > 0)

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: '#f5f4f0',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Search bar */}
      <div style={{ padding: '56px 20px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          flex: 1, background: 'white', borderRadius: 16,
          border: '0.5px solid rgba(0,0,0,0.1)',
          display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
        }}>
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="5.5" stroke="#9b9890" strokeWidth="1.2" />
            <path d="M11 11l2.5 2.5" stroke="#9b9890" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search contacts, deals, notes..."
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 15, color: '#1a1a18', background: 'transparent', fontFamily: 'inherit' }}
          />
          {query && (
            <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9b9890', padding: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18M6 6l12 12"/>
              </svg>
            </button>
          )}
        </div>
        <button
          onClick={onClose}
          style={{ fontSize: 14, color: '#6b6960', background: 'none', border: 'none', cursor: 'pointer', padding: '8px 4px', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
        >
          Cancel
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px' }}>

        {/* Loading */}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
            <div style={{ display: 'flex', gap: 5 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#9b9890', animation: `breathe 1.2s ease-in-out ${i * 0.2}s infinite` }} />
              ))}
            </div>
          </div>
        )}

        {/* Suggestions — show when no query */}
        {!query && !loading && (
          <div>
            <p style={{ fontSize: 11, color: '#9b9890', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Try asking</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {SUGGESTIONS.map((s, i) => (
                <button key={i} onClick={() => setQuery(s)} style={{
                  background: 'white', borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.07)',
                  padding: '11px 14px', textAlign: 'left', cursor: 'pointer', width: '100%',
                  fontSize: 13, color: '#6b6960', fontFamily: 'inherit',
                }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* No results */}
        {!loading && query && !hasResults && results && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <p style={{ fontSize: 15, color: '#9b9890' }}>No results for "{query}"</p>
          </div>
        )}

        {/* Results */}
        {!loading && hasResults && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Contacts */}
            {results!.contacts.length > 0 && (
              <div>
                <p style={{ fontSize: 11, color: '#9b9890', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                  Contacts
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {results!.contacts.map(c => (
                    <Link key={c.id} href={`/contacts/${c.id}`} onClick={onClose} style={{ textDecoration: 'none' }}>
                      <div style={{ background: 'white', borderRadius: 14, border: '0.5px solid rgba(0,0,0,0.07)', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#E6F1FB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: '#185FA5', flexShrink: 0 }}>
                          {getInitials(c.full_name)}
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: '#1a1a18' }}>{c.full_name}</p>
                          <p style={{ margin: 0, fontSize: 12, color: '#9b9890' }}>
                            {c.role ? `${c.role}${c.companies?.name ? ` · ${c.companies.name}` : ''}` : c.companies?.name ?? ''}
                          </p>
                        </div>
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                          <path d="M6 4l4 4-4 4" stroke="#c8c5be" strokeWidth="1.3" strokeLinecap="round"/>
                        </svg>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Deals */}
            {results!.deals.length > 0 && (
              <div>
                <p style={{ fontSize: 11, color: '#9b9890', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                  Deals
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {results!.deals.map(d => {
                    const sc = STAGE_COLORS[d.stage] ?? STAGE_COLORS.lead
                    return (
                      <Link key={d.id} href={`/tracking/deals/${d.id}`} onClick={onClose} style={{ textDecoration: 'none' }}>
                        <div style={{ background: 'white', borderRadius: 14, border: '0.5px solid rgba(0,0,0,0.07)', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 10, background: '#E1F5EE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: '#0F6E56', flexShrink: 0 }}>
                            {getInitials(d.name)}
                          </div>
                          <div style={{ flex: 1 }}>
                            <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: '#1a1a18' }}>{d.name}</p>
                            <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 7px', borderRadius: 20, background: sc.bg, color: sc.text }}>
                              {STAGE_LABELS[d.stage] ?? d.stage}
                            </span>
                          </div>
                          {d.value && <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: '#1a1a18' }}>{formatCurrency(d.value)}</p>}
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                            <path d="M6 4l4 4-4 4" stroke="#c8c5be" strokeWidth="1.3" strokeLinecap="round"/>
                          </svg>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Companies */}
            {results!.companies.length > 0 && (
              <div>
                <p style={{ fontSize: 11, color: '#9b9890', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                  Companies
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {results!.companies.map(co => (
                    <Link key={co.id} href={`/companies/${co.id}`} onClick={onClose} style={{ textDecoration: 'none' }}>
                      <div style={{ background: 'white', borderRadius: 14, border: '0.5px solid rgba(0,0,0,0.07)', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: '#FAEEDA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: '#854F0B', flexShrink: 0 }}>
                          {getInitials(co.name)}
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: '#1a1a18' }}>{co.name}</p>
                          {co.industry && <p style={{ margin: 0, fontSize: 12, color: '#9b9890' }}>{co.industry}</p>}
                        </div>
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                          <path d="M6 4l4 4-4 4" stroke="#c8c5be" strokeWidth="1.3" strokeLinecap="round"/>
                        </svg>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {results?.mode === 'ai' && (
              <p style={{ fontSize: 11, color: '#9b9890', textAlign: 'center' }}>AI-powered search</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
