'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type Props = {
  userName: string
  userInitials: string
  userRole: string
  userAvatar?: string
}

export default function SidebarNav({ userName, userInitials, userRole, userAvatar }: Props) {
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <aside style={{
      width: 210, minHeight: '100dvh', background: 'white',
      borderRight: '0.5px solid rgba(0,0,0,0.07)',
      display: 'flex', flexDirection: 'column',
      padding: '20px 0 16px', flexShrink: 0,
      position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 40,
    }}>

      {/* Logo */}
      <div style={{ padding: '0 18px 20px' }}>
        <img
          src="/rollable-logo.svg"
          alt="Rollable"
          style={{ height: 28, width: 'auto' }}
        />
      </div>

      {/* Nav */}
      <div style={{ padding: '0 10px', flex: 1 }}>

        {/* Workspace group */}
        <div style={{ fontSize: 12, color: '#9b9890', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '0 8px', marginBottom: 4 }}>Workspace</div>

        <NavItem href="/" active={pathname === '/'} icon={<svg viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M1.5 6.5L7.5 1.5L13.5 6.5V13H9.5V9.5H5.5V13H1.5V6.5Z" strokeLinejoin="round" /></svg>}>Home</NavItem>

        <NavItem href="/capture" active={isActive('/capture')} icon={<svg viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="7.5" cy="7.5" r="6" /><path d="M7.5 4.5v6M4.5 7.5h6" strokeLinecap="round" /></svg>}>Capture</NavItem>

        <NavItem href="/deals/pipeline" active={isActive('/deals/pipeline')} icon={<svg viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="1" y="2" width="4" height="11" rx="1.5" /><rect x="6" y="2" width="4" height="7" rx="1.5" /><rect x="11" y="2" width="3" height="9" rx="1.5" /></svg>}>Pipeline</NavItem>

        <NavItem href="/tasks" active={isActive('/tasks') || isActive('/planning')} icon={<svg viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="1.5" y="1.5" width="12" height="12" rx="2.5" /><path d="M4 7.5l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" /></svg>}>Tasks</NavItem>

        <NavItem href="/analytics" active={isActive('/analytics')} icon={<svg viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M1.5 12L5 7.5l3 2.5 3-5 2.5 3" strokeLinecap="round" strokeLinejoin="round" /></svg>}>Analytics</NavItem>

        <NavItem href="/ai-sandbox" active={isActive('/ai-sandbox')} icon={<svg viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M7.5 1.5a6 6 0 100 12 6 6 0 000-12z" /><path d="M7.5 5v3.5l2 2" strokeLinecap="round" strokeLinejoin="round" /></svg>}>AI Sandbox</NavItem>

        {/* Records group */}
        <div style={{ fontSize: 12, color: '#9b9890', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '0 8px', margin: '16px 0 4px' }}>Records</div>

        <NavItem href="/deals" active={isActive('/deals') && !isActive('/deals/pipeline')} icon={<svg viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M1.5 7.5h12M7.5 1.5l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>}>Deals</NavItem>

        <NavItem href="/contacts" active={isActive('/contacts')} icon={<svg viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="7.5" cy="5" r="3" /><path d="M1.5 13.5c0-3 2.7-5 6-5s6 2 6 5" strokeLinecap="round" /></svg>}>Contacts</NavItem>

        <NavItem href="/companies" active={isActive('/companies')} icon={<svg viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="1.5" y="5" width="12" height="8.5" rx="2" /><path d="M5 5V3.5a2.5 2.5 0 015 0V5" strokeLinecap="round" /></svg>}>Companies</NavItem>

        <NavItem href="/settings" active={isActive('/settings')} icon={<svg viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="7.5" cy="7.5" r="2.5" /><path d="M7.5 1.5v1M7.5 12.5v1M1.5 7.5h1M12.5 7.5h1M3.1 3.1l.7.7M11.2 11.2l.7.7M11.2 3.1l-.7.7M3.8 11.2l-.7.7" strokeLinecap="round" /></svg>}>Settings</NavItem>

      </div>

      {/* User row */}
      <div style={{ padding: '12px 10px 0', borderTop: '0.5px solid rgba(0,0,0,0.07)' }}>
        <Link href="/settings" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 9, textDecoration: 'none' }} className="sidebar-user-row">
          <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, overflow: 'hidden', background: '#1a1a18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {userAvatar ? (
              <img src={userAvatar} alt={userName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
            ) : (
              <span style={{ color: 'white', fontSize: 10, fontWeight: 600 }}>{userInitials || '?'}</span>
            )}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#1a1a18', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName || 'Account'}</div>
            <div style={{ fontSize: 11, color: '#9b9890', textTransform: 'capitalize' }}>{userRole}</div>
          </div>
        </Link>
      </div>

      <style>{`
        .sidebar-user-row:hover { background: #f5f4f0; }
        .sidebar-nav-item:hover { background: #f5f4f0 !important; color: #1a1a18 !important; }
      `}</style>
    </aside>
  )
}

function NavItem({ href, active, icon, badge, badgeColor, children }: {
  href: string; active: boolean; icon: React.ReactNode
  badge?: number; badgeColor?: string; children: React.ReactNode
}) {
  return (
    <Link href={href} style={{
      display: 'flex', alignItems: 'center', gap: 9,
      padding: '7px 8px', borderRadius: 9, fontSize: 13,
      color: active ? '#1a1a18' : '#6b6960',
      fontWeight: active ? 500 : 400,
      background: active ? '#f5f4f0' : 'transparent',
      textDecoration: 'none', marginBottom: 1,
      transition: 'background 0.15s, color 0.15s',
    }} className="sidebar-nav-item">
      <span style={{ width: 15, height: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1 }}>{children}</span>
      {badge && (
        <span style={{ background: badgeColor ?? '#1a1a18', color: 'white', fontSize: 10, fontWeight: 500, borderRadius: 10, padding: '1px 6px', minWidth: 18, textAlign: 'center' }}>
          {badge}
        </span>
      )}
    </Link>
  )
}