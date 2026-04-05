import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import PlanningClient from './PlanningClient'

export default async function PlanningPage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const now = new Date().toISOString()
  const endOfDay = new Date()
  endOfDay.setHours(23, 59, 59, 999)
  const endOfWeek = new Date()
  endOfWeek.setDate(endOfWeek.getDate() + 7)
  endOfWeek.setHours(23, 59, 59, 999)

  const { data: allTasks } = await supabase
    .from('tasks')
    .select('*, contacts(full_name), deals(name)')
    .eq('user_id', user.id)
    .eq('done', false)
    .order('due_date', { ascending: true })

  const overdue = (allTasks || []).filter(t => t.due_date && new Date(t.due_date) < new Date(now) && new Date(t.due_date).toDateString() !== new Date().toDateString())
  const today = (allTasks || []).filter(t => t.due_date && new Date(t.due_date).toDateString() === new Date().toDateString())
  const thisWeek = (allTasks || []).filter(t => t.due_date && new Date(t.due_date) > endOfDay && new Date(t.due_date) <= endOfWeek)
  const noDueDate = (allTasks || []).filter(t => !t.due_date)

  return <PlanningClient overdue={overdue} today={today} thisWeek={thisWeek} noDueDate={noDueDate} />
}
