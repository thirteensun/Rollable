import { redirect } from 'next/navigation'
import { getUserContext } from '@/lib/org-scope'
import AnalyticsClient from './AnalyticsClient'

export default async function AnalyticsPage() {
  const ctx = await getUserContext()
  if (!ctx) redirect('/login')

  const { anon } = ctx

  // All data queries use anon client — RLS handles scoping
  const [dealsRes, eventsRes, tasksRes] = await Promise.all([
    anon
      .from('deals')
      .select('id, name, stage, value, confirmed_revenue, created_at, updated_at, payment_status')
      .order('created_at', { ascending: false }),

    anon
      .from('events')
      .select('id, type, created_at')
      .order('created_at', { ascending: false })
      .limit(200),

    anon
      .from('tasks')
      .select('id, status, created_at, due_date'),
  ])

  return (
    <AnalyticsClient
      deals={dealsRes.data ?? []}
      events={eventsRes.data ?? []}
      tasks={tasksRes.data ?? []}
    />
  )
}