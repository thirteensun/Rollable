export default function PlanningLoading() {
  return (
    <main style={{ minHeight: '100dvh', background: '#f5f4f0', paddingBottom: '100px' }}>
      <div style={{ padding: '56px 24px 20px' }}>
        <div style={{ width: '60px', height: '13px', background: 'rgba(0,0,0,0.06)', borderRadius: '6px', marginBottom: '8px' }} />
        <div style={{ width: '120px', height: '26px', background: 'rgba(0,0,0,0.06)', borderRadius: '6px' }} />
      </div>
      <div style={{ padding: '0 24px' }}>
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} style={{ height: '56px', background: 'white', borderRadius: '14px', border: '0.5px solid rgba(0,0,0,0.07)', marginBottom: '8px' }} />
        ))}
      </div>
    </main>
  )
}
