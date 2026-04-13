import { redirect } from 'next/navigation'
import { getUserContext } from '@/lib/org-scope'
import HomeClient from './HomeClient'

export default async function HomePage() {
  const ctx = await getUserContext()
  if (!ctx) redirect('/login')

  const { user, anon, admin, orgId, role } = ctx

  // Org name — service role (cross-user lookup)
  const { data: orgData } = orgId
    ? await admin.from('organisations').select('name').eq('id', orgId).single()
    : { data: null }

  // User profile — service role (users table)
  const { data: profile } = await admin
    .from('users')
    .select('full_name')
    .eq('id', user.id)
    .single()

  const today = new Date()
  today.setHours(23, 59, 59, 999)

  // Data queries — anon client, RLS handles org/user scoping
  const { data: tasks } = await anon
    .from('tasks')
    .select('*, contacts(full_name), deals(name)')
    .eq('done', false)
    .lte('due_date', today.toISOString())
    .order('due_date', { ascending: true })
    .limit(5)

  const { data: events } = await anon
    .from('events')
    .select('*, contacts(full_name), deals(name), companies(name)')
    .order('created_at', { ascending: false })
    .limit(5)

  const name = profile?.full_name || user.email?.split('@')[0] || 'there'
  const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <HomeClient
      name={name}
      initials={initials}
      tasks={tasks ?? []}
      events={events ?? []}
      orgName={orgData?.name ?? null}
      userRole={role}
    />
  )
}