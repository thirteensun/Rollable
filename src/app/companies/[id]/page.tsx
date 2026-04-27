import { getUserContext } from '@/lib/org-scope'
import { getOrgContext } from '@/lib/org-context'
import { getVisibleFields } from '@/lib/onboarding-inference'
import { notFound, redirect } from 'next/navigation'
import CompanyDetailClient from './CompanyDetailClient'

export default async function CompanyDetailPage({ params }: { params: { id: string } }) {
  const userCtx = await getUserContext()
  if (!userCtx) redirect('/login')
  if (!userCtx.orgId) redirect('/onboarding')

  const supabase = userCtx.anon

  const { data: company, error } = await supabase
    .from('companies')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !company) notFound()

  const [{ data: contacts }, { data: deals }, { data: events }, orgContext] = await Promise.all([
    supabase
      .from('contacts')
      .select('id, full_name, role, email, phone')
      .eq('company_id', params.id)
      .order('full_name'),
    supabase
      .from('deals')
      .select('id, name, stage, value')
      .eq('company_id', params.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('events')
      .select('id, type, summary, created_at, metadata')
      .eq('company_id', params.id)
      .order('created_at', { ascending: false })
      .limit(30),
    getOrgContext(userCtx.orgId),
  ])

  const dealIds = (deals ?? []).map((d: any) => d.id)
  const { data: tasks } = dealIds.length > 0
    ? await supabase
        .from('tasks')
        .select('id, title, done, status, priority, due_date, created_at, deal_id')
        .in('deal_id', dealIds)
        .order('created_at', { ascending: false })
    : { data: [] }

  const visibleFields = getVisibleFields(orgContext, 'companies')

  return (
    <CompanyDetailClient
      company={company}
      contacts={contacts ?? []}
      deals={deals ?? []}
      events={events ?? []}
      tasks={tasks ?? []}
      visibleFields={visibleFields}
    />
  )
}