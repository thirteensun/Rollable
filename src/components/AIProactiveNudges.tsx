'use client'

import { useEffect, useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase'
import Link from 'next/link'

interface Nudge {
  id: string
  deal_id: string
  deal_name: string
  message: string
  type: 'uninvoiced' | 'at_risk' | 'no_activity'
  urgency: 'high' | 'medium'
}

export default function AIProactiveNudges() {
  const [nudges, setNudges] = useState<Nudge[]>([])
  const [loading, setLoading] = useState(true)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  useEffect(() => {
    async function loadNudges() {
      const supabase = createBrowserSupabaseClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: membership } = await supabase
        .from('organisation_members')
        .select('organisation_id')
        .eq('user_id', user.id)
        .single()

      if (!membership) return

      const { data: deals } = await supabase
        .from('deals')
        .select('id, name, value, stage, payment_status, updated_at, confirmed_revenue')
        .eq('organisation_id', membership.organisation_id)
        .not('stage', 'in', '(closed_lost)')

      if (!deals) return

      const now = Date.now()
      const DAY = 86400000
      const generatedNudges: Nudge[] = []

      for (const deal of deals) {
        const daysSinceUpdate = (now - new Date(deal.updated_at).getTime()) / DAY

        // Closed won but no invoice after 7 days
        if (deal.stage === 'closed_won' && deal.payment_status === 'none' && daysSinceUpdate > 7) {
          generatedNudges.push({
            id: `uninvoiced-${deal.id}`,
            deal_id: deal.id,
            deal_name: deal.name,
            type: 'uninvoiced',
            urgency: daysSinceUpdate > 14 ? 'high' : 'medium',
            message: `Closed ${Math.round(daysSinceUpdate)} days ago — has an invoice been sent?`,
          })
        }

        // Invoiced but not paid after 30 days
        if (deal.payment_status === 'invoiced' && daysSinceUpdate > 30) {
          generatedNudges.push({
            id: `unpaid-${deal.id}`,
            deal_id: deal.id,
            deal_name: deal.name,
            type: 'at_risk',
            urgency: 'high',
            message: `Invoiced ${Math.round(daysSinceUpdate)} days ago — follow up on payment?`,
          })
        }

        // Active deal with no activity in 14 days
        if (!['closed_won', 'closed_lost', 'lead'].includes(deal.stage) && daysSinceUpdate > 14) {
          generatedNudges.push({
            id: `inactive-${deal.id}`,
            deal_id: deal.id,
            deal_name: deal.name,
            type: 'no_activity',
            urgency: daysSinceUpdate > 21 ? 'high' : 'medium',
            message: `No activity in ${Math.round(daysSinceUpdate)} days — time to follow up?`,
          })
        }
      }

      // Sort by urgency, limit to 3
      const sorted = generatedNudges
        .sort((a, b) => (a.urgency === 'high' ? -1 : 1))
        .slice(0, 3)

      setNudges(sorted)
      setLoading(false)
    }

    loadNudges()
  }, [])

  const visible = nudges.filter(n => !dismissed.has(n.id))
  if (loading || visible.length === 0) return null

  const NUDGE_ICONS: Record<string, JSX.Element> = {
    uninvoiced: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
      </svg>
    ),
    at_risk: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
      </svg>
    ),
    no_activity: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
      </svg>
    ),
  }

  return (
    <div style={{ padding: '0 20px', marginBottom: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="#1D9E75" stroke="none">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 6v6l4 2" stroke="white" strokeWidth="2" fill="none"/>
        </svg>
        <span style={{ fontSize: 11, color: '#9b9890', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500 }}>
          AI Insights
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {visible.map(nudge => (
          <div
            key={nudge.id}
            style={{
              background: 'white',
              borderRadius: 14,
              border: `0.5px solid ${nudge.urgency === 'high' ? 'rgba(226,75,74,0.2)' : 'rgba(0,0,0,0.07)'}`,
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <div style={{
              width: 28, height: 28, borderRadius: 8, flexShrink: 0,
              background: nudge.urgency === 'high' ? 'rgba(226,75,74,0.08)' : 'rgba(239,159,39,0.08)',
              color: nudge.urgency === 'high' ? '#E24B4A' : '#EF9F27',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {NUDGE_ICONS[nudge.type]}
            </div>

            <Link href={`/tracking/deals/${nudge.deal_id}`} style={{ flex: 1, textDecoration: 'none' }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#1a1a18', marginBottom: 1 }}>
                {nudge.deal_name}
              </p>
              <p style={{ fontSize: 12, color: '#6b6960' }}>{nudge.message}</p>
            </Link>

            <button
              onClick={() => setDismissed(prev => new Set([...Array.from(prev), nudge.id]))}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9b9890', padding: 4, flexShrink: 0 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
