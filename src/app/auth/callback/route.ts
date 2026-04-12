import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (code) {
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) { return cookieStore.get(name)?.value },
          set(name: string, value: string, options: any) { cookieStore.set({ name, value, ...options }) },
          remove(name: string, options: any) { cookieStore.set({ name, value: '', ...options }) },
        },
      }
    )

    await supabase.auth.exchangeCodeForSession(code)

    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      const admin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

      // Check if user already has an org membership
      const { data: existingMembership } = await admin
        .from('organisation_members')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle()

      if (existingMembership) {
        // Existing user — go home
        return NextResponse.redirect(new URL('/', request.url))
      }

      // Check for pending invite by email
      const { data: pendingInvite } = await admin
        .from('organisation_members')
        .select('id, org_id, role')
        .eq('invited_email', user.email!)
        .eq('status', 'invited')
        .maybeSingle()

      if (pendingInvite) {
        // Activate invite — wire user_id, set active
        await admin
          .from('organisation_members')
          .update({
            user_id: user.id,
            status: 'active',
            invited_email: null,
          })
          .eq('id', pendingInvite.id)

        // Upsert user profile
        await admin.from('users').upsert({
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || '',
        }, { onConflict: 'id' })

        // Go home — they're now part of the org
        return NextResponse.redirect(new URL('/', request.url))
      }

      // No membership, no invite — check if they have any org at all
      const { data: anyMembership } = await admin
        .from('organisation_members')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!anyMembership) {
        // Brand new user — send to onboarding
        return NextResponse.redirect(new URL('/onboarding', request.url))
      }
    }
  }

  return NextResponse.redirect(new URL('/', request.url))
}