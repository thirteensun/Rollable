import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import HomeClient from './HomeClient'

export default async function HomePage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  const today = new Date()
  today.setHours(23, 59, 59, 999)

  const { data: tasks } = await supabase
    .from('tasks')
    .select('*, contacts(full_name), deals(name)')
    .eq('user_id', user.id)
    .eq('done', false)
    .lte('due_date', today.toISOString())
    .order('due_date', { ascending: true })
    .limit(5)

  const { data: events } = await supabase
    .from('events')
    .select('*, contacts(full_name), deals(name)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5)

  const name = profile?.full_name || user.email?.split('@')[0] || 'there'
  const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)

  return <HomeClient name={name} initials={initials} tasks={tasks || []} events={events || []} />
}
