import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import SettingsClient from './SettingsClient'

export default async function SettingsPage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  const { data: membership } = await supabase
    .from('organisation_members')
    .select('role, org_id, organisations(id, name, slug)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  const org = (membership?.organisations as any)
  const role = membership?.role || 'rep'

  // Get team members (all roles can see this)
  const { data: members } = await supabase
    .from('organisation_members')
    .select('role, status, invited_email, user_id, users(full_name, email)')
    .eq('org_id', org?.id)
    .eq('status', 'active')
    .order('created_at', { ascending: true })

  // Get subscription
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan, seats, status')
    .eq('org_id', org?.id)
    .maybeSingle()

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
      members={members || []}
      plan={subscription?.plan || 'free'}
      seats={subscription?.seats || 1}
    />
  )
}
