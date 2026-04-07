import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import HomeClient from './HomeClient'

export default async function HomePage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

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

  // Get org membership
  const { data: orgMembership } = await admin
    .from('organisation_members')
    .select('org_id, role')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  const userRole = orgMembership?.role || 'rep'

  // Get org name directly
  const { data: orgData } = orgMembership?.org_id
    ? await admin.from('organisations').select('name').eq('id', orgMembership.org_id).single()
    : { data: null }

  const orgName = orgData?.name || null

  const today = new Date()
  today.setHours(23, 59, 59, 999)

  const { data: tasks } = await admin
    .from('tasks')
    .select('*, contacts(full_name), deals(name)')
    .eq('user_id', user.id)
    .eq('done', false)
    .lte('due_date', today.toISOString())
    .order('due_date', { ascending: true })
    .limit(5)

  const { data: events } = await admin
    .from('events')
    .select('*, contacts(full_name), deals(name), companies(name)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5)

  const name = profile?.full_name || user.email?.split('@')[0] || 'there'
  const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)

  return <HomeClient name={name} initials={initials} tasks={tasks || []} events={events || []} orgName={orgName} userRole={userRole} />
}