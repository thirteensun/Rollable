import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'

export async function GET() {
  await cookies()
  const supabase = await createServerSupabaseClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ step: 'auth', error: userError })

  const { data: membership, error: memberError } = await supabase
    .from('organisation_members')
    .select('org_id, role, status')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) return NextResponse.json({ step: 'membership', error: memberError, user_id: user.id })

  const { data: uninvoiced, error: uninvoicedError } = await supabase
    .from('deals')
    .select('id, name, stage, payment_status, org_id')
    .eq('org_id', membership.org_id)
    .eq('stage', 'closed_won')
    .eq('payment_status', 'none')
    .limit(5)

  const { data: activeDeals, error: activeError } = await supabase
    .from('deals')
    .select('id, name, stage')
    .eq('org_id', membership.org_id)
    .in('stage', ['qualified', 'demo', 'proposal', 'negotiation'])
    .limit(10)

  return NextResponse.json({
    step: 'ok',
    user_id: user.id,
    membership,
    uninvoiced: { data: uninvoiced, error: uninvoicedError },
    activeDeals: { data: activeDeals, error: activeError },
  })
}