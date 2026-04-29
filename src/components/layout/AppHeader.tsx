'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useMemo } from 'react'

interface BreadcrumbSegment {
  label: string
  href?: string
}

interface AppHeaderProps {
  /** Optional override — if not provided, breadcrumbs are inferred from pathname */
  breadcrumbs?: BreadcrumbSegment[]
  /** Notification count to show on the bell badge */
  notificationCount?: number
  /** Feedback link or callback */
  onFeedback?: () => void
}

const ROUTE_LABELS: Record<string, string> = {
  '': 'Home',
  capture: 'Capture',
  tasks: 'Tasks',
  deals: 'Deals',
  pipeline: 'Pipeline',
  contacts: 'Contacts',
  companies: 'Companies',
  analytics: 'Analytics',
  'ai-sandbox': 'AI Sandbox',
  settings: 'Settings',
  tracking: 'Tracking',
}

function inferBreadcrumbs(pathname: string): BreadcrumbSegment[] {
  if (pathname === '/' || pathname === '') {
    return [{ label: 'Home' }]
  }

  const segments = pathname.split('/').filter(Boolean)
  const crumbs: BreadcrumbSegment[] = [{ label: 'Workspace', href: '/' }]

  let pathSoFar = ''
  segments.forEach((seg, i) => {
    pathSoFar += `/${seg}`
    const isLast = i === segments.length - 1
    // Skip dynamic IDs (treat them as the parent's detail view)
    const looksLikeId = /^[0-9a-f-]{8,}$/i.test(seg) || /^\d+$/.test(seg)

    if (looksLikeId) {
      crumbs.push({ label: 'Detail' })
      return
    }

    const label = ROUTE_LABELS[seg] || seg.charAt(0).toUpperCase() + seg.slice(1)
    crumbs.push(isLast ? { label } : { label, href: pathSoFar })
  })

  return crumbs
}

export default function AppHeader({
  breadcrumbs,
  notificationCount = 0,
  onFeedback,
}: AppHeaderProps) {
  const pathname = usePathname()
  const crumbs = useMemo(
    () => breadcrumbs ?? inferBreadcrumbs(pathname),
    [breadcrumbs, pathname]
  )

  return (
    <header
      style={{
        height: 52,
        flexShrink: 0,
        background: 'white',
        borderBottom: '0.5px solid rgba(0,0,0,0.07)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        gap: 12,
        position: 'sticky',
        top: 0,
        zIndex: 30,
      }}
    >
      {/* Breadcrumbs */}
      <nav
        aria-label="Breadcrumb"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
        }}
      >
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              {i > 0 && (
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 10 10"
                  fill="none"
                  style={{ flexShrink: 0 }}
                >
                  <path
                    d="M3.5 2L6.5 5l-3 3"
                    stroke="#9b9890"
                    strokeWidth="1.3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
              {crumb.href && !isLast ? (
                <Link
                  href={crumb.href}
                  style={{
                    fontSize: 13,
                    color: '#6b6960',
                    textDecoration: 'none',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  className="app-header-crumb"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: isLast ? 500 : 400,
                    color: isLast ? '#1a1a18' : '#6b6960',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {crumb.label}
                </span>
              )}
            </div>
          )
        })}
      </nav>

      {/* Utility cluster */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <button
          onClick={onFeedback}
          style={pillButtonStyle}
          className="app-header-pill"
        >
          Feedback
        </button>

        <a
          href="https://docs.rollable.app"
          target="_blank"
          rel="noopener noreferrer"
          style={{ ...pillButtonStyle, textDecoration: 'none' }}
          className="app-header-pill"
        >
          Docs
        </a>

        <button
          aria-label="Search"
          style={iconButtonStyle}
          className="app-header-icon"
          onClick={() => {
            // Trigger global search modal — wire this up to your existing search
            const event = new CustomEvent('open-search')
            window.dispatchEvent(event)
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="6" cy="6" r="4.25" stroke="#6b6960" strokeWidth="1.4" />
            <path d="M9 9l3 3" stroke="#6b6960" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </button>

        <button
          aria-label="Notifications"
          style={{ ...iconButtonStyle, position: 'relative' }}
          className="app-header-icon"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M3 6a4 4 0 018 0v2.5l1 1.5H2l1-1.5V6z"
              stroke="#6b6960"
              strokeWidth="1.3"
              strokeLinejoin="round"
            />
            <path d="M5.5 11h3" stroke="#6b6960" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          {notificationCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: 4,
                right: 4,
                minWidth: notificationCount > 9 ? 14 : 6,
                height: notificationCount > 9 ? 14 : 6,
                borderRadius: 7,
                background: '#E24B4A',
                color: 'white',
                fontSize: 9,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: notificationCount > 9 ? '0 3px' : 0,
                border: '1.5px solid white',
                boxSizing: 'border-box',
              }}
            >
              {notificationCount > 9 ? (notificationCount > 99 ? '99+' : notificationCount) : ''}
            </span>
          )}
        </button>
      </div>

      <style>{`
        .app-header-pill:hover { background: #f5f4f0 !important; color: #1a1a18 !important; }
        .app-header-icon:hover { background: #f5f4f0 !important; }
        .app-header-crumb:hover { color: #1a1a18 !important; }
      `}</style>
    </header>
  )
}

const pillButtonStyle: React.CSSProperties = {
  background: 'transparent',
  border: '0.5px solid rgba(0,0,0,0.07)',
  borderRadius: 16,
  padding: '5px 12px',
  fontSize: 12,
  color: '#6b6960',
  cursor: 'pointer',
  fontFamily: 'inherit',
  transition: 'background 0.15s, color 0.15s',
  display: 'inline-flex',
  alignItems: 'center',
}

const iconButtonStyle: React.CSSProperties = {
  background: 'transparent',
  border: '0.5px solid rgba(0,0,0,0.07)',
  borderRadius: '50%',
  width: 28,
  height: 28,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'background 0.15s',
}
