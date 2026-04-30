'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type ResultItem = {
  id: string
  type: 'contact' | 'deal' | 'company' | 'task'
  title: string
  subtitle?: string
  href: string
}

const TYPE_CONFIG = {
  contact: { label: 'Contact', color: '#6b6960', icon: (
    <svg width="12" height="12" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="7.5" cy="5" r="3"/><path d="M1.5 13.5c0-3 2.7-5 6-5s6 2 6 5" strokeLinecap="round"/></svg>
  )},
  deal: { label: 'Deal', color: '#1D9E75', icon: (
    <svg width="12" height="12" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M1.5 7.5h12M7.5 1.5l6 6-6 6" strokeLinecap="round" strokeLinejoin="round"/></svg>
  )},
  company: { label: 'Company', color: '#4a7a8a', icon: (
    <svg width="12" height="12" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="1.5" y="5" width="12" height="8.5" rx="2"/><path d="M5 5V3.5a2.5 2.5 0 015 0V5" strokeLinecap="round"/></svg>
  )},
  task: { label: 'Task', color: '#EF9F27', icon: (
    <svg width="12" height="12" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="1.5" y="1.5" width="12" height="12" rx="2.5"/><path d="M4 7.5l2 2 4-4" strokeLinecap="round" strokeLinejoin="round"/></svg>
  )},
}

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: 'rgba(74,122,138,0.15)', color: 'inherit', borderRadius: 2, padding: '0 1px' }}>
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  )
}

