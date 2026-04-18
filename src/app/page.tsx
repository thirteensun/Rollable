import { redirect } from 'next/navigation'
import { getUserContext } from '@/lib/org-scope'
import HomeClient from './HomeClient'

export default async function HomePage() {
  const ctx = await getUserContext()
  if (!ctx) redirect('/login')

  const { user, anon, admin, orgId, role } = ctx

  const { data: orgData } = orgId
    ? await admin.from('organisations').select('name').eq('id', orgId).single()
    : { data: null }

  const { data: profile } = await admin
    .from('users')
    .select('full_name')
    .eq('id', user.id)
    .single()

  const today = new Date()
  today.setHours(23, 59, 59, 999)

  const [{ data: tasks }, { data: events }, { data: deals }] = await Promise.all([
    // Tasks due today or overdue — exclude cancelled and postponed
    anon
      .from('tasks')
      .select('*, contacts(full_name), deals(name)')
      .eq('done', false)
      .not('status', 'in', '("cancelled","postponed")')
      .lte('due_date', today.toISOString())
      .order('due_date', { ascending: true })
      .limit(5),

    // Events last 365 days — for activity chart + click detail
    anon
      .from('events')
      .select('id, created_at, type, summary, contacts(full_name), deals(name), companies(name)')
      .gte('created_at', new Date(Date.now() - 365 * 86400000).toISOString())
      .order('created_at', { ascending: false }),

    // Active deals — for pipeline pulse / what's next (kept for future use)
    anon
      .from('deals')
      .select('id, name, stage, value, last_activity_at')
      .not('stage', 'in', '("closed_won","closed_lost")'),
  ])

  const name = profile?.full_name || user.email?.split('@')[0] || 'there'
  const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <HomeClient
      name={name}
      initials={initials}
      tasks={tasks ?? []}
      events={events ?? []}
      deals={deals ?? []}
      orgName={orgData?.name ?? null}
      userRole={role}
    />
  )
}