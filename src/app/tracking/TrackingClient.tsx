'use client'


interface Deal {
  id: string
  name: string
  value: number | null
  currency: string
  stage: string
  last_activity_at: string | null
  created_at: string
  companies: { name: string } | null
  deal_contacts: { contacts: { full_name: string } | null }[]
}

const stageProgress: Record<string, number> = {
  lead: 10,
  qualified: 25,
  demo: 40,
  proposal: 60,
  negotiation: 80,
  closed_won: 100,
  closed_lost: 100,
}

const stageLabel: Record<string, string> = {
  lead: 'Lead',
  qualified: 'Qualified',
  demo: 'Demo',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  closed_won: 'Won',
  closed_lost: 'Lost',
}

function isAtRisk(deal: Deal): boolean {
  if (!deal.last_activity_at) {
    const created = new Date(deal.created_at)
    const days = (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24)
    return days > 14
  }
  const days = (Date.now() - new Date(deal.last_activity_at).getTime()) / (1000 * 60 * 60 * 24)
  return days > 14
}

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

const avatarPalette = [
  { bg: '#E6F1FB', color: '#185FA5' },
  { bg: '#E1F5EE', color: '#0F6E56' },
  { bg: '#FAEEDA', color: '#854F0B' },
  { bg: '#EEEDFE', color: '#534AB7' },
  { bg: '#FCEBEB', color: '#A32D2D' },
]

export default function TrackingClient({ deals }: { deals: Deal[] }) {
  const total = deals.reduce((s, d) => s + (d.value || 0), 0)
  const atRiskDeals = deals.filter(isAtRisk)
  const atRisk = atRiskDeals.reduce((s, d) => s + (d.value || 0), 0)
  const closing = deals.filter(d => !isAtRisk(d) && stageProgress[d.stage] >= 60).reduce((s, d) => s + (d.value || 0), 0)

  const fmt = (v: number) => v >= 1000 ? `€${(v / 1000).toFixed(0)}k` : `€${v}`

  return (
    <main style={{ background: '#f5f4f0', paddingBottom: '90px' }}>
      <div style={{ padding: '56px 24px 16px' }}>
        <p style={{ margin: 0, fontSize: '13px', color: '#9b9890' }}>
          {new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
        </p>
        <p style={{ margin: '4px 0 0', fontSize: '26px', fontWeight: 500, color: '#1a1a18' }}>Pipeline</p>
      </div>

      {/* Summary */}
      <div style={{ padding: '0 24px 20px', display: 'flex', gap: '8px' }}>
        <div style={{ flex: 1, background: 'white', borderRadius: '14px', border: '0.5px solid rgba(0,0,0,0.07)', padding: '13px 12px' }}>
          <p style={{ margin: 0, fontSize: '11px', color: '#9b9890' }}>Total</p>
          <p style={{ margin: '5px 0 0', fontSize: '19px', fontWeight: 500, color: '#1a1a18' }}>{fmt(total)}</p>
        </div>
        <div style={{ flex: 1, background: 'white', borderRadius: '14px', border: '0.5px solid rgba(0,0,0,0.07)', padding: '13px 12px' }}>
          <p style={{ margin: 0, fontSize: '11px', color: '#9b9890' }}>Closing</p>
          <p style={{ margin: '5px 0 0', fontSize: '19px', fontWeight: 500, color: '#1D9E75' }}>{fmt(closing)}</p>
        </div>
        <div style={{ flex: 1, background: atRisk > 0 ? '#FFF8F8' : 'white', borderRadius: '14px', border: atRisk > 0 ? '0.5px solid rgba(226,75,74,0.15)' : '0.5px solid rgba(0,0,0,0.07)', padding: '13px 12px' }}>
          <p style={{ margin: 0, fontSize: '11px', color: atRisk > 0 ? '#E24B4A' : '#9b9890' }}>At risk</p>
          <p style={{ margin: '5px 0 0', fontSize: '19px', fontWeight: 500, color: atRisk > 0 ? '#E24B4A' : '#1a1a18' }}>{fmt(atRisk)}</p>
        </div>
      </div>

      {/* Deals */}
      <div style={{ padding: '0 24px' }}>
        <p style={{ margin: '0 0 12px', fontSize: '12px', fontWeight: 500, color: '#9b9890', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Active deals · {deals.length}
        </p>

        {deals.length === 0 ? (
          <div style={{
            background: 'white', borderRadius: '18px',
            border: '0.5px solid rgba(0,0,0,0.07)',
            padding: '32px', textAlign: 'center',
          }}>
            <p style={{ margin: '0 0 8px', fontSize: '17px', fontWeight: 500, color: '#1a1a18' }}>No deals yet</p>
            <p style={{ margin: 0, fontSize: '14px', color: '#9b9890' }}>Capture a meeting or call to create your first deal.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {deals.map((deal, i) => {
              const risk = isAtRisk(deal)
              const progress = stageProgress[deal.stage] || 0
              const palette = avatarPalette[i % avatarPalette.length]
              const contactName = deal.deal_contacts?.[0]?.contacts?.full_name || deal.companies?.name || ''
              const progressColor = risk ? '#E24B4A' : progress >= 60 ? '#1D9E75' : '#EF9F27'

              return (
                <div key={deal.id} style={{
                  background: risk ? '#FFF8F8' : 'white',
                  borderRadius: '16px',
                  border: risk ? '0.5px solid rgba(226,75,74,0.18)' : '0.5px solid rgba(0,0,0,0.07)',
                  padding: '14px 16px', cursor: 'pointer',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '34px', height: '34px', borderRadius: '10px',
                        background: palette.bg, display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontSize: '11px', fontWeight: 500, color: palette.color,
                      }}>
                        {getInitials(deal.name)}
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: '#1a1a18' }}>{deal.name}</p>
                        <p style={{ margin: '2px 0 0', fontSize: '12px', color: risk ? '#E24B4A' : '#9b9890' }}>
                          {risk ? 'No activity in 14+ days' : contactName}
                        </p>
                      </div>
                    </div>
                    {deal.value && (
                      <p style={{ margin: 0, fontSize: '15px', fontWeight: 500, color: '#1a1a18' }}>
                        {fmt(deal.value)}
                      </p>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ flex: 1, height: '4px', background: '#e8e6e0', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ width: `${progress}%`, height: '100%', background: progressColor, borderRadius: '2px' }} />
                    </div>
                    <span style={{ fontSize: '11px', color: risk ? '#E24B4A' : '#9b9890', flexShrink: 0 }}>
                      {stageLabel[deal.stage]}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

    </main>
  )
}