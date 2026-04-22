'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Nudge {
  id: string
  type: 'stalled_deal' | 'overdue_followup' | 'closing_soon' | 'uninvoiced_won' | 'relationship_decay'
  urgency: 'high' | 'medium' | 'low'
  title: string
  body: string
  deal?: { id: string; name: string; value: number | null; stage: string; currency?: string }
  contact?: { id: string; full_name: string; role: string | null }
  company?: { id: string; name: string } | null
  days: number
  action_label: string
  action_href: string
}

// Initials avatar from a name string
function Initials({ name, size = 28 }: { name: string; size?: number }) {
  const parts = name.trim().split(' ')
  const letters = parts.length >= 2
    ? parts[0][0] + parts[parts.length - 1][0]
    : name.slice(0, 2)
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: 'rgba(0,0,0,0.06)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.36, fontWeight: 500, color: '#6b6960',
      letterSpacing: '-0.01em',
    }}>
      {letters.toUpperCase()}
    </div>
  )
}

// Type icon — minimal SVG, 16×16
function NudgeIcon({ type, color }: { type: Nudge['type']; color: string }) {
  const s = { width: 15, height: 15, stroke: color, fill: 'none', strokeWidth: '1.8', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  if (type === 'stalled_deal') return (
    <svg viewBox="0 0 24 24" {...s}>
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  )
  if (type === 'overdue_followup') return (
    <svg viewBox="0 0 24 24" {...s}>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  )
  if (type === 'closing_soon') return (
    <svg viewBox="0 0 24 24" {...s}>
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  )
  if (type === 'uninvoiced_won') return (
    <svg viewBox="0 0 24 24" {...s}>
      <line x1="12" y1="1" x2="12" y2="23"/>
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
  )
  // relationship_decay
  return (
    <svg viewBox="0 0 24 24" {...s}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  )
}

function formatValue(value: number | null | undefined, currency = 'EUR') {
  if (!value) return null
  return new Intl.NumberFormat('en', {
    style: 'currency', currency, maximumFractionDigits: 0, notation: 'compact',
  }).format(value)
}

const URGENCY_COLORS = {
  high:   { icon: '#E24B4A', iconBg: 'rgba(226,75,74,0.08)',  border: 'rgba(226,75,74,0.18)'  },
  medium: { icon: '#EF9F27', iconBg: 'rgba(239,159,39,0.08)', border: 'rgba(0,0,0,0.07)'       },
  low:    { icon: '#6b6960', iconBg: 'rgba(0,0,0,0.05)',      border: 'rgba(0,0,0,0.07)'       },
}

const TYPE_LABEL: Record<Nudge['type'], string> = {
  stalled_deal:       'Stalled',
  overdue_followup:   'Follow-up due',
  closing_soon:       'Closing soon',
  uninvoiced_won:     'Invoice needed',
  relationship_decay: 'No recent contact',
}

export default function AIProactiveNudges() {
  const [nudges, setNudges] = useState<Nudge[]>([])
  const [loading, setLoading] = useState(true)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch('/api/nudges')
      .then(r => r.json())
      .then(data => { setNudges(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const visible = nudges.filter(n => !dismissed.has(n.id))
  if (loading || visible.length === 0) return null

  const dismiss = (id: string) =>
    setDismissed(prev => new Set([...Array.from(prev), id]))

  return (
    <div>
      {/* Section label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%', background: '#1D9E75',
          display: 'inline-block', flexShrink: 0,
        }}/>
        <span style={{
          fontSize: 11, color: '#9b9890', textTransform: 'uppercase',
          letterSpacing: '0.06em', fontWeight: 500,
        }}>
          AI Signals · {visible.length}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {visible.map(nudge => {
          const colors = URGENCY_COLORS[nudge.urgency]
          // Subtitle line: show entity name below deal name (contact or company)
          const subName = nudge.contact?.full_name ?? nudge.company?.name ?? null
          const subRole = nudge.contact?.role ?? null
          const dealValue = formatValue(nudge.deal?.value, nudge.deal?.currency)

          return (
            <div
              key={nudge.id}
              style={{
                background: 'white',
                borderRadius: 14,
                border: `0.5px solid ${colors.border}`,
                padding: '11px 12px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
              }}
            >
              {/* Icon */}
              <div style={{
                width: 30, height: 30, borderRadius: 9, flexShrink: 0,
                background: colors.iconBg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginTop: 1,
              }}>
                <NudgeIcon type={nudge.type} color={colors.icon} />
              </div>

              {/* Body */}
              <Link href={nudge.action_href} style={{ flex: 1, textDecoration: 'none', minWidth: 0 }}>
                {/* Type tag */}
                <div style={{
                  fontSize: 10, fontWeight: 600, letterSpacing: '0.04em',
                  color: colors.icon, textTransform: 'uppercase', marginBottom: 3,
                }}>
                  {TYPE_LABEL[nudge.type]}
                </div>

                {/* Title row: name + value badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{
                    fontSize: 13, fontWeight: 600, color: '#1a1a18',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {nudge.title}
                  </span>
                  {dealValue && (
                    <span style={{
                      fontSize: 11, fontWeight: 500, color: '#6b6960',
                      background: 'rgba(0,0,0,0.05)', borderRadius: 6,
                      padding: '1px 6px', flexShrink: 0,
                    }}>
                      {dealValue}
                    </span>
                  )}
                </div>

                {/* Body message */}
                <div style={{ fontSize: 12, color: '#6b6960', lineHeight: 1.4 }}>
                  {nudge.body}
                </div>

                {/* Sub-entity: contact or company below the message */}
                {subName && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    marginTop: 6,
                  }}>
                    <Initials name={subName} size={18} />
                    <span style={{ fontSize: 11, color: '#9b9890' }}>
                      {subName}{subRole ? ` · ${subRole}` : ''}
                    </span>
                  </div>
                )}

                {/* Action link */}
                <div style={{
                  marginTop: 7, fontSize: 12, fontWeight: 500,
                  color: '#1a1a18', display: 'flex', alignItems: 'center', gap: 3,
                }}>
                  {nudge.action_label}
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5"
                    strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                </div>
              </Link>

              {/* Dismiss */}
              <button
                onClick={() => dismiss(nudge.id)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#c8c5be', padding: 2, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginTop: 1,
                }}
                aria-label="Dismiss"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5"
                  strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}