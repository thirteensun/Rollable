import { redirect } from 'next/navigation'
import { getUserContext } from '@/lib/org-scope'
import { getOrgContext } from '@/lib/org-context'
import { type HomePriority } from '@/lib/stage-templates'
import HomeClient from './HomeClient'

export default async function HomePage() {
  const ctx = await getUserContext()
  if (!ctx) redirect('/login')

  const { user, anon, admin, orgId, role } = ctx

  const [orgData, profile, orgContext] = await Promise.all([
    orgId
      ? admin.from('organisations').select('name').eq('id', orgId).single().then(r => r.data)
      : null,
    admin.from('users').select('full_name').eq('id', user.id).single().then(r => r.data),
    orgId ? getOrgContext(orgId) : {},
  ])

  const homePriority: HomePriority = (orgContext as any).home_priority || 'tasks'

  const today = new Date()
  today.setHours(23, 59, 59, 999)

  const [{ data: tasks }, { data: events }, { data: deals }, { data: atRiskDeals }, { count: contactCount }, { count: taskCount }] = await Promise.all([
    anon
      .from('tasks')
      .select('*, contacts(full_name), deals(name)')
      .eq('done', false)
      .not('status', 'in', '("cancelled","postponed")')
      .lte('due_date', today.toISOString())
      .order('due_date', { ascending: true })
      .limit(5),

    anon
      .from('events')
      .select('id, created_at, type, summary, contacts(full_name), deals(name), companies(name)')
      .gte('created_at', new Date(Date.now() - 365 * 86400000).toISOString())
      .order('created_at', { ascending: false }),

    anon
      .from('deals')
      .select('id, name, stage, value, last_activity_at')
      .not('stage', 'in', '("closed_won","closed_lost")'),

    // At-risk deals — for at_risk home priority
    anon
      .from('deals')
      .select('id, name, stage, value, last_activity_at')
      .not('stage', 'in', '("closed_won","closed_lost")')
      .lt('last_activity_at', new Date(Date.now() - ((orgContext as any).at_risk_days || 14) * 86400000).toISOString())
      .order('last_activity_at', { ascending: true })
      .limit(5),

    anon.from('contacts').select('*', { count: 'exact', head: true }),
    anon.from('tasks').select('*', { count: 'exact', head: true }),
  ])

  const name = profile?.full_name || user.email?.split('@')[0] || 'there'
  const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
  const avatar = user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? undefined

  const quickStartDone = {
    captured: (events ?? []).length > 0,
    contacted: (contactCount ?? 0) > 0,
    deal: (deals ?? []).length > 0,
    task: (taskCount ?? 0) > 0,
  }

  return (
    <HomeClient
      name={name}
      initials={initials}
      avatar={avatar}
      tasks={tasks ?? []}
      events={events ?? []}
      deals={deals ?? []}
      atRiskDeals={atRiskDeals ?? []}
      orgName={(orgData as any)?.name ?? null}
      userRole={role}
      homePriority={homePriority}
      quickStartDone={quickStartDone}
    />
  )
}