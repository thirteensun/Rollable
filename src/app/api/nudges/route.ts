import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'

export async function GET() {
  await cookies()
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json([])

  const { data: membership } = await supabase
    .from('organisation_members')
    .select('organisation_id')
    .eq('user_id', user.id)
    .single()

  if (!membership) return NextResponse.json([])

  const { data: deals } = await supabase
    .from('deals')
    .select('id, name, value, stage, payment_status, updated_at')
    .eq('organisation_id', membership.organisation_id)
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
    if (!['closed_won', 'closed_lost', 'lead'].includes(deal.stage) && days > 14) {
      nudges.push({
        id: `inactive-${deal.id}`, deal_id: deal.id, deal_name: deal.name,
        type: 'no_activity', urgency: days > 21 ? 'high' : 'medium',
        message: `No activity in ${Math.round(days)} days — time to follow up?`,
      })
    }
  }

  return NextResponse.json(
    nudges.sort((a, b) => (a.urgency === 'high' ? -1 : 1)).slice(0, 3)
  )
}