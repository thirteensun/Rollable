import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getUserContext } from '@/lib/org-scope'
import { getOrgContext } from '@/lib/org-context'
import KanbanBoard from './KanbanBoard'

export default async function PipelinePage() {
  const ctx = await getUserContext()
  if (!ctx) redirect('/login')

  const { anon, orgId } = ctx
  const orgContext = orgId ? await getOrgContext(orgId) : {}
  const stageTemplate = (orgContext as any).stage_template || 'other'

  const { data: deals } = await anon
    .from('deals')
    .select('id, name, value, currency, stage, last_activity_at, created_at, companies(name), deal_contacts(contacts(full_name))')
    .order('created_at', { ascending: false })

  // Compute days_since_activity
  const now = Date.now()
  const enriched = (deals ?? []).map((d: any) => ({
    ...d,
    company_name: Array.isArray(d.companies) ? d.companies[0]?.name : d.companies?.name,
    days_since_activity: d.last_activity_at
      ? Math.floor((now - new Date(d.last_activity_at).getTime()) / 86400000)
      : 999,
  }))

  return (
    <>
      <div style={{ height: '100vh' }} />
      <div style={{
        position: 'fixed', top: 0, left: 210, right: 0, bottom: 0,
        background: '#f5f4f0', display: 'flex', flexDirection: 'column', zIndex: 10,
      }}>
        <div style={{
          height: 52, background: 'white',
          borderBottom: '0.5px solid rgba(0,0,0,0.07)',
          display: 'flex', alignItems: 'center',
          padding: '0 20px', gap: 12, flexShrink: 0,
        }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: '#1a1a18', flex: 1 }}>Pipeline</span>
          <Link href="/deals" style={{ fontSize: 12, color: '#6b6960', textDecoration: 'none' }}>
            List view
          </Link>
          <Link href="/capture" style={{
            background: '#1a1a18', color: 'white',
            borderRadius: 10, padding: '7px 14px',
            fontSize: 12, fontWeight: 500, textDecoration: 'none',
          }}>
            + Add Deal
          </Link>
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <KanbanBoard deals={enriched} stageTemplate={stageTemplate} />
        </div>
      </div>
    </>
  )
}
