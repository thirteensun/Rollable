import { getUserContext } from '@/lib/org-scope'
import { getOrgContext } from '@/lib/org-context'
import { getVisibleFields, getFieldOptions } from '@/lib/onboarding-inference'
import { notFound, redirect } from 'next/navigation'
import DealDetailClient from './DealDetailClient'

export default async function DealDetailPage({ params }: { params: { id: string } }) {
  const userCtx = await getUserContext()
  if (!userCtx) redirect('/login')
  if (!userCtx.orgId) redirect('/onboarding')

  const supabase = userCtx.anon

  const { data: deal, error } = await supabase
    .from('deals')
    .select(`
      *,
      companies ( id, name ),
      deal_contacts (
        contacts ( id, full_name, email, phone, role )
      )
    `)
    .eq('id', params.id)
    .single()

  if (error || !deal) notFound()

  const [{ data: events }, { data: tasks }, orgContext] = await Promise.all([
    supabase
      .from('events')
      .select('id, type, summary, created_at, metadata')
      .eq('deal_id', params.id)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('tasks')
      .select('id, title, done, status, priority, due_date, created_at')
      .eq('deal_id', params.id)
      .order('created_at', { ascending: false })
      .limit(50),
    getOrgContext(userCtx.orgId),
  ])

  const visibleFields = getVisibleFields(orgContext, 'deals')
  const fieldOptions  = { deals: getFieldOptions(orgContext, 'deals') }

  return (
    <DealDetailClient
      deal={deal}
      events={events ?? []}
      tasks={tasks ?? []}
      visibleFields={visibleFields}
      fieldOptions={fieldOptions}
    />
  )
}