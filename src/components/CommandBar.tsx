'use client'

import { useState, useRef, useCallback } from 'react'
import Link from 'next/link'

// ── Types ────────────────────────────────────────────────────────────────────

interface SearchResult {
  intent: 'lookup' | 'analytics' | 'action' | 'empty'
  // lookup
  contacts?: any[]
  deals?: any[]
  companies?: any[]
  // analytics
  analytics_type?: string
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
  // action
  action_type?: string
  action_summary?: string
  original_query?: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

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
      background: `${STAGE_COLORS[stage] ?? '#9b9890'}15`,
      borderRadius: '5px', padding: '2px 7px',
      textTransform: 'capitalize',
    }}>
      {STAGE_LABELS[stage] ?? stage}
    </span>
  )
}

// ── Result Renderers ──────────────────────────────────────────────────────────

function LookupResults({ contacts, deals, companies }: { contacts: any[]; deals: any[]; companies: any[] }) {
  const hasResults = contacts.length + deals.length + companies.length > 0

  if (!hasResults) return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <p style={{ margin: 0, fontSize: '14px', color: '#9b9890' }}>No results found</p>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {contacts.map((c, i) => (
        <Link key={c.id} href={`/contacts/${c.id}`} style={{ textDecoration: 'none' }}>
          <div style={{
            background: 'white', borderRadius: '12px',
            border: '0.5px solid rgba(0,0,0,0.07)',
            padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px',
          }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '10px', flexShrink: 0,
              background: '#E6F1FB', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: '11px', fontWeight: 600, color: '#185FA5',
            }}>
              {c.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: '#1a1a18' }}>{c.full_name}</p>
              <p style={{ margin: '1px 0 0', fontSize: '12px', color: '#9b9890' }}>
                {[c.role, c.companies?.name].filter(Boolean).join(' · ')}
              </p>
            </div>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M6 4l4 4-4 4" stroke="#c8c5be" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          </div>
        </Link>
      ))}

      {deals.map((d) => (
        <Link key={d.id} href={`/tracking/deals/${d.id}`} style={{ textDecoration: 'none' }}>
          <div style={{
            background: 'white', borderRadius: '12px',
            border: '0.5px solid rgba(0,0,0,0.07)',
            padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px',
          }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '10px', flexShrink: 0,
              background: '#E1F5EE', display: 'flex', alignItems: 'center',
              justifyContent: 'center',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0F6E56" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: '#1a1a18' }}>{d.name}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
                <StagePill stage={d.stage} />
                {d.value && <span style={{ fontSize: '12px', color: '#9b9890' }}>{formatCurrency(d.value)}</span>}
              </div>
            </div>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M6 4l4 4-4 4" stroke="#c8c5be" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          </div>
        </Link>
      ))}

      {companies.map((c) => (
        <Link key={c.id} href={`/companies/${c.id}`} style={{ textDecoration: 'none' }}>
          <div style={{
            background: 'white', borderRadius: '12px',
            border: '0.5px solid rgba(0,0,0,0.07)',
            padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px',
          }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '10px', flexShrink: 0,
              background: '#FAEEDA', display: 'flex', alignItems: 'center',
              justifyContent: 'center',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#854F0B" strokeWidth="2">
                <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/>
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: '#1a1a18' }}>{c.name}</p>
              {c.industry && <p style={{ margin: '1px 0 0', fontSize: '12px', color: '#9b9890' }}>{c.industry}</p>}
            </div>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M6 4l4 4-4 4" stroke="#c8c5be" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          </div>
        </Link>
      ))}
    </div>
  )
}

