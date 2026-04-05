import BottomNav from '@/components/layout/BottomNav'

export default function PlanningPage() {
  return (
    <main style={{ minHeight: '100dvh', background: '#f5f4f0', paddingBottom: '100px' }}>
      <div style={{ padding: '56px 24px 24px' }}>
        <p style={{ margin: 0, fontSize: '13px', color: '#9b9890' }}>
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}
        </p>
        <p style={{ margin: '4px 0 0', fontSize: '26px', fontWeight: 500, color: '#1a1a18' }}>Planning</p>
      </div>

      {/* This week header */}
      <div style={{ padding: '0 24px 16px' }}>
        <p style={{ margin: '0 0 12px', fontSize: '12px', fontWeight: 500, color: '#9b9890', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Overdue
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[
            { title: 'Send proposal to TechCorp', contact: 'Maria Kovacs', due: '2 days ago', urgent: true },
            { title: 'Follow up on demo feedback', contact: 'Ingrid Bakke', due: 'Yesterday', urgent: true },
          ].map((task, i) => (
            <div key={i} style={{
              background: '#FFF8F8',
              borderRadius: '14px',
              border: '0.5px solid rgba(226,75,74,0.15)',
              padding: '13px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}>
              <div style={{
                width: '20px', height: '20px', borderRadius: '50%',
                border: '1.5px solid #E24B4A', flexShrink: 0,
              }} />
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: '#1a1a18' }}>{task.title}</p>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#E24B4A' }}>{task.contact} · {task.due}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '0 24px 16px' }}>
        <p style={{ margin: '0 0 12px', fontSize: '12px', fontWeight: 500, color: '#9b9890', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Today
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[
            { title: 'Call with Björn — renewal discussion', contact: 'Nordic Solutions', time: '14:00' },
            { title: 'Demo walkthrough', contact: 'Oslo Retail · Ingrid', time: '16:30' },
          ].map((task, i) => (
            <div key={i} style={{
              background: 'white', borderRadius: '14px',
              border: '0.5px solid rgba(0,0,0,0.07)',
              padding: '13px 16px', display: 'flex', alignItems: 'center', gap: '12px',
            }}>
              <div style={{
                width: '20px', height: '20px', borderRadius: '50%',
                border: '1.5px solid rgba(0,0,0,0.15)', flexShrink: 0,
              }} />
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: '#1a1a18' }}>{task.title}</p>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#9b9890' }}>{task.contact}</p>
              </div>
              <span style={{ fontSize: '12px', color: '#EF9F27', fontWeight: 500 }}>{task.time}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '0 24px' }}>
        <p style={{ margin: '0 0 12px', fontSize: '12px', fontWeight: 500, color: '#9b9890', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          This week
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[
            { title: 'Send revised quote to Sara', contact: 'Lindqvist AB', day: 'Tomorrow' },
            { title: 'Prepare Bergen Manufacturing pitch', contact: 'Bergen Mfg', day: 'Thursday' },
            { title: 'Check in — Magnus', contact: 'TechGroup AS', day: 'Friday' },
          ].map((task, i) => (
            <div key={i} style={{
              background: 'white', borderRadius: '14px',
              border: '0.5px solid rgba(0,0,0,0.07)',
              padding: '13px 16px', display: 'flex', alignItems: 'center', gap: '12px',
            }}>
              <div style={{
                width: '20px', height: '20px', borderRadius: '50%',
                border: '1.5px solid rgba(0,0,0,0.15)', flexShrink: 0,
              }} />
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: '#1a1a18' }}>{task.title}</p>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#9b9890' }}>{task.contact}</p>
              </div>
              <span style={{ fontSize: '12px', color: '#9b9890' }}>{task.day}</span>
            </div>
          ))}
        </div>
      </div>

      <BottomNav />
    </main>
  )
}
