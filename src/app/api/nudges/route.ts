import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'
import { getOrgContext } from '@/lib/org-context'

export async function GET() {
  await cookies()
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json([])

  const { data: membership } = await supabase
    .from('organisation_members')
    .select('org_id')
    .eq('user_id', user.id)
    .single()

  if (!membership) return NextResponse.json([])

  // Fetch org context to get custom at_risk_days threshold
  const orgContext = await getOrgContext(membership.org_id)
  const AT_RISK_DAYS = orgContext.at_risk_days || 14

  const { data: deals } = await supabase
    .from('deals')
    .select('id, name, value, stage, payment_status, updated_at')
    .eq('org_id', membership.org_id)
    .not('stage', 'in', '(closed_lost)')

  if (!deals) return NextResponse.json([])

  const now = Date.now()
  const DAY = 86400000
  const nudges = []

  for (const deal of deals) {
    const days = (now - new Date(deal.updated_at).getTime()) / DAY

    if (deal.stage === 'closed_won' && deal.payment_status === 'none' && days > 7) {
      nudges.push({
        id: `uninvoiced-${deal.id}`, deal_id: deal.id, deal_name: deal.name,
        type: 'uninvoiced', urgency: days > 14 ? 'high' : 'medium',
        message: `Closed ${Math.round(days)} days ago — has an invoice been sent?`,
      })
    }

    if (deal.payment_status === 'invoiced' && days > 30) {
      nudges.push({
        id: `unpaid-${deal.id}`, deal_id: deal.id, deal_name: deal.name,
        type: 'at_risk', urgency: 'high',
        message: `Invoiced ${Math.round(days)} days ago — follow up on payment?`,
      })
    }

    if (!['closed_won', 'closed_lost', 'lead'].includes(deal.stage) && days > AT_RISK_DAYS) {
      nudges.push({
        id: `inactive-${deal.id}`, deal_id: deal.id, deal_name: deal.name,
        type: 'no_activity', urgency: days > AT_RISK_DAYS * 1.5 ? 'high' : 'medium',
        message: `No activity in ${Math.round(days)} days — time to follow up?`,
      })
    }
  }

  return NextResponse.json(
    nudges.sort((a, b) => (a.urgency === 'high' ? -1 : 1)).slice(0, 3)
  )
}
