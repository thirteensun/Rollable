'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import Link from 'next/link'

// ── Types ────────────────────────────────────────────────────────────────────

interface SearchResult {
  intent: 'lookup' | 'analytics' | 'action' | 'empty'
  contacts?: any[]
  deals?: any[]
  companies?: any[]
  metrics?: {
    total_pipeline: number
    confirmed_revenue: number
    active_deals: number
    at_risk_count: number
    won_count: number
    lost_count: number
  }
  pipeline_by_stage?: { stage: string; count: number; value: number }[]
  at_risk_deals?: { id: string; name: string; stage: string; value: number; days_inactive: number }[]
  action_type?: string
  action_summary?: string
  original_query?: string
}

// ── Suggestion chips ──────────────────────────────────────────────────────────
// Easy to add/remove — just edit this array

const SUGGESTIONS = [
  {
    label: 'Pipeline health',
    query: 'How is my pipeline looking?',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/>
        <line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    ),
  },
  {
    label: 'At risk',
    query: 'Which deals are at risk?',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    ),
  },
  {
    label: 'Revenue',
    query: 'What is my confirmed revenue?',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23"/>
        <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
      </svg>
    ),
  },
  {
    label: 'No activity',
    query: 'Which deals have had no activity recently?',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
    ),
  },
  {
    label: 'Hot leads',
    query: 'Show me my hottest leads',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
      </svg>
    ),
  },
  {
    label: 'Won deals',
    query: 'Show me all closed won deals',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    ),
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

const STAGE_LABELS: Record<string, string> = {
  lead: 'Lead', qualified: 'Qualified', demo: 'Demo',
  proposal: 'Proposal', negotiation: 'Negotiation',
  closed_won: 'Won', closed_lost: 'Lost',
}

