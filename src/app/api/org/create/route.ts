import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { org_name, org_slug } = await req.json()

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

  // Check if this user is already on the approved waitlist (bypass cap)
  const { data: waitlistEntry } = await admin
    .from('waitlist')
    .select('id, status')
    .eq('user_id', user.id)
    .maybeSingle()

  if (waitlistEntry?.status !== 'approved') {
    // Read cap settings
    const { data: capSetting } = await admin
      .from('app_settings')
      .select('value')
      .eq('key', 'registration_cap')
      .maybeSingle()

    const capEnabled: boolean = capSetting?.value?.enabled ?? true
    const capLimit: number = Number(capSetting?.value?.limit ?? 200)

    if (capEnabled) {
      const { count } = await admin
        .from('organisations')
        .select('*', { count: 'exact', head: true })

      if ((count ?? 0) >= capLimit) {
        // Add to waitlist if not already there
        if (!waitlistEntry) {
          await admin.from('waitlist').insert({
            user_id: user.id,
            email: user.email,
            status: 'pending',
          })
        }
        return NextResponse.json({ error: 'registration_limit_reached' }, { status: 403 })
      }
    }
  }

  // Create the organisation
  const { error: fnError } = await supabase.rpc('create_organisation', {
    org_name,
    org_slug,
  })

  if (fnError) return NextResponse.json({ error: fnError.message }, { status: 500 })

  // Ensure the creator's membership is active (RPC may set a different status)
  await admin
    .from('organisation_members')
    .update({ status: 'active' })
    .eq('user_id', user.id)
    .neq('status', 'active')

  // Clean up waitlist entry now that they're in
  if (waitlistEntry) {
    await admin.from('waitlist').delete().eq('id', waitlistEntry.id)
  }

  return NextResponse.json({ success: true })
}
