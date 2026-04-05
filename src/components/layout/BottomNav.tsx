'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function BottomNav() {
  const pathname = usePathname()

  const isPlanning = pathname === '/planning'
  const isTracking = pathname === '/tracking'

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: '390px',
        background: '#f5f4f0',
        borderTop: '0.5px solid rgba(0,0,0,0.07)',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'flex-end',
        paddingTop: '12px',
        paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
        zIndex: 50,
      }}
    >
      {/* Planning */}
      <Link href="/planning" style={{ textDecoration: 'none' }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '4px',
          opacity: isPlanning ? 1 : 0.35,
          paddingBottom: '2px',
          transition: 'opacity 0.2s ease',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="3" width="8" height="8" rx="2" stroke="#1a1a18" strokeWidth="1.5" />
            <rect x="13" y="3" width="8" height="8" rx="2" stroke="#1a1a18" strokeWidth="1.5" />
            <rect x="3" y="13" width="8" height="8" rx="2" stroke="#1a1a18" strokeWidth="1.5" />
            <rect x="13" y="13" width="8" height="8" rx="2" stroke="#1a1a18" strokeWidth="1.5" />
          </svg>
          <span style={{ fontSize: '10px', color: '#1a1a18', fontWeight: isPlanning ? 500 : 400 }}>Planning</span>
        </div>
      </Link>

      {/* Capture button */}
      <Link href="/capture" style={{ textDecoration: 'none' }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '6px',
          marginTop: '-32px',
          position: 'relative',
        }}>
          {/* Pulse rings */}
          <div style={{
            position: 'absolute',
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: '#1a1a18',
            opacity: 0.15,
          }} className="capture-ring-1" />
          <div style={{
            position: 'absolute',
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: '#1a1a18',
            opacity: 0.08,
          }} className="capture-ring-2" />

          {/* Button */}
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: '#1a1a18',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            zIndex: 1,
            boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
          }} className="capture-btn">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <span style={{
            fontSize: '11px',
            fontWeight: 500,
            color: '#1a1a18',
            position: 'relative',
            zIndex: 1,
          }}>Capture</span>
        </div>
      </Link>

      {/* Tracking */}
      <Link href="/tracking" style={{ textDecoration: 'none' }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '4px',
          opacity: isTracking ? 1 : 0.35,
          paddingBottom: '2px',
          transition: 'opacity 0.2s ease',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M3 12h18M3 6h18M3 18h18" stroke="#1a1a18" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span style={{ fontSize: '10px', color: '#1a1a18', fontWeight: isTracking ? 500 : 400 }}>Tracking</span>
        </div>
      </Link>
    </nav>
  )
}