const STAGE_COLORS: Record<string, string> = {
  lead: '#9b9890', qualified: '#6b6960', demo: '#EF9F27',
  proposal: '#185FA5', negotiation: '#534AB7',
  closed_won: '#1D9E75', closed_lost: '#E24B4A',
}

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n}`
}

function StagePill({ stage }: { stage: string }) {
  return (
    <span style={{
      fontSize: '10px', fontWeight: 500,
      color: STAGE_COLORS[stage] ?? '#9b9890',
      background: `${STAGE_COLORS[stage] ?? '#9b9890'}18`,
      borderRadius: '5px', padding: '2px 7px',
    }}>
      {STAGE_LABELS[stage] ?? stage}
    </span>
  )
}

// ── Result renderers ──────────────────────────────────────────────────────────

function LookupResults({ contacts, deals, companies }: { contacts: any[]; deals: any[]; companies: any[] }) {
  const hasResults = contacts.length + deals.length + companies.length > 0
  if (!hasResults) return (
    <div style={{ padding: '40px 0', textAlign: 'center' }}>
      <p style={{ margin: 0, fontSize: '14px', color: '#9b9890' }}>No results found</p>
    </div>
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {contacts.map((c) => (
        <Link key={c.id} href={`/contacts/${c.id}`} style={{ textDecoration: 'none' }}>
          <div style={{ background: '#f5f4f0', borderRadius: '12px', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, flexShrink: 0, background: '#E6F1FB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: '#185FA5' }}>
              {c.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: '#1a1a18' }}>{c.full_name}</p>
              <p style={{ margin: '1px 0 0', fontSize: 12, color: '#9b9890' }}>{[c.role, c.companies?.name].filter(Boolean).join(' · ')}</p>
            </div>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="#c8c5be" strokeWidth="1.3" strokeLinecap="round"/></svg>
          </div>
        </Link>
      ))}
      {deals.map((d) => (
        <Link key={d.id} href={`/tracking/deals/${d.id}`} style={{ textDecoration: 'none' }}>
          <div style={{ background: '#f5f4f0', borderRadius: '12px', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, flexShrink: 0, background: '#E1F5EE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0F6E56" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: '#1a1a18' }}>{d.name}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                <StagePill stage={d.stage} />
                {d.value && <span style={{ fontSize: 12, color: '#9b9890' }}>{formatCurrency(d.value)}</span>}
              </div>
            </div>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="#c8c5be" strokeWidth="1.3" strokeLinecap="round"/></svg>
          </div>
        </Link>
      ))}
      {companies.map((c) => (
        <Link key={c.id} href={`/companies/${c.id}`} style={{ textDecoration: 'none' }}>
          <div style={{ background: '#f5f4f0', borderRadius: '12px', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, flexShrink: 0, background: '#FAEEDA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#854F0B" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: '#1a1a18' }}>{c.name}</p>
              {c.industry && <p style={{ margin: '1px 0 0', fontSize: 12, color: '#9b9890' }}>{c.industry}</p>}
            </div>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="#c8c5be" strokeWidth="1.3" strokeLinecap="round"/></svg>
          </div>
        </Link>
      ))}
    </div>
  )
}

function AnalyticsResults({ metrics, pipeline_by_stage, at_risk_deals }: { metrics: any; pipeline_by_stage: any[]; at_risk_deals: any[] }) {
  const chartStages = (pipeline_by_stage ?? []).filter(s => s.count > 0 && s.stage !== 'closed_lost')
  const maxValue = Math.max(...chartStages.map(s => s.value), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        {[
          { label: 'Pipeline', value: formatCurrency(metrics.total_pipeline), color: '#185FA5' },
          { label: 'Won', value: formatCurrency(metrics.confirmed_revenue), color: '#1D9E75' },
          { label: 'Active deals', value: String(metrics.active_deals), color: '#534AB7' },
          { label: 'At risk', value: String(metrics.at_risk_count), color: '#E24B4A' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: '#f5f4f0', borderRadius: 12, padding: '12px 14px' }}>
            <p style={{ margin: '0 0 2px', fontSize: 11, color: '#9b9890', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
            <p style={{ margin: 0, fontSize: 20, fontWeight: 600, color }}>{value}</p>
          </div>
        ))}
      </div>
      {chartStages.length > 0 && (
        <div style={{ background: '#f5f4f0', borderRadius: 12, padding: 14 }}>
          <p style={{ margin: '0 0 12px', fontSize: 11, color: '#9b9890', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Pipeline by stage</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {chartStages.map(s => (
              <div key={s.stage}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: '#6b6960' }}>{STAGE_LABELS[s.stage]}</span>
                  <span style={{ fontSize: 12, color: '#9b9890' }}>{s.count} · {formatCurrency(s.value)}</span>
                </div>
                <div style={{ height: 5, background: 'rgba(0,0,0,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 3, background: STAGE_COLORS[s.stage] ?? '#9b9890', width: `${Math.round((s.value / maxValue) * 100)}%`, transition: 'width 0.5s ease' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {at_risk_deals && at_risk_deals.length > 0 && (
        <div style={{ background: '#f5f4f0', borderRadius: 12, padding: 14 }}>
          <p style={{ margin: '0 0 10px', fontSize: 11, color: '#E24B4A', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Needs attention</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {at_risk_deals.map(d => (
              <Link key={d.id} href={`/tracking/deals/${d.id}`} style={{ textDecoration: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: '#1a1a18' }}>{d.name}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: '#9b9890' }}>No activity {d.days_inactive}d</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <StagePill stage={d.stage} />
                    {d.value > 0 && <p style={{ margin: '3px 0 0', fontSize: 12, color: '#9b9890' }}>{formatCurrency(d.value)}</p>}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ActionResult({ summary, onConfirm, onDismiss, loading }: { summary: string; onConfirm: () => void; onDismiss: () => void; loading: boolean }) {
  return (
    <div style={{ background: '#f5f4f0', borderRadius: 12, padding: 16 }}>
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, background: '#E1F5EE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="2.5"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>
        </div>
        <div>
          <p style={{ margin: '0 0 2px', fontSize: 11, color: '#9b9890', textTransform: 'uppercase', letterSpacing: '0.04em' }}>AI will do this</p>
          <p style={{ margin: 0, fontSize: 14, color: '#1a1a18', lineHeight: 1.4 }}>{summary}</p>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onDismiss} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '0.5px solid rgba(0,0,0,0.1)', background: 'transparent', fontSize: 13, color: '#6b6960', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
        <button onClick={onConfirm} disabled={loading} style={{ flex: 2, padding: '10px', borderRadius: 10, border: 'none', background: '#1a1a18', fontSize: 13, fontWeight: 500, color: 'white', cursor: loading ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Doing it...' : 'Yes, do it'}
        </button>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CommandBar() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionDone, setActionDone] = useState(false)
  const [result, setResult] = useState<SearchResult | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 120)
  }, [open])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) return
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      })
      setResult(await res.json())
    } catch {
      setResult(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); doSearch(query) }

  const handleSuggestion = (s: typeof SUGGESTIONS[0]) => {
    setQuery(s.query)
    doSearch(s.query)
  }

  const handleConfirmAction = async () => {
    if (!result?.original_query) return
    setActionLoading(true)
    try {
      await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: result.original_query, history: [] }),
      })
      setActionDone(true)
      setTimeout(closeSheet, 1500)
    } catch { setActionLoading(false) }
  }

  const closeSheet = () => {
    setOpen(false)
    setQuery('')
    setResult(null)
    setActionDone(false)
    setActionLoading(false)
  }

  return (
    <>
      {/* Bar on home — tap to open */}
      <div style={{ padding: '0 20px 16px' }}>
        <button onClick={() => setOpen(true)} style={{
          width: '100%', background: 'white', borderRadius: 16,
          border: '0.5px solid rgba(0,0,0,0.07)',
          padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10,
          cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
        }}>
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
            <circle cx="7" cy="7" r="5.5" stroke="#9b9890" strokeWidth="1.2"/>
            <path d="M11 11l2.5 2.5" stroke="#9b9890" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          <span style={{ fontSize: 14, color: '#9b9890', flex: 1 }}>Ask about deals, pipeline, contacts...</span>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#c8c5be" strokeWidth="1.8" strokeLinecap="round">
            <polyline points="18 15 12 9 6 15"/>
          </svg>
        </button>
      </div>

      {/* Backdrop */}
      {open && (
        <div onClick={closeSheet} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)',
          zIndex: 50, backdropFilter: 'blur(2px)',
          animation: 'fadeIn 0.2s ease',
        }} />
      )}

      {/* Bottom sheet */}
      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 51,
        background: 'white', borderRadius: '20px 20px 0 0',
        boxShadow: '0 -4px 40px rgba(0,0,0,0.12)',
        transform: open ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 0.32s cubic-bezier(0.32, 0.72, 0, 1)',
        maxHeight: '90dvh', display: 'flex', flexDirection: 'column',
      }}>

        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(0,0,0,0.1)' }} />
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} style={{ padding: '8px 16px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#f5f4f0', borderRadius: 14, padding: '12px 14px' }}>
            {loading ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9b9890" strokeWidth="2" style={{ flexShrink: 0 }}>
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83">
                  <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite"/>
                </path>
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                <circle cx="7" cy="7" r="5.5" stroke="#9b9890" strokeWidth="1.2"/>
                <path d="M11 11l2.5 2.5" stroke="#9b9890" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
            )}
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Ask anything about your pipeline..."
              style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 15, color: '#1a1a18', fontFamily: 'inherit' }}
            />
            {query ? (
              <button type="button" onClick={() => { setQuery(''); setResult(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9b9890', padding: 0, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            ) : (
              <button type="button" onClick={closeSheet} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#9b9890', fontFamily: 'inherit', padding: 0, flexShrink: 0 }}>
                Cancel
              </button>
            )}
          </div>
        </form>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 40px' }}>

          {/* Default: suggestions */}
          {!result && !loading && (
            <>
              <p style={{ margin: '4px 0 12px', fontSize: 11, fontWeight: 500, color: '#9b9890', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Suggested
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.label}
                    onClick={() => handleSuggestion(s)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      background: '#f5f4f0', borderRadius: 20,
                      border: '0.5px solid rgba(0,0,0,0.07)',
                      padding: '8px 14px', cursor: 'pointer',
                      fontSize: 13, color: '#1a1a18', fontFamily: 'inherit',
                    }}
                  >
                    <span style={{ color: '#6b6960', display: 'flex', alignItems: 'center' }}>{s.icon}</span>
                    {s.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Loading skeletons */}
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 8 }}>
              {[1, 0.7, 0.4].map((op, i) => (
                <div key={i} style={{ height: 56, borderRadius: 12, background: '#f5f4f0', opacity: op }} />
              ))}
            </div>
          )}

          {/* Results */}
          {result && !loading && (
            <div style={{ animation: 'fadeUp 0.2s ease' }}>
              {result.intent === 'lookup' && (
                <LookupResults contacts={result.contacts ?? []} deals={result.deals ?? []} companies={result.companies ?? []} />
              )}
              {result.intent === 'analytics' && result.metrics && (
                <AnalyticsResults metrics={result.metrics} pipeline_by_stage={result.pipeline_by_stage ?? []} at_risk_deals={result.at_risk_deals ?? []} />
              )}
              {result.intent === 'action' && !actionDone && (
                <ActionResult summary={result.action_summary ?? result.original_query ?? ''} onConfirm={handleConfirmAction} onDismiss={closeSheet} loading={actionLoading} />
              )}
              {result.intent === 'action' && actionDone && (
                <div style={{ background: '#E1F5EE', borderRadius: 12, padding: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="2.5"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>
                  <p style={{ margin: 0, fontSize: 14, color: '#1D9E75', fontWeight: 500 }}>Done!</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>
    </>
  )
}