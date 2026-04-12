import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect, notFound } from 'next/navigation'
import TaskDetailClient from './TaskDetailClient'

export default async function TaskDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: task } = await supabase
    .from('tasks')
    .select('*, deals(id, name, stage), contacts(id, full_name, role, email, phone)')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (!task) notFound()

  const [{ data: allDeals }, { data: allContacts }] = await Promise.all([
    supabase.from('deals').select('id, name, stage').eq('user_id', user.id).not('stage', 'in', '(closed_won,closed_lost)').order('created_at', { ascending: false }).limit(50),
    supabase.from('contacts').select('id, full_name, role').eq('user_id', user.id).order('full_name').limit(50),
  ])

  return <TaskDetailClient task={task} allDeals={allDeals ?? []} allContacts={allContacts ?? []} />
}
