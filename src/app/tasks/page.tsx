import { createAnonSupabaseClient } from '@/lib/org-scope'
import { redirect } from 'next/navigation'
import TaskSchedulerClient from './TaskSchedulerClient'

export default async function TasksPage() {
  const supabase = createAnonSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: tasks }, { data: deals }, { data: contacts }] = await Promise.all([
    supabase
      .from('tasks')
      .select('id, title, status, due_date, priority, deal_id, contact_id, created_at')
      // Fetch all non-done tasks including postponed/cancelled so they render correctly
      // Calendar still shows them, just styled differently
      .neq('status', 'done')
      .order('due_date', { ascending: true, nullsFirst: false }),

    supabase
      .from('deals')
      .select('id, name, stage')
      .not('stage', 'in', '(closed_won,closed_lost)')
      .order('created_at', { ascending: false })
      .limit(50),

    supabase
      .from('contacts')
      .select('id, full_name')
      .order('full_name')
      .limit(50),
  ])

  return (
    <TaskSchedulerClient
      tasks={tasks ?? []}
      deals={deals ?? []}
      contacts={contacts ?? []}
    />
  )
}