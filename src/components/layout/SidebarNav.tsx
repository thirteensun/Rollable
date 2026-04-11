'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function SidebarNav() {
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === '/home') return pathname === '/' || pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <aside style={{
      width: 210,
      minHeight: '100dvh',
      background: 'white',
      borderRight: '0.5px solid rgba(0,0,0,0.07)',
      display: 'flex',
      flexDirection: 'column',
      padding: '20px 0 16px',
      flexShrink: 0,
      position: 'fixed',
      top: 0,
      left: 0,
      bottom: 0,
      zIndex: 40,
    }}>

      {/* Logo */}
      <div style={{ padding: '0 18px 20px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 24, height: 24, borderRadius: 8,
          background: '#1a1a18',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <circle cx="6" cy="6" r="4" fill="white" opacity="0.9"/>
            <circle cx="6" cy="6" r="2" fill="#1a1a18"/>
          </svg>
        </div>
        <span style={{ fontSize: 13, fontWeight: 500, color: '#1a1a18', letterSpacing: '-0.01em' }}>
          SDM
        </span>
      </div>

      {/* Main nav */}
      <div style={{ padding: '0 10px', flex: 1 }}>

        <div style={{ fontSize: 10, color: '#9b9890', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '0 8px', marginBottom: 4 }}>
          Workspace
        </div>

        <NavItem href="/" active={isActive('/home')} icon={
          <svg viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4">
            <path d="M1.5 6.5L7.5 1.5L13.5 6.5V13H9.5V9.5H5.5V13H1.5V6.5Z" strokeLinejoin="round"/>
          </svg>
        }>
          Home
        </NavItem>

        <NavItem href="/tracking" active={isActive('/tracking')} icon={
          <svg viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4">
            <rect x="1" y="2" width="4" height="11" rx="1.5"/>
            <rect x="6" y="2" width="4" height="7" rx="1.5"/>
            <rect x="11" y="2" width="3" height="9" rx="1.5"/>
          </svg>
        }>
          Pipeline
        </NavItem>

        <NavItem href="/planning" active={isActive('/planning')} icon={
          <svg viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4">
            <rect x="1.5" y="1.5" width="12" height="12" rx="2.5"/>
            <path d="M4 7.5l2 2 4-4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        } badge={5} badgeColor="#EF9F27">
          Tasks
        </NavItem>

        <NavItem href="/analytics" active={isActive('/analytics')} icon={
          <svg viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4">
            <path d="M1.5 12L5 7.5l3 2.5 3-5 2.5 3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        }>
          Analytics
        </NavItem>

        <NavItem href="/ai-sandbox" active={isActive('/ai-coach')} icon={
          <svg viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4">
            <path d="M7.5 1.5a6 6 0 100 12 6 6 0 000-12z"/>
            <path d="M7.5 5v3.5l2 2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        } badge={3} badgeColor="#E24B4A">
          AI Sandbox
        </NavItem>

        <div style={{ fontSize: 10, color: '#9b9890', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '0 8px', margin: '16px 0 4px' }}>
          CRM
        </div>

        <NavItem href="/contacts" active={isActive('/contacts')} icon={
          <svg viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4">
            <circle cx="7.5" cy="5" r="3"/>
            <path d="M1.5 13.5c0-3 2.7-5 6-5s6 2 6 5" strokeLinecap="round"/>
          </svg>
        }>
          Contacts
        </NavItem>

        <NavItem href="/companies" active={isActive('/companies')} icon={
          <svg viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4">
            <rect x="1.5" y="5" width="12" height="8.5" rx="2"/>
            <path d="M5 5V3.5a2.5 2.5 0 015 0V5" strokeLinecap="round"/>
          </svg>
        }>
          Companies
        </NavItem>

        <NavItem href="/capture" active={isActive('/capture')} icon={
          <svg viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4">
            <circle cx="7.5" cy="7.5" r="6"/>
            <path d="M7.5 4.5v6M4.5 7.5h6" strokeLinecap="round"/>
          </svg>
        }>
          Capture
        </NavItem>

        <NavItem href="/settings" active={isActive('/settings')} icon={
          <svg viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4">
            <circle cx="7.5" cy="7.5" r="2.5"/>
            <path d="M7.5 1.5v1M7.5 12.5v1M1.5 7.5h1M12.5 7.5h1M3.1 3.1l.7.7M11.2 11.2l.7.7M11.2 3.1l-.7.7M3.8 11.2l-.7.7" strokeLinecap="round"/>
          </svg>
        }>
          Settings
        </NavItem>

      </div>

      {/* Bottom user row */}
      <div style={{ padding: '12px 10px 0', borderTop: '0.5px solid rgba(0,0,0,0.07)' }}>
        <Link href="/settings" style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 8px',
          borderRadius: 9,
          textDecoration: 'none',
        }}
          className="sidebar-user-row"
        >
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: '#1a1a18',
            color: 'white',
            fontSize: 10, fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            JS
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#1a1a18' }}>Jordan S.</div>
            <div style={{ fontSize: 11, color: '#9b9890' }}>Sales Rep</div>
          </div>
        </Link>
      </div>

      <style>{`
        .sidebar-user-row:hover { background: #f5f4f0; }
      `}</style>
    </aside>
  )
}

function NavItem({
  href,
  active,
  icon,
  badge,
  badgeColor,
  children,
}: {
  href: string
  active: boolean
  icon: React.ReactNode
  badge?: number
  badgeColor?: string
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        padding: '7px 8px',
        borderRadius: 9,
        fontSize: 13,
        color: active ? '#1a1a18' : '#6b6960',
        fontWeight: active ? 500 : 400,
        background: active ? '#f5f4f0' : 'transparent',
        textDecoration: 'none',
        marginBottom: 1,
        transition: 'background 0.15s, color 0.15s',
      }}
      className="sidebar-nav-item"
    >
      <span style={{ width: 15, height: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {icon}
      </span>
      <span style={{ flex: 1 }}>{children}</span>
      {badge && (
        <span style={{
          background: badgeColor ?? '#1a1a18',
          color: 'white',
          fontSize: 10,
          fontWeight: 500,
          borderRadius: 10,
          padding: '1px 6px',
          minWidth: 18,
          textAlign: 'center',
        }}>
          {badge}
        </span>
      )}
      <style>{`
        .sidebar-nav-item:hover {
          background: #f5f4f0 !important;
          color: #1a1a18 !important;
        }
      `}</style>
    </Link>
  )
}