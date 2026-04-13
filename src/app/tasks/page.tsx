import { redirect } from 'next/navigation'
import { getUserContext } from '@/lib/org-scope'
import TaskSchedulerClient from './TaskSchedulerClient'

export default async function TasksPage() {
  const ctx = await getUserContext()
  if (!ctx) redirect('/login')

  const { anon } = ctx

  // All data queries use anon client — RLS handles scoping
  const [tasksRes, dealsRes, contactsRes] = await Promise.all([
    anon
      .from('tasks')
      .select('id, title, status, due_date, priority, deal_id, contact_id, created_at')
      .order('due_date', { ascending: true }),

    anon
      .from('deals')
      .select('id, name, stage'),

    anon
      .from('contacts')
      .select('id, full_name'),
  ])

  return (
    <TaskSchedulerClient
      tasks={tasksRes.data ?? []}
      deals={dealsRes.data ?? []}
      contacts={contactsRes.data ?? []}
    />
  )
}