export default function SearchModal() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ResultItem[]>([])
  const [loading, setLoading] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  // Open from AppHeader search icon
  useEffect(() => {
    function handleOpen() { setOpen(true) }
    window.addEventListener('open-search', handleOpen)
    return () => window.removeEventListener('open-search', handleOpen)
  }, [])

  // Keyboard shortcut: Cmd/Ctrl + K
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(true)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('')
      setResults([])
      setActiveIdx(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Search with debounce
  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      setLoading(false)
      return
    }

    setLoading(true)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query }),
        })
        const data = await res.json()

        // Normalise response into ResultItem[]
        const items: ResultItem[] = []

        ;(data.contacts ?? []).forEach((c: any) => items.push({
          id: c.id, type: 'contact',
          title: c.full_name,
          subtitle: [c.role, c.companies?.name].filter(Boolean).join(' · '),
          href: `/contacts/${c.id}`,
        }))
        ;(data.deals ?? []).forEach((d: any) => items.push({
          id: d.id, type: 'deal',
          title: d.name,
          subtitle: d.stage?.replace(/_/g, ' '),
          href: `/deals/${d.id}`,
        }))
        ;(data.companies ?? []).forEach((c: any) => items.push({
          id: c.id, type: 'company',
          title: c.name,
          subtitle: c.industry ?? undefined,
          href: `/companies/${c.id}`,
        }))
        ;(data.tasks ?? []).forEach((t: any) => items.push({
          id: t.id, type: 'task',
          title: t.title ?? 'Untitled task',
          subtitle: t.due_date ? new Date(t.due_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : undefined,
          href: `/tasks/${t.id}`,
        }))

        setResults(items)
        setActiveIdx(0)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 250)

    return () => clearTimeout(debounceRef.current)
  }, [query])

  // Arrow key navigation + Enter
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && results[activeIdx]) {
      router.push(results[activeIdx].href)
      setOpen(false)
    }
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={() => setOpen(false)}
        style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.25)',
          backdropFilter: 'blur(2px)',
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed', top: '18%', left: '50%',
        transform: 'translateX(-50%)',
        width: '100%', maxWidth: 560,
        zIndex: 201,
        background: 'white',
        borderRadius: 18,
        border: '0.5px solid rgba(0,0,0,0.08)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        maxHeight: '60vh',
      }}>

        {/* Search input */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 16px',
          borderBottom: results.length > 0 || loading ? '0.5px solid rgba(0,0,0,0.07)' : 'none',
        }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
            <circle cx="7" cy="7" r="5" stroke="#9b9890" strokeWidth="1.5"/>
            <path d="M11 11l3 3" stroke="#9b9890" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search contacts, deals, companies, tasks…"
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              fontSize: 15, color: '#1a1a18', fontFamily: 'inherit',
            }}
          />
          {loading && (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, animation: 'spin 0.7s linear infinite' }}>
              <circle cx="7" cy="7" r="5.5" stroke="#9b9890" strokeWidth="1.5" strokeDasharray="20 14" strokeLinecap="round"/>
            </svg>
          )}
          {query && !loading && (
            <button onClick={() => setQuery('')} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#9b9890', display: 'flex', padding: 2,
            }}>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M2 2l9 9M11 2L2 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          )}
          <kbd style={{
            fontSize: 10, color: '#9b9890', background: '#f5f4f0',
            borderRadius: 5, padding: '2px 6px', fontFamily: 'inherit',
            border: '0.5px solid rgba(0,0,0,0.08)', flexShrink: 0,
          }}>
            esc
          </kbd>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div style={{ overflowY: 'auto', padding: '6px 8px 8px' }}>
            {results.map((item, i) => {
              const cfg = TYPE_CONFIG[item.type]
              const active = i === activeIdx
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  onMouseEnter={() => setActiveIdx(i)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 10px', borderRadius: 10, textDecoration: 'none',
                    background: active ? '#f5f4f0' : 'transparent',
                    transition: 'background 0.1s',
                  }}
                >
                  <div style={{
                    width: 26, height: 26, borderRadius: 7, flexShrink: 0,
                    background: active ? 'white' : '#f5f4f0',
                    border: '0.5px solid rgba(0,0,0,0.06)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: cfg.color,
                    transition: 'background 0.1s',
                  }}>
                    {cfg.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#1a1a18', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <Highlight text={item.title} query={query} />
                    </div>
                    {item.subtitle && (
                      <div style={{ fontSize: 11, color: '#9b9890', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.subtitle}
                      </div>
                    )}
                  </div>
                  <span style={{
                    fontSize: 10, color: cfg.color, background: `${cfg.color}18`,
                    borderRadius: 4, padding: '2px 6px', flexShrink: 0, fontWeight: 500,
                  }}>
                    {cfg.label}
                  </span>
                </Link>
              )
            })}
          </div>
        )}

        {/* Empty state */}
        {query.trim() && !loading && results.length === 0 && (
          <div style={{ padding: '28px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#1a1a18', marginBottom: 4 }}>
              No results for "{query}"
            </div>
            <div style={{ fontSize: 12, color: '#9b9890' }}>
              Try searching by name, company, or stage
            </div>
          </div>
        )}

        {/* Idle state */}
        {!query.trim() && (
          <div style={{ padding: '16px 16px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(['Contacts', 'Deals', 'Companies', 'Tasks'] as const).map(label => (
              <button
                key={label}
                onClick={() => setQuery(label.toLowerCase())}
                style={{
                  background: '#f5f4f0', border: 'none', borderRadius: 8,
                  padding: '5px 12px', fontSize: 12, color: '#6b6960',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Footer hint */}
        <div style={{
          padding: '8px 16px',
          borderTop: '0.5px solid rgba(0,0,0,0.06)',
          display: 'flex', gap: 16, alignItems: 'center',
        }}>
          {[['↑↓', 'navigate'], ['↵', 'open'], ['esc', 'close']].map(([key, label]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <kbd style={{ fontSize: 10, color: '#9b9890', background: '#f5f4f0', borderRadius: 4, padding: '1px 5px', border: '0.5px solid rgba(0,0,0,0.08)', fontFamily: 'inherit' }}>
                {key}
              </kbd>
              <span style={{ fontSize: 11, color: '#9b9890' }}>{label}</span>
            </div>
          ))}
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 11, color: '#c8c5be' }}>⌘K to open</span>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  )
}
