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

  const { data: events } = await supabase
    .from('events')
    .select('id, type, summary, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  return <TaskDetailClient task={task} events={events ?? []} />
}
