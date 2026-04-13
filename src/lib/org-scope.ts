import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

// Anon client — respects RLS, use for all data queries
export function createAnonSupabaseClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value },
        set() {},
        remove() {},
      },
    }
  )
}

// Service role client — bypasses RLS
// Use ONLY for: users table, organisation_members, invites
export function createAdminSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Get current user + org context
// anon = data queries (RLS enforced)
// admin = metadata queries (users, org_members)
export async function getUserContext() {
  const anon = createAnonSupabaseClient()
  const { data: { user } } = await anon.auth.getUser()
  if (!user) return null

  const admin = createAdminSupabaseClient()

  const { data: membership } = await admin
    .from('organisation_members')
    .select('org_id, role')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  return {
    user,
    anon,   // use for deals, contacts, companies, tasks, events
    admin,  // use for users, organisation_members, organisations
    orgId: membership?.org_id ?? null,
    role: membership?.role ?? 'member',
  }
}