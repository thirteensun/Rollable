import { redirect } from 'next/navigation'
import { getUserContext } from '@/lib/org-scope'
import { getOrgContext } from '@/lib/org-context'
import TrackingClient from './TrackingClient'

export default async function TrackingPage() {
  const ctx = await getUserContext()
  if (!ctx) redirect('/login')

  const { anon, orgId } = ctx

  const orgContext = orgId ? await getOrgContext(orgId) : {}
  const stageTemplate = (orgContext as any).stage_template || 'other'

  const [dealsRes, contactsRes, companiesRes] = await Promise.all([
    anon
      .from('deals')
      .select('id, name, value, currency, stage, last_activity_at, created_at, companies(name), deal_contacts(contacts(full_name))')
      .order('created_at', { ascending: false }),

    anon
      .from('contacts')
      .select('id, full_name, role, email, phone, last_contacted_at, companies(name)')
      .order('last_contacted_at', { ascending: false, nullsFirst: false })
      .limit(50),

    anon
      .from('companies')
      .select('id, name, industry, website')
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  return (
    <TrackingClient
      events={[]}
      deals={(dealsRes.data ?? []) as any[]}
      contacts={(contactsRes.data ?? []) as any[]}
      companies={(companiesRes.data ?? []) as any[]}
      stageTemplate={stageTemplate}
    />
  )
}