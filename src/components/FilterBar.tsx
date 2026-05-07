'use client'

import { useState, useRef, useEffect } from 'react'

export interface FilterOption {
  value: string
  label: string
}

export interface FilterDef {
  key: string
  options: FilterOption[]
  active: string
  onChange: (v: string) => void
}

interface Props {
  query: string
  onQuery: (q: string) => void
  placeholder?: string
  filters: FilterDef[]
}

export default function FilterBar({ query, onQuery, placeholder, filters }: Props) {
  const [openKey, setOpenKey] = useState<string | null>(null)
  const barRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setOpenKey(null)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  return (
    <div
      ref={barRef}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        marginBottom: 14,
      }}
    >
      {/* ── Search ── */}
      <div style={{ position: 'relative', flex: 1, maxWidth: 340 }}>
        <svg
          width="13" height="13" viewBox="0 0 24 24" fill="none"
          stroke="#9b9890" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
        >
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          value={query}
          onChange={e => onQuery(e.target.value)}
          placeholder={placeholder}
          style={{
            width: '100%', boxSizing: 'border-box',
            background: 'white',
            border: '0.5px solid rgba(0,0,0,0.1)',
            borderRadius: 9, padding: '7px 30px 7px 30px',
            fontSize: 13, color: '#1a1a18', outline: 'none', fontFamily: 'inherit',
          }}
        />
        {query && (
          <button
            onClick={() => onQuery('')}
            style={{
              position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', color: '#9b9890',
              display: 'flex', alignItems: 'center', padding: 2,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        )}
      </div>

      {/* ── Filter dropdowns ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
        {filters.map(f => {
          const activeOpt  = f.options.find(o => o.value === f.active) ?? f.options[0]
          const isFiltered = f.active !== 'all' && f.active !== f.options[0]?.value
          const isOpen     = openKey === f.key

          return (
            <div key={f.key} style={{ position: 'relative' }}>
              {/* Trigger button */}
              <button
                onClick={() => setOpenKey(isOpen ? null : f.key)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '6px 11px',
                  border: isFiltered
                    ? '0.5px solid rgba(26,26,24,0.35)'
                    : '0.5px solid rgba(0,0,0,0.1)',
                  borderRadius: 8,
                  background: isFiltered ? 'rgba(26,26,24,0.05)' : 'white',
                  fontSize: 12, fontWeight: isFiltered ? 600 : 400,
                  color: isFiltered ? '#1a1a18' : '#6b6960',
                  cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'border-color 0.12s, background 0.12s',
                  whiteSpace: 'nowrap',
                }}
              >
                {activeOpt.label}
                <svg
                  width="10" height="10" viewBox="0 0 12 12" fill="none"
                  style={{ opacity: 0.45, transition: 'transform 0.15s', transform: isOpen ? 'rotate(180deg)' : 'none' }}
                >
                  <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>

              {/* Dropdown */}
              {isOpen && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 6px)', right: 0,
                  background: '#1e1e1c',
                  borderRadius: 10,
                  boxShadow: '0 8px 28px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.14)',
                  overflow: 'hidden',
                  minWidth: 160,
                  zIndex: 200,
                }}>
                  {f.options.map((opt, i) => {
                    const isActive = f.active === opt.value
                    return (
                      <button
                        key={opt.value}
                        onClick={() => { f.onChange(opt.value); setOpenKey(null) }}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          width: '100%', padding: '9px 14px',
                          background: 'none',
                          border: 'none',
                          borderTop: i === 0 ? 'none' : '0.5px solid rgba(255,255,255,0.06)',
                          color: isActive ? 'white' : 'rgba(255,255,255,0.65)',
                          fontSize: 13, fontWeight: isActive ? 500 : 400,
                          cursor: 'pointer', fontFamily: 'inherit',
                          textAlign: 'left',
                          transition: 'color 0.1s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'white')}
                        onMouseLeave={e => (e.currentTarget.style.color = isActive ? 'white' : 'rgba(255,255,255,0.65)')}
                      >
                        {opt.label}
                        {isActive && (
                          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginLeft: 8 }}>
                            <path d="M3 8l3.5 3.5L13 4.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
