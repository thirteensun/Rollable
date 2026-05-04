import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createAdminSupabaseClient } from '@/lib/org-scope'
import { logger } from '@/lib/logger'

export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminSupabaseClient()
    const { data: membership } = await admin
      .from('organisation_members')
      .select('org_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle()

    const orgId = membership?.org_id ?? null
    const { category, rating, text, page } = await req.json()

    const { error } = await admin.from('feedback').insert({
      user_id: user.id,
      org_id: orgId,
      page,
      category: category ?? null,
      rating: rating ?? null,
      text: text?.trim() ?? null,
    })

    if (error) {
      logger.error('feedback', 'Insert failed', { message: error.message, error })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    logger.error('feedback', 'Request failed', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
