import { createServerSupabaseClient } from '@/lib/supabase-server'
import TaskSchedulerClient from './TaskSchedulerClient'

export default async function TasksPage() {
  const supabase = await createServerSupabaseClient()

  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, title, status, due_date, priority, deal_id, contact_id, created_at')
    .order('due_date', { ascending: true })

  const { data: deals } = await supabase
    .from('deals')
    .select('id, name, stage')

  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, full_name')

  return (
    <TaskSchedulerClient
      tasks={tasks ?? []}
      deals={deals ?? []}
      contacts={contacts ?? []}
    />
  )
}
