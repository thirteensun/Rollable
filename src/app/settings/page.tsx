import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import SettingsClient from './SettingsClient'

export default async function SettingsPage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await (await supabase).auth.getUser()
  if (!user) redirect('/login')

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: profile } = await admin
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  const { data: membership } = await admin
    .from('organisation_members')
    .select('role, org_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  const role = membership?.role || 'rep'
  const orgId = membership?.org_id || null

  const { data: org } = orgId
    ? await admin.from('organisations').select('id, name, slug, context').eq('id', orgId).single()
    : { data: null }

  // Fetch members and user profiles separately to avoid the auth.users FK issue
  const { data: membersRaw } = orgId
    ? await admin
        .from('organisation_members')
        .select('role, status, invited_email, user_id')
        .eq('org_id', orgId)
        .order('created_at', { ascending: true })
    : { data: [] }

  const activeUserIds = (membersRaw ?? [])
    .filter((m: any) => m.user_id)
    .map((m: any) => m.user_id)

  const { data: userProfiles } = activeUserIds.length > 0
    ? await admin.from('users').select('id, email, full_name').in('id', activeUserIds)
    : { data: [] }

  const userMap = Object.fromEntries((userProfiles ?? []).map((u: any) => [u.id, u]))

  const members = (membersRaw ?? []).map((m: any) => ({
    ...m,
    users: userMap[m.user_id] ?? null,
  }))

  const { data: subscription } = orgId
    ? await admin.from('subscriptions').select('plan, seats, status').eq('org_id', orgId).maybeSingle()
    : { data: null }

  const name = profile?.full_name || user.email?.split('@')[0] || 'You'
  const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
  const avatar = user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? undefined

  return (
    <SettingsClient
      name={name}
      email={user.email || ''}
      initials={initials}
      avatar={avatar}
      role={role}
      orgName={org?.name || ''}
      orgId={org?.id || ''}
      orgContext={org?.context || {}}
      members={members}
      plan={subscription?.plan || 'free'}
      seats={subscription?.seats || 1}
    />
  )
}
