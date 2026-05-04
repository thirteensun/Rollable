import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { logger } from '@/lib/logger'

export async function PATCH(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const authClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get(name: string) { return cookieStore.get(name)?.value }, set() {}, remove() {} } }
    )
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get org
    const { data: membership } = await admin
      .from('organisation_members')
      .select('org_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle()

    if (!membership?.org_id) return NextResponse.json({ error: 'No org found' }, { status: 404 })

    const { layout } = await request.json()
    if (!layout || !Array.isArray(layout.left) || !Array.isArray(layout.right)) {
      return NextResponse.json({ error: 'Invalid layout' }, { status: 400 })
    }

    // Merge into existing context — only update analytics_layout key
    const { data: org } = await admin
      .from('organisations')
      .select('context')
      .eq('id', membership.org_id)
      .single()

    const updatedContext = { ...(org?.context || {}), analytics_layout: layout }

    const { error } = await admin
      .from('organisations')
      .update({ context: updatedContext })
      .eq('id', membership.org_id)

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    logger.error('analytics-layout', 'Request failed', error)
    return NextResponse.json({ error: error.message || 'Failed' }, { status: 500 })
  }
}
