import BottomNav from '@/components/layout/BottomNav'

export default function HomePage() {
  return (
    <main style={{
      minHeight: '100dvh',
      background: '#f5f4f0',
      paddingBottom: '100px',
    }}>
      {/* Header */}
      <div style={{ padding: '56px 24px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <p style={{ margin: 0, fontSize: '13px', color: '#9b9890' }}>
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: '26px', fontWeight: 500, color: '#1a1a18' }}>
            Good morning
          </p>
        </div>
        <div style={{
          width: '38px', height: '38px', borderRadius: '50%',
          background: '#1a1a18', display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: '13px', fontWeight: 500, color: '#f5f4f0'
        }}>
          You
        </div>
      </div>

      {/* Search */}
      <div style={{ padding: '0 24px 16px' }}>
        <div style={{
          background: 'white', borderRadius: '16px',
          border: '0.5px solid rgba(0,0,0,0.07)',
          padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '10px'
        }}>
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="5.5" stroke="#9b9890" strokeWidth="1.2" />
            <path d="M11 11l2.5 2.5" stroke="#9b9890" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          <span style={{ fontSize: '14px', color: '#9b9890' }}>Search contacts, deals, notes...</span>
        </div>
      </div>

      {/* Today's focus */}
      <div style={{ padding: '0 24px 20px' }}>
        <p style={{ margin: '0 0 12px', fontSize: '12px', fontWeight: 500, color: '#9b9890', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Today's focus
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }} className="stagger">
          {[
            { color: '#E24B4A', title: 'Follow up — Maria at TechCorp', sub: 'Proposal sent 5 days ago, no reply' },
            { color: '#EF9F27', title: 'Call with Björn — 14:00', sub: 'Nordic Solutions, renewal discussion' },
            { color: '#1D9E75', title: 'Demo — Ingrid, Oslo Retail', sub: '16:30 today · €28k deal' },
          ].map((item, i) => (
            <div key={i} className="animate-fade-in-up" style={{
              background: 'white', borderRadius: '14px',
              border: '0.5px solid rgba(0,0,0,0.07)',
              padding: '13px 14px', display: 'flex', alignItems: 'center', gap: '12px',
              cursor: 'pointer',
            }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.color, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: '#1a1a18' }}>{item.title}</p>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#9b9890' }}>{item.sub}</p>
              </div>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M6 4l4 4-4 4" stroke="#c8c5be" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </div>
          ))}
        </div>
      </div>

      {/* Recent activity */}
      <div style={{ padding: '0 24px' }}>
        <p style={{ margin: '0 0 12px', fontSize: '12px', fontWeight: 500, color: '#9b9890', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Recent activity
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[
            { initials: 'MT', name: 'Magnus Thorsen', time: '2h ago', bg: '#E6F1FB', color: '#185FA5', note: 'Meeting logged — interested in enterprise plan, budget €40k. Follow-up next week.' },
            { initials: 'SL', name: 'Sara Lindqvist', time: 'Yesterday', bg: '#E1F5EE', color: '#0F6E56', note: 'WhatsApp thread captured — price objection noted, sending revised quote.' },
          ].map((item, i) => (
            <div key={i} style={{
              background: 'white', borderRadius: '14px',
              border: '0.5px solid rgba(0,0,0,0.07)', padding: '13px 14px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <div style={{
                  width: '26px', height: '26px', borderRadius: '50%',
                  background: item.bg, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: '10px', fontWeight: 500, color: item.color,
                }}>
                  {item.initials}
                </div>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: 500, color: '#1a1a18' }}>{item.name}</p>
                <p style={{ margin: '0 0 0 auto', fontSize: '11px', color: '#9b9890' }}>{item.time}</p>
              </div>
              <p style={{ margin: 0, fontSize: '13px', color: '#6b6960', lineHeight: 1.5 }}>{item.note}</p>
            </div>
          ))}
        </div>
      </div>

      <BottomNav />
    </main>
  )
}
