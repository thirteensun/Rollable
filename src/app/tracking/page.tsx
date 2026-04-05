import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import TrackingClient from './TrackingClient'

export default async function TrackingPage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: deals } = await supabase
    .from('deals')
    .select('*, companies(name), deal_contacts(contacts(full_name))')
    .eq('user_id', user.id)
    .not('stage', 'in', '("closed_won","closed_lost")')
    .order('created_at', { ascending: false })

  return <TrackingClient deals={deals || []} />
}
