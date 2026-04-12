import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

const STAGE_LABELS: Record<string, string> = {
  lead: 'Lead', qualified: 'Qualified', demo: 'Demo',
  proposal: 'Proposal', negotiation: 'Negotiation',
  closed_won: 'Won', closed_lost: 'Lost',
}

function formatValue(v?: number) {
  if (!v) return '—'
  if (v >= 1000) return `$${(v / 1000).toFixed(0)}k`
  return `$${v}`
}

export default async function DealsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: deals } = await supabase
    .from('deals')
    .select('id, name, value, stage, last_activity_at, companies(name)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 500, color: '#1a1a18', margin: 0 }}>Deals</h1>
        <Link href="/capture" style={{ background: '#1a1a18', color: 'white', borderRius: 10, padding: '7px 14px', fontSize: 12, fontWeight: 500, textDecoration: 'none' }}>
          + Capture
        </Link>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(deals ?? []).map((deal: any) => {
          const days = deal.last_activity_at ? Math.floor((Date.now() - new Date(deal.last_activity_at).getTime()) / 86400000) : 0
          const atRisk = days >= 14 && deal.stage !== 'closed_won' && deal.stage !== 'closed_lost'
          return (
            <Link key={deal.id} href={`/tracking/deals/${deal.id}`} style={{ textDecoration: 'none' }}>
              <div style={{ background: 'white', border: '0.5px solid rgba(0,0,0,0.07)', borderLeft: atRisk ? '2.5px solid #EF9F27' : undefined, borderRadius: 16, padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: '#1a1a18', marginBottom: 2 }}>{deal.name}</div>
                    {deal.companies?.name && <div style={{ fontSize: 12, color: '#9b9890' }}>{deal.companies.name}</div>}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#1a1a18' }}>{formatValue(deal.value)}</div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 500, background: '#f5f4f0', color: '#6b6960', padding: '3px 8px', borderRadius: 6 }}>
                    {STAGE_LABELS[deal.stage] ?? deal.stage}
                  </span>
                  {atRisk && <span style={{ fontSize: 11, color: '#EF9F27' }}>{days}d no activity</span>}
                </div>
              </div>
            </Link>
          )
        })}
        {(deals ?? []).length === 0 && (
          <div style={{ background: 'white', borderRadius: 16, border: '0.5px solid rgba(0,0,0,0.07)', padding: 32, textAlign: 'center' }}>
            <p style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 500, color: '#1a1a18' }}>No deals yet</p>
            <p style={{ margin: 0, fontSize: 13, color: '#9b9890' }}>Use Capture to add your first deal</p>
          </div>
        )}
      </div>
    </div>
  )
}
