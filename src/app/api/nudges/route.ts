import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'
import { getOrgContext } from '@/lib/org-context'

export interface Nudge {
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

const URGENCY_RANK = { high: 0, medium: 1, low: 2 }

export async function GET() {
  await cookies()
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json([])

  const { data: membership } = await supabase
    .from('organisation_members')
    .select('org_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) return NextResponse.json([])

  const orgContext = await getOrgContext(membership.org_id)
  const atRiskDays: number = orgContext?.at_risk_days ?? 14

  const now = new Date()
  const DAY = 1000 * 60 * 60 * 24
  const nudges: Nudge[] = []

  // ── 1. STALLED DEALS ────────────────────────────────────────────────────────
  // Active-stage deals where last *event* is older than atRiskDays.
  // We use events table (real activity) not updated_at (can be touched by anything).
  const activeStages = ['qualified', 'demo', 'proposal', 'negotiation']

  const { data: activeDeals } = await supabase
    .from('deals')
    .select(`
      id, name, value, stage, currency,
      deal_contacts(contact:contacts(id, full_name, role)),
      companies(id, name),
      events(created_at)
    `)
    .eq('org_id', membership.org_id)
    .in('stage', activeStages)
    .order('value', { ascending: false })
    .limit(30)

  for (const deal of activeDeals ?? []) {
    const events = (deal.events as { created_at: string }[]) ?? []
    const lastEvent = events.length > 0
      ? new Date(Math.max(...events.map(e => new Date(e.created_at).getTime())))
      : null

    const daysSince = lastEvent
      ? Math.floor((now.getTime() - lastEvent.getTime()) / DAY)
      : 999

    if (daysSince < atRiskDays) continue

    const contact = (deal.deal_contacts as any[])?.[0]?.contact ?? null
    const company = Array.isArray(deal.companies) ? deal.companies[0] ?? null : deal.companies ?? null
    const isHighRisk = deal.stage === 'proposal' || deal.stage === 'negotiation'
    const stageLabel = deal.stage.charAt(0).toUpperCase() + deal.stage.slice(1)

    nudges.push({
      id: `stalled_${deal.id}`,
      type: 'stalled_deal',
      urgency: isHighRisk ? 'high' : 'medium',
      title: deal.name,
      body: lastEvent
        ? `${stageLabel} · no activity for ${daysSince} days`
        : `${stageLabel} · no activity logged yet`,
      deal: { id: deal.id, name: deal.name, value: deal.value, stage: deal.stage, currency: deal.currency },
      contact,
      company,
      days: daysSince,
      action_label: 'Log activity',
      action_href: `/deals/${deal.id}`,
    })
  }

  // ── 2. OVERDUE FOLLOW-UPS ────────────────────────────────────────────────────
  // Contacts with next_followup_date in the past, no event logged since that date.
  const { data: overdueContacts } = await supabase
    .from('contacts')
    .select(`
      id, full_name, role, next_followup_date,
      companies(id, name),
      deal_contacts(deal:deals(id, name, value, stage, currency)),
      events(created_at)
    `)
    .eq('org_id', membership.org_id)
    .not('next_followup_date', 'is', null)
    .lt('next_followup_date', now.toISOString())
    .order('next_followup_date', { ascending: true })
    .limit(10)

  for (const contact of overdueContacts ?? []) {
    const followupDate = new Date(contact.next_followup_date!)
    const daysOverdue = Math.floor((now.getTime() - followupDate.getTime()) / DAY)

    // Skip if there's been an event after the followup date
    const events = (contact.events as { created_at: string }[]) ?? []
    const hasActivity = events.some(e => new Date(e.created_at) > followupDate)
    if (hasActivity) continue

    const deal = (contact.deal_contacts as any[])?.[0]?.deal ?? null
    const company = Array.isArray(contact.companies) ? contact.companies[0] ?? null : contact.companies ?? null

    nudges.push({
      id: `followup_${contact.id}`,
      type: 'overdue_followup',
      urgency: daysOverdue >= 7 ? 'high' : 'medium',
      title: contact.full_name,
      body: `Follow-up overdue by ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''}`,
      deal,
      contact: { id: contact.id, full_name: contact.full_name, role: contact.role },
      company,
      days: daysOverdue,
      action_label: 'Log follow-up',
      action_href: `/contacts/${contact.id}`,
    })
  }

  // ── 3. CLOSING SOON BUT STUCK IN EARLY STAGE ────────────────────────────────
  // Deals with expected_close_date within 14 days still in lead/qualified/demo.
  const soonCutoff = new Date(now)
  soonCutoff.setDate(soonCutoff.getDate() + 14)

  const { data: closingSoon } = await supabase
    .from('deals')
    .select(`
      id, name, value, stage, currency, expected_close_date,
      deal_contacts(contact:contacts(id, full_name, role)),
      companies(id, name)
    `)
    .eq('org_id', membership.org_id)
    .in('stage', ['lead', 'qualified', 'demo'])
    .not('expected_close_date', 'is', null)
    .lte('expected_close_date', soonCutoff.toISOString())
    .gte('expected_close_date', now.toISOString())
    .order('expected_close_date', { ascending: true })
    .limit(5)

  for (const deal of closingSoon ?? []) {
    const closeDate = new Date(deal.expected_close_date!)
    const daysUntil = Math.ceil((closeDate.getTime() - now.getTime()) / DAY)
    const contact = (deal.deal_contacts as any[])?.[0]?.contact ?? null
    const company = Array.isArray(deal.companies) ? deal.companies[0] ?? null : deal.companies ?? null
    const stageLabel = deal.stage.charAt(0).toUpperCase() + deal.stage.slice(1)

    nudges.push({
      id: `closing_${deal.id}`,
      type: 'closing_soon',
      urgency: daysUntil <= 5 ? 'high' : 'medium',
      title: deal.name,
      body: `Closing in ${daysUntil} day${daysUntil !== 1 ? 's' : ''} · still in ${stageLabel}`,
      deal: { id: deal.id, name: deal.name, value: deal.value, stage: deal.stage, currency: deal.currency },
      contact,
      company,
      days: daysUntil,
      action_label: 'Update stage',
      action_href: `/deals/${deal.id}`,
    })
  }

  // ── 4. UNINVOICED WON DEALS ──────────────────────────────────────────────────
  // Deals marked closed_won with payment_status 'none' — money not yet chased.
  const { data: uninvoiced } = await supabase
    .from('deals')
    .select(`
      id, name, value, currency, closed_at,
      deal_contacts(contact:contacts(id, full_name, role)),
      companies(id, name)
    `)
    .eq('org_id', membership.org_id)
    .eq('stage', 'closed_won')
    .eq('payment_status', 'none')
    .order('closed_at', { ascending: true })
    .limit(5)

  for (const deal of uninvoiced ?? []) {
    const closedDate = deal.closed_at ? new Date(deal.closed_at) : null
    const daysWon = closedDate ? Math.floor((now.getTime() - closedDate.getTime()) / DAY) : 0
    const contact = (deal.deal_contacts as any[])?.[0]?.contact ?? null
    const company = Array.isArray(deal.companies) ? deal.companies[0] ?? null : deal.companies ?? null

    nudges.push({
      id: `uninvoiced_${deal.id}`,
      type: 'uninvoiced_won',
      urgency: daysWon > 14 ? 'high' : 'medium',
      title: deal.name,
      body: `Won ${daysWon > 0 ? `${daysWon} days ago` : 'recently'} · no invoice logged`,
      deal: { id: deal.id, name: deal.name, value: deal.value, stage: 'closed_won', currency: deal.currency },
      contact,
      company,
      days: daysWon,
      action_label: 'Add invoice',
      action_href: `/deals/${deal.id}`,
    })
  }

  // ── 5. RELATIONSHIP DECAY ────────────────────────────────────────────────────
  // Key contacts on active deals with no event in 30+ days.
  const decayCutoff = new Date(now)
  decayCutoff.setDate(decayCutoff.getDate() - 30)

  const { data: decayContacts } = await supabase
    .from('contacts')
    .select(`
      id, full_name, role,
      companies(id, name),
      deal_contacts(deal:deals(id, name, value, stage, currency)),
      events(created_at)
    `)
    .eq('org_id', membership.org_id)
    .order('full_name')
    .limit(30)

  for (const contact of decayContacts ?? []) {
    // Only flag contacts linked to active deals
    const activeDealsForContact = ((contact.deal_contacts as any[]) ?? [])
      .filter(dc => dc.deal && activeStages.includes(dc.deal.stage))

    if (activeDealsForContact.length === 0) continue

    const events = (contact.events as { created_at: string }[]) ?? []
    const lastEvent = events.length > 0
      ? new Date(Math.max(...events.map(e => new Date(e.created_at).getTime())))
      : null

    const daysSince = lastEvent
      ? Math.floor((now.getTime() - lastEvent.getTime()) / DAY)
      : 999

    if (daysSince < 30) continue

    // Don't double-nudge if already caught by stalled_deal
    const alreadyNudged = nudges.some(n =>
      n.type === 'stalled_deal' &&
      activeDealsForContact.some(dc => dc.deal?.id === n.deal?.id)
    )
    if (alreadyNudged) continue

    const primaryDeal = activeDealsForContact[0]?.deal ?? null
    const company = Array.isArray(contact.companies) ? contact.companies[0] ?? null : contact.companies ?? null

    nudges.push({
      id: `decay_${contact.id}`,
      type: 'relationship_decay',
      urgency: daysSince > 45 ? 'high' : 'low',
      title: contact.full_name,
      body: `${daysSince} days since last contact · linked to ${activeDealsForContact.length} active deal${activeDealsForContact.length !== 1 ? 's' : ''}`,
      deal: primaryDeal,
      contact: { id: contact.id, full_name: contact.full_name, role: contact.role },
      company,
      days: daysSince,
      action_label: 'Log touchpoint',
      action_href: `/contacts/${contact.id}`,
    })
  }

  // Sort: high urgency first, then by days descending within urgency
  const sorted = nudges
    .sort((a, b) => {
      const urgencyDiff = URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency]
      return urgencyDiff !== 0 ? urgencyDiff : b.days - a.days
    })
    .slice(0, 5)

  return NextResponse.json(sorted)
}