export default function HomeLoading() {
  return (
    <main style={{ minHeight: '100dvh', background: '#f5f4f0', paddingBottom: '100px' }}>
      <div style={{ padding: '56px 24px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ width: '80px', height: '13px', background: 'rgba(0,0,0,0.06)', borderRadius: '6px', marginBottom: '8px' }} />
          <div style={{ width: '200px', height: '22px', background: 'rgba(0,0,0,0.06)', borderRadius: '6px' }} />
          <div style={{ width: '120px', height: '13px', background: 'rgba(0,0,0,0.06)', borderRadius: '6px', marginTop: '6px' }} />
        </div>
        <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'rgba(0,0,0,0.06)' }} />
      </div>

      <div style={{ padding: '0 24px 16px' }}>
        <div style={{ height: '48px', background: 'white', borderRadius: '16px', border: '0.5px solid rgba(0,0,0,0.07)' }} />
      </div>

      <div style={{ padding: '0 24px 20px' }}>
        <div style={{ width: '100px', height: '12px', background: 'rgba(0,0,0,0.06)', borderRadius: '6px', marginBottom: '12px' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ height: '60px', background: 'white', borderRadius: '14px', border: '0.5px solid rgba(0,0,0,0.07)' }} />
          ))}
        </div>
      </div>

      <div style={{ padding: '0 24px' }}>
        <div style={{ width: '120px', height: '12px', background: 'rgba(0,0,0,0.06)', borderRadius: '6px', marginBottom: '12px' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[1, 2].map(i => (
            <div key={i} style={{ height: '80px', background: 'white', borderRadius: '14px', border: '0.5px solid rgba(0,0,0,0.07)' }} />
          ))}
        </div>
      </div>
    </main>
  )
}
