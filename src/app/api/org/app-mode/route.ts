import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { AppMode } from '@/lib/mode-config'

const VALID_MODES: AppMode[] = ['fire', 'wood', 'water', 'earth', 'gold']

export async function PATCH(req: Request) {
  const { mode } = await req.json()
  if (!VALID_MODES.includes(mode)) {
    return NextResponse.json({ error: 'Invalid mode' }, { status: 400 })
  }

  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
        set: (name: string, value: string, opts: any) => cookieStore.set({ name, value, ...opts }),
        remove: (name: string, opts: any) => cookieStore.set({ name, value: '', ...opts }),
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: membership } = await admin
    .from('organisation_members')
    .select('org_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (!membership) return NextResponse.json({ error: 'No workspace found' }, { status: 404 })

  const { data: org } = await admin
    .from('organisations')
    .select('context')
    .eq('id', membership.org_id)
    .single()

  const updated = { ...(org?.context || {}), app_mode: mode }

  const { error } = await admin
    .from('organisations')
    .update({ context: updated })
    .eq('id', membership.org_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
