import BottomNav from '@/components/layout/BottomNav'

const deals = [
  { initials: 'TC', name: 'TechCorp Enterprise', contact: 'Maria Kovacs', stage: 'Proposal', value: 45000, progress: 70, color: '#1D9E75', bg: '#E6F1FB', textColor: '#185FA5', risk: false },
  { initials: 'NS', name: 'Nordic Solutions', contact: 'Björn Eriksson', stage: 'Negotiation', value: 23000, progress: 55, color: '#1D9E75', bg: '#E1F5EE', textColor: '#0F6E56', risk: false },
  { initials: 'OR', name: 'Oslo Retail Demo', contact: 'Ingrid Bakke', stage: 'Demo', value: 28000, progress: 35, color: '#EF9F27', bg: '#FAEEDA', textColor: '#854F0B', risk: false },
  { initials: 'BM', name: 'Bergen Manufacturing', contact: 'No contact in 18 days', stage: 'Proposal', value: 46000, progress: 50, color: '#E24B4A', bg: '#FCEBEB', textColor: '#A32D2D', risk: true },
]

export default function TrackingPage() {
  const total = deals.reduce((sum, d) => sum + d.value, 0)
  const atRisk = deals.filter(d => d.risk).reduce((sum, d) => sum + d.value, 0)
  const closing = deals.filter(d => !d.risk && d.progress >= 50).reduce((sum, d) => sum + d.value, 0)

  return (
    <main style={{ minHeight: '100dvh', background: '#f5f4f0', paddingBottom: '100px' }}>
      <div style={{ padding: '56px 24px 16px' }}>
        <p style={{ margin: 0, fontSize: '13px', color: '#9b9890' }}>April 2026</p>
        <p style={{ margin: '4px 0 0', fontSize: '26px', fontWeight: 500, color: '#1a1a18' }}>Pipeline</p>
      </div>

      {/* Summary cards */}
      <div style={{ padding: '0 24px 20px', display: 'flex', gap: '8px' }}>
        <div style={{ flex: 1, background: 'white', borderRadius: '14px', border: '0.5px solid rgba(0,0,0,0.07)', padding: '13px 12px' }}>
          <p style={{ margin: 0, fontSize: '11px', color: '#9b9890' }}>Total value</p>
          <p style={{ margin: '5px 0 0', fontSize: '19px', fontWeight: 500, color: '#1a1a18' }}>€{(total / 1000).toFixed(0)}k</p>
        </div>
        <div style={{ flex: 1, background: 'white', borderRadius: '14px', border: '0.5px solid rgba(0,0,0,0.07)', padding: '13px 12px' }}>
          <p style={{ margin: 0, fontSize: '11px', color: '#9b9890' }}>Closing soon</p>
          <p style={{ margin: '5px 0 0', fontSize: '19px', fontWeight: 500, color: '#1D9E75' }}>€{(closing / 1000).toFixed(0)}k</p>
        </div>
        <div style={{ flex: 1, background: '#FFF8F8', borderRadius: '14px', border: '0.5px solid rgba(226,75,74,0.15)', padding: '13px 12px' }}>
          <p style={{ margin: 0, fontSize: '11px', color: '#E24B4A' }}>At risk</p>
          <p style={{ margin: '5px 0 0', fontSize: '19px', fontWeight: 500, color: '#E24B4A' }}>€{(atRisk / 1000).toFixed(0)}k</p>
        </div>
      </div>

      {/* Deals list */}
      <div style={{ padding: '0 24px' }}>
        <p style={{ margin: '0 0 12px', fontSize: '12px', fontWeight: 500, color: '#9b9890', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Active deals
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {deals.map((deal, i) => (
            <div key={i} style={{
              background: deal.risk ? '#FFF8F8' : 'white',
              borderRadius: '16px',
              border: deal.risk ? '0.5px solid rgba(226,75,74,0.18)' : '0.5px solid rgba(0,0,0,0.07)',
              padding: '14px 16px',
              cursor: 'pointer',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '34px', height: '34px', borderRadius: '10px',
                    background: deal.bg, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: '11px', fontWeight: 500, color: deal.textColor,
                  }}>
                    {deal.initials}
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: '#1a1a18' }}>{deal.name}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: deal.risk ? '#E24B4A' : '#9b9890' }}>{deal.contact}</p>
                  </div>
                </div>
                <p style={{ margin: 0, fontSize: '15px', fontWeight: 500, color: '#1a1a18' }}>
                  €{(deal.value / 1000).toFixed(0)}k
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div className="progress-bar" style={{ flex: 1 }}>
                  <div className="progress-fill" style={{ width: `${deal.progress}%`, background: deal.color }} />
                </div>
                <span style={{ fontSize: '11px', color: deal.risk ? '#E24B4A' : '#9b9890', flexShrink: 0 }}>{deal.stage}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <BottomNav />
    </main>
  )
}