function AnalyticsResults({ metrics, pipeline_by_stage, at_risk_deals }: {
  metrics: any; pipeline_by_stage: any[]; at_risk_deals: any[]
}) {
  // Only show active stages in chart
  const chartStages = (pipeline_by_stage ?? []).filter(s => s.count > 0 && s.stage !== 'closed_lost')
  const maxValue = Math.max(...chartStages.map(s => s.value), 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

      {/* Headline metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        {[
          { label: 'Pipeline', value: formatCurrency(metrics.total_pipeline), color: '#185FA5', bg: '#E6F1FB' },
          { label: 'Won', value: formatCurrency(metrics.confirmed_revenue), color: '#1D9E75', bg: '#E1F5EE' },
          { label: 'Active deals', value: String(metrics.active_deals), color: '#534AB7', bg: '#EEEDFE' },
          { label: 'At risk', value: String(metrics.at_risk_count), color: '#E24B4A', bg: '#FCEBEB' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} style={{
            background: 'white', borderRadius: '12px',
            border: '0.5px solid rgba(0,0,0,0.07)', padding: '12px 14px',
          }}>
            <p style={{ margin: '0 0 2px', fontSize: '11px', color: '#9b9890', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
            <p style={{ margin: 0, fontSize: '20px', fontWeight: 600, color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Pipeline bar chart */}
      {chartStages.length > 0 && (
        <div style={{
          background: 'white', borderRadius: '12px',
          border: '0.5px solid rgba(0,0,0,0.07)', padding: '14px',
        }}>
          <p style={{ margin: '0 0 12px', fontSize: '11px', color: '#9b9890', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Pipeline by stage
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {chartStages.map(s => (
              <div key={s.stage}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '12px', color: '#6b6960' }}>{STAGE_LABELS[s.stage]}</span>
                  <span style={{ fontSize: '12px', color: '#9b9890' }}>
                    {s.count} deal{s.count !== 1 ? 's' : ''} · {formatCurrency(s.value)}
                  </span>
                </div>
                <div style={{ height: '5px', background: '#f5f4f0', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: '3px',
                    background: STAGE_COLORS[s.stage] ?? '#9b9890',
                    width: `${Math.round((s.value / maxValue) * 100)}%`,
                    transition: 'width 0.4s ease',
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* At-risk deals */}
      {at_risk_deals && at_risk_deals.length > 0 && (
        <div style={{
          background: 'white', borderRadius: '12px',
          border: '0.5px solid rgba(226,75,74,0.2)', padding: '14px',
        }}>
          <p style={{ margin: '0 0 10px', fontSize: '11px', color: '#E24B4A', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Needs attention
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {at_risk_deals.map(d => (
              <Link key={d.id} href={`/tracking/deals/${d.id}`} style={{ textDecoration: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: '13px', fontWeight: 500, color: '#1a1a18' }}>{d.name}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#9b9890' }}>
                      No activity for {d.days_inactive} days
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <StagePill stage={d.stage} />
                    {d.value > 0 && (
                      <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#9b9890' }}>{formatCurrency(d.value)}</p>
                    )}
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

function ActionResult({ summary, onConfirm, onDismiss, loading }: {
  summary: string; onConfirm: () => void; onDismiss: () => void; loading: boolean
}) {
  return (
    <div style={{
      background: 'white', borderRadius: '12px',
      border: '0.5px solid rgba(0,0,0,0.07)', padding: '16px',
    }}>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
        <div style={{
          width: '28px', height: '28px', borderRadius: '8px', flexShrink: 0,
          background: '#E1F5EE', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="2.5">
            <path d="M9 12l2 2 4-4"/>
            <circle cx="12" cy="12" r="10"/>
          </svg>
        </div>
        <div>
          <p style={{ margin: '0 0 2px', fontSize: '11px', color: '#9b9890', textTransform: 'uppercase', letterSpacing: '0.04em' }}>AI will do this</p>
          <p style={{ margin: 0, fontSize: '14px', color: '#1a1a18', lineHeight: 1.4 }}>{summary}</p>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={onDismiss}
          style={{
            flex: 1, padding: '10px', borderRadius: '10px',
            border: '0.5px solid rgba(0,0,0,0.1)', background: 'transparent',
            fontSize: '13px', color: '#6b6960', cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          style={{
            flex: 2, padding: '10px', borderRadius: '10px',
            border: 'none', background: '#1a1a18',
            fontSize: '13px', fontWeight: 500, color: 'white',
            cursor: loading ? 'wait' : 'pointer', fontFamily: 'inherit',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? 'Doing it...' : 'Yes, do it'}
        </button>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function CommandBar() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [result, setResult] = useState<SearchResult | null>(null)
  const [actionDone, setActionDone] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResult(null); return }
    setLoading(true)
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      })
      const data = await res.json()
      setResult(data)
    } catch {
      setResult(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    search(query)
    inputRef.current?.blur()
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
      setTimeout(() => { setResult(null); setQuery(''); setActionDone(false) }, 1500)
    } catch {
      setActionLoading(false)
    }
  }

  const dismiss = () => { setResult(null); setQuery('') }

  return (
    <div style={{ padding: '0 20px 16px' }}>

      {/* The bar */}
      <form onSubmit={handleSubmit}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          background: 'white', borderRadius: '16px',
          border: `0.5px solid ${result ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.07)'}`,
          padding: '12px 14px',
          transition: 'border-color 0.2s',
          boxShadow: result ? '0 2px 12px rgba(0,0,0,0.06)' : 'none',
        }}>
          {loading ? (
            <div style={{ width: 15, height: 15, flexShrink: 0 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9b9890" strokeWidth="2">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83">
                  <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite"/>
                </path>
              </svg>
            </div>
          ) : (
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
              <circle cx="7" cy="7" r="5.5" stroke="#9b9890" strokeWidth="1.2" />
              <path d="M11 11l2.5 2.5" stroke="#9b9890" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Ask about deals, contacts, pipeline..."
            style={{
              flex: 1, border: 'none', outline: 'none', background: 'transparent',
              fontSize: '14px', color: '#1a1a18', fontFamily: 'inherit',
            }}
          />
          {query && (
            <button
              type="button"
              onClick={dismiss}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#9b9890', padding: '0 2px', flexShrink: 0,
                display: 'flex', alignItems: 'center',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18M6 6l12 12"/>
              </svg>
            </button>
          )}
        </div>
      </form>

      {/* Inline results */}
      {result && (
        <div style={{ marginTop: '10px', animation: 'fadeUp 0.2s ease' }}>
          <style>{`@keyframes fadeUp { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:translateY(0) } }`}</style>

          {result.intent === 'lookup' && (
            <LookupResults
              contacts={result.contacts ?? []}
              deals={result.deals ?? []}
              companies={result.companies ?? []}
            />
          )}

          {result.intent === 'analytics' && result.metrics && (
            <AnalyticsResults
              metrics={result.metrics}
              pipeline_by_stage={result.pipeline_by_stage ?? []}
              at_risk_deals={result.at_risk_deals ?? []}
            />
          )}

          {result.intent === 'action' && !actionDone && (
            <ActionResult
              summary={result.action_summary ?? result.original_query ?? ''}
              onConfirm={handleConfirmAction}
              onDismiss={dismiss}
              loading={actionLoading}
            />
          )}

          {result.intent === 'action' && actionDone && (
            <div style={{
              background: '#E1F5EE', borderRadius: '12px', padding: '14px',
              display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="2.5">
                <path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/>
              </svg>
              <p style={{ margin: 0, fontSize: '14px', color: '#1D9E75', fontWeight: 500 }}>Done!</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
