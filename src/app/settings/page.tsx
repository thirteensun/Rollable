import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import SettingsClient from './SettingsClient'

export default async function SettingsPage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Get user profile
  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  // Get membership separately — avoids join issues
  const { data: membership } = await supabase
    .from('organisation_members')
    .select('role, org_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  const role = membership?.role || 'rep'
  const orgId = membership?.org_id || null

  // Get org directly by ID
  const { data: org } = orgId
    ? await supabase.from('organisations').select('id, name, slug').eq('id', orgId).single()
    : { data: null }

  // Get team members
  const { data: membersRaw } = orgId
    ? await supabase
        .from('organisation_members')
        .select('role, status, invited_email, user_id, users(full_name, email)')
        .eq('org_id', orgId)
        .eq('status', 'active')
        .order('created_at', { ascending: true })
    : { data: [] }

  const members = (membersRaw || []).map((m: any) => ({
    ...m,
    users: Array.isArray(m.users) ? m.users[0] || null : m.users,
  }))

  // Get subscription
  const { data: subscription } = orgId
    ? await supabase.from('subscriptions').select('plan, seats, status').eq('org_id', orgId).maybeSingle()
    : { data: null }

  const name = profile?.full_name || user.email?.split('@')[0] || 'You'
  const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <SettingsClient
      name={name}
      email={user.email || ''}
      initials={initials}
      role={role}
      orgName={org?.name || ''}
      orgId={org?.id || ''}
      members={members}
      plan={subscription?.plan || 'free'}
      seats={subscription?.seats || 1}
    />
  )
}