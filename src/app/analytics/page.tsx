import { createServerSupabaseClient } from '@/lib/supabase-server'
import AnalyticsClient from './AnalyticsClient'

export default async function AnalyticsPage() {
  const supabase = await createServerSupabaseClient()

  // Fetch all deals for the org
  const { data: deals } = await supabase
    .from('deals')
    .select('id, name, stage, value, confirmed_revenue, created_at, updated_at, payment_status')
    .order('created_at', { ascending: false })

  // Fetch events for activity feed + volume chart
  const { data: events } = await supabase
    .from('events')
    .select('id, event_type, created_at')
    .order('created_at', { ascending: false })
    .limit(200)

  // Fetch tasks for completion rate
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, status, created_at, due_date')

  return (
    <AnalyticsClient
      deals={deals ?? []}
      events={events ?? []}
      tasks={tasks ?? []}
    />
  )
}
