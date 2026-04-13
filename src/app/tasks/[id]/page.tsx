import { createAnonSupabaseClient } from '@/lib/org-scope'
import { redirect, notFound } from 'next/navigation'
import TaskDetailClient from './TaskDetailClient'

export default async function TaskDetailPage({ params }: { params: { id: string } }) {
  const supabase = createAnonSupabaseClient()

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Removed .eq('user_id', user.id) — RLS handles access control
  const { data: task } = await supabase
    .from('tasks')
    .select('*, deals(id, name, stage), contacts(id, full_name, role, email, phone)')
    .eq('id', params.id)
    .single()

  if (!task) notFound()

  // Removed .eq('user_id', user.id) — RLS scopes to user or org based on role
  const [{ data: allDeals }, { data: allContacts }] = await Promise.all([
    supabase
      .from('deals')
      .select('id, name, stage')
      .not('stage', 'in', '(closed_won,closed_lost)')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('contacts')
      .select('id, full_name, role')
      .order('full_name')
      .limit(50),
  ])

  return <TaskDetailClient task={task} allDeals={allDeals ?? []} allContacts={allContacts ?? []} />
}