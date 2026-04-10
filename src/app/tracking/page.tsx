import { createServerSupabaseClient } from '@/lib/supabase-server'
import TrackingClient from './TrackingClient'

export default async function TrackingPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [dealsRes, contactsRes, companiesRes] = await Promise.all([
    supabase
      .from('deals')
      .select('id, name, value, currency, stage, last_activity_at, created_at, companies(name), deal_contacts(contacts(full_name))')
      .eq('user_id', user.id)
      .not('stage', 'in', '(closed_won,closed_lost)')
      .order('created_at', { ascending: false }),

    supabase
      .from('contacts')
      .select('id, full_name, role, email, phone, last_contacted_at, companies(name)')
      .eq('user_id', user.id)
      .order('last_contacted_at', { ascending: false, nullsFirst: false })
      .limit(50),

    supabase
      .from('companies')
      .select('id, name, industry, website')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  return (
    <TrackingClient
      deals={(dealsRes.data ?? []) as any[]}
      contacts={(contactsRes.data ?? []) as any[]}
      companies={(companiesRes.data ?? []) as any[]}
    />
  )
}