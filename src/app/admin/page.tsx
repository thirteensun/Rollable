import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import AdminClient from './AdminClient'

function isAdminEmail(email: string): boolean {
  const adminEmails = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  return adminEmails.includes(email.toLowerCase())
}

export default async function AdminPage() {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
        set: () => {},
        remove: () => {},
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdminEmail(user.email!)) redirect('/')

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const [{ data: orgs }, { data: members }, { data: userProfiles }, { data: waitlist }, { data: settings }, { data: usageRaw }, { data: announcements }] = await Promise.all([
    admin
      .from('organisations')
      .select('id, name, created_at, subscriptions(plan, seats)')
      .order('created_at', { ascending: false })
      .limit(100),

    admin
      .from('organisation_members')
      .select('org_id, user_id, role, status'),

    admin
      .from('users')
      .select('id, email, full_name'),

    admin
      .from('waitlist')
      .select('id, email, status, created_at, approved_at, approved_by_email')
      .order('created_at', { ascending: false }),

    admin
      .from('app_settings')
      .select('key, value'),

    admin
      .from('token_usage')
      .select('org_id, route, model, input_tokens, output_tokens, created_at')
      .order('created_at', { ascending: false })
      .limit(5000),

    admin
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false }),
  ])

  // Merge members + user profiles into orgs
  const userMap = Object.fromEntries((userProfiles ?? []).map((u: any) => [u.id, u]))
  const membersByOrg = (members ?? []).reduce((acc: any, m: any) => {
    if (!acc[m.org_id]) acc[m.org_id] = []
    acc[m.org_id].push({ ...m, user: userMap[m.user_id] ?? null })
    return acc
  }, {})

  const orgsWithMembers = (orgs ?? []).map((org: any) => ({
    ...org,
    organisation_members: membersByOrg[org.id] ?? [],
  }))

  const capSetting = (settings ?? []).find((s: any) => s.key === 'registration_cap')
  const cap = {
    enabled: capSetting?.value?.enabled ?? true,
    limit: Number(capSetting?.value?.limit ?? 200),
  }

  return (
    <AdminClient
      orgs={orgsWithMembers}
      waitlist={waitlist ?? []}
      cap={cap}
      usage={usageRaw ?? []}
      announcements={announcements ?? []}
    />
  )
}
