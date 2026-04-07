export default function SettingsLoading() {
  return (
    <main style={{ minHeight: '100dvh', background: '#f5f4f0', paddingBottom: '100px' }}>
      <div style={{ padding: '56px 24px 24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(0,0,0,0.06)' }} />
        <div style={{ width: '80px', height: '20px', background: 'rgba(0,0,0,0.06)', borderRadius: '6px' }} />
      </div>
      <div style={{ padding: '0 24px 16px' }}>
        <div style={{ height: '88px', background: 'white', borderRadius: '18px', border: '0.5px solid rgba(0,0,0,0.07)' }} />
      </div>
      <div style={{ padding: '0 24px 16px' }}>
        <div style={{ height: '140px', background: 'white', borderRadius: '18px', border: '0.5px solid rgba(0,0,0,0.07)' }} />
      </div>
      <div style={{ padding: '0 24px' }}>
        <div style={{ height: '60px', background: 'white', borderRadius: '18px', border: '0.5px solid rgba(0,0,0,0.07)' }} />
      </div>
    </main>
  )
}
