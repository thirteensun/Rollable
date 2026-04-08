'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function BottomNav() {
  const pathname = usePathname()
  const isHome = pathname === '/' || pathname === '/planning'
  const isTracking = pathname === '/tracking'
  const hideNav = pathname === '/login' || pathname === '/onboarding' || pathname.startsWith('/auth')

  if (hideNav) return null

  return (
    <nav style={{
      width: '100%',
      background: 'rgba(245, 244, 240, 0.95)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderTop: '0.5px solid rgba(0,0,0,0.07)',
      display: 'flex',
      justifyContent: 'space-around',
      alignItems: 'flex-end',
      paddingTop: '12px',
      paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
      flexShrink: 0,
    }}>
      <Link href="/" style={{ textDecoration: 'none' }}>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
          opacity: isHome ? 1 : 0.35, paddingBottom: '2px',
          transition: 'opacity 0.2s ease',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" stroke="#1a1a18" strokeWidth="1.5" strokeLinejoin="round"/>
            <path d="M9 21V12h6v9" stroke="#1a1a18" strokeWidth="1.5" strokeLinejoin="round"/>
          </svg>
          <span style={{ fontSize: '10px', color: '#1a1a18', fontWeight: isHome ? 500 : 400 }}>Home</span>
        </div>
      </Link>

      <Link href="/capture" style={{ textDecoration: 'none' }}>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
          marginTop: '-32px', position: 'relative',
        }}>
          <div style={{ position: 'absolute', width: '64px', height: '64px', borderRadius: '50%', background: '#1a1a18', opacity: 0.15 }} className="capture-ring-1" />
          <div style={{ position: 'absolute', width: '64px', height: '64px', borderRadius: '50%', background: '#1a1a18', opacity: 0.08 }} className="capture-ring-2" />
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%', background: '#1a1a18',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative', zIndex: 1, boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
          }} className="capture-btn">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      </Link>

      <Link href="/tracking" style={{ textDecoration: 'none' }}>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
          opacity: isTracking ? 1 : 0.35, paddingBottom: '2px',
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