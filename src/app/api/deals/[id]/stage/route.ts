import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerSupabaseClient()
  const { stage } = await req.json()

  const validStages = ['lead', 'qualified', 'demo', 'proposal', 'negotiation', 'closed_won', 'closed_lost']
  if (!stage || !validStages.includes(stage)) {
    return NextResponse.json({ error: 'Invalid stage' }, { status: 400 })
  }

  const { error } = await supabase
    .from('deals')
    .update({ stage })
    .eq('id', params.id)

  if (error) {
    logger.error('deals/stage', 'Failed to update deal stage', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
