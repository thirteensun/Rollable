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

  const [{ data: orgs }, { data: waitlist }, { data: settings }] = await Promise.all([
    admin
      .from('organisations')
      .select(`
        id, name, created_at,
        subscriptions(plan, seats),
        organisation_members(role, status, user_id, users(email, full_name))
      `)
      .order('created_at', { ascending: false })
      .limit(100),

    admin
      .from('waitlist')
      .select('id, email, status, created_at, approved_at, approved_by_email')
      .order('created_at', { ascending: false }),

    admin
      .from('app_settings')
      .select('key, value'),
  ])

  const capSetting = (settings ?? []).find((s: any) => s.key === 'registration_cap')
  const cap = {
    enabled: capSetting?.value?.enabled ?? true,
    limit: Number(capSetting?.value?.limit ?? 200),
  }

  return (
    <AdminClient
      orgs={orgs ?? []}
      waitlist={waitlist ?? []}
      cap={cap}
    />
  )
}
