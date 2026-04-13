import { createAnonSupabaseClient } from '@/lib/org-scope'
import { notFound } from 'next/navigation'
import CompanyDetailClient from './CompanyDetailClient'

export default async function CompanyDetailPage({ params }: { params: { id: string } }) {
  const supabase = createAnonSupabaseClient()

  const { data: company, error } = await supabase
    .from('companies')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !company) notFound()

  const [{ data: contacts }, { data: deals }, { data: events }] = await Promise.all([
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
  ])

  const dealIds = (deals ?? []).map((d: any) => d.id)
  const { data: tasks } = dealIds.length > 0
    ? await supabase
        .from('tasks')
        .select('id, title, done, status, priority, due_date, created_at, deal_id')
        .in('deal_id', dealIds)
        .order('created_at', { ascending: false })
    : { data: [] }

  return <CompanyDetailClient company={company} contacts={contacts ?? []} deals={deals ?? []} events={events ?? []} tasks={tasks ?? []} />
}