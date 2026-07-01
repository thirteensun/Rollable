'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useMemo, useState, useEffect, useRef } from 'react'

interface BreadcrumbSegment {
  label: string
  href?: string
}

interface Announcement {
  id: string
  title: string
  body: string
  image_url: string | null
  link_url: string | null
  published_at: string
}

interface AppHeaderProps {
  breadcrumbs?: BreadcrumbSegment[]
  notificationCount?: number
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
  upgrade: 'Upgrade',
}

function inferBreadcrumbs(pathname: string): BreadcrumbSegment[] {
  if (pathname === '/' || pathname === '') return [{ label: 'Home' }]
  const segments = pathname.split('/').filter(Boolean)
  const crumbs: BreadcrumbSegment[] = [{ label: 'Workspace', href: '/' }]
  let pathSoFar = ''
  segments.forEach((seg, i) => {
    pathSoFar += `/${seg}`
    const isLast = i === segments.length - 1
    const looksLikeId = /^[0-9a-f-]{8,}$/i.test(seg) || /^\d+$/.test(seg)
    if (looksLikeId) { crumbs.push({ label: 'Detail' }); return }
    const label = ROUTE_LABELS[seg] || seg.charAt(0).toUpperCase() + seg.slice(1)
    crumbs.push(isLast ? { label } : { label, href: pathSoFar })
  })
  return crumbs
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return mins <= 1 ? 'just now' : `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export default function AppHeader({ breadcrumbs, notificationCount = 0, onFeedback }: AppHeaderProps) {
  const pathname = usePathname()
  const crumbs = useMemo(() => breadcrumbs ?? inferBreadcrumbs(pathname), [breadcrumbs, pathname])

  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [readIds, setReadIds] = useState<Set<string>>(new Set())
  const [panelOpen, setPanelOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/announcements')
      .then(r => r.json())
      .then(data => setAnnouncements(Array.isArray(data) ? data : []))
      .catch(() => {})

    const stored = localStorage.getItem('announcements_read')
    if (stored) setReadIds(new Set(JSON.parse(stored)))
  }, [])

  // Close panel on outside click
  useEffect(() => {
    if (!panelOpen) return
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setPanelOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [panelOpen])

  const unreadCount = announcements.filter(a => !readIds.has(a.id)).length

  const openPanel = () => {
    setPanelOpen(o => !o)
    // Mark all as read
    const allIds = announcements.map(a => a.id)
    const updated = new Set([...Array.from(readIds), ...allIds])
    setReadIds(updated)
    localStorage.setItem('announcements_read', JSON.stringify(Array.from(updated)))
  }

  return (
    <header style={{
      height: 52, flexShrink: 0, background: 'var(--bg-card)',
      borderBottom: '0.5px solid var(--border-subtle)',
      display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12,
    }}>
      {/* Breadcrumbs */}
      <nav aria-label="Breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0, overflow: 'hidden' }}>
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              {i > 0 && (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ flexShrink: 0 }}>
                  <path d="M3.5 2L6.5 5l-3 3" stroke="#9b9890" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
              {crumb.href && !isLast ? (
                <Link href={crumb.href} style={{ fontSize: 13, color: '#6b6960', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} className="app-header-crumb">
                  {crumb.label}
                </Link>
              ) : (
                <span style={{ fontSize: 13, fontWeight: isLast ? 500 : 400, color: isLast ? '#1a1a18' : '#6b6960', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {crumb.label}
                </span>
              )}
            </div>
          )
        })}
      </nav>

      {/* Utility cluster */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <button onClick={onFeedback} style={pillButtonStyle} className="app-header-pill">
          Feedback
        </button>

        <button
          aria-label="Search"
          style={iconButtonStyle}
          className="app-header-icon"
          onClick={() => window.dispatchEvent(new CustomEvent('open-search'))}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="6" cy="6" r="4.25" stroke="#6b6960" strokeWidth="1.4"/>
            <path d="M9 9l3 3" stroke="#6b6960" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
        </button>

        {/* Bell + panel */}
        <div ref={panelRef} style={{ position: 'relative' }}>
          <button
            aria-label="Announcements"
            onClick={openPanel}
            style={{ ...iconButtonStyle, position: 'relative' }}
            className="app-header-icon"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 6a4 4 0 018 0v2.5l1 1.5H2l1-1.5V6z" stroke="#6b6960" strokeWidth="1.3" strokeLinejoin="round"/>
              <path d="M5.5 11h3" stroke="#6b6960" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute', top: 4, right: 4,
                minWidth: unreadCount > 9 ? 14 : 6,
                height: unreadCount > 9 ? 14 : 6,
                borderRadius: 7, background: '#E24B4A', color: 'white',
                fontSize: 9, fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: unreadCount > 9 ? '0 3px' : 0,
                border: '1.5px solid white', boxSizing: 'border-box',
              }}>
                {unreadCount > 9 ? '9+' : ''}
              </span>
            )}
          </button>

          {/* Dropdown panel */}
          {panelOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 8px)', right: 0,
              width: 340, maxHeight: 480,
              background: 'var(--bg-card)', borderRadius: 'var(--radius-xl)',
              border: '0.5px solid var(--border)',
              zIndex: 50, overflow: 'hidden', display: 'flex', flexDirection: 'column',
            }}>
              <div style={{ padding: '14px 16px 10px', borderBottom: '0.5px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a18', flex: 1 }}>What's new</span>
              </div>

              <div style={{ overflowY: 'auto', flex: 1 }}>
                {announcements.length === 0 ? (
                  <div style={{ padding: '32px 16px', textAlign: 'center', color: '#9b9890', fontSize: 13 }}>
                    No announcements yet
                  </div>
                ) : (
                  announcements.map((a, idx) => {
                    const inner = (
                      <>
                        <div style={{ marginBottom: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a18', lineHeight: 1.4 }}>{a.title}</span>
                        </div>
                        <p style={{ margin: '0 0 8px', fontSize: 12, color: '#6b6960', lineHeight: 1.5 }}>{a.body}</p>
                        {a.image_url && (
                          <img src={a.image_url} alt="" style={{ width: '100%', borderRadius: 10, marginBottom: 8, display: 'block', objectFit: 'cover', maxHeight: 160 }} />
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 11, color: '#c8c5be' }}>{relativeTime(a.published_at)}</span>
                          {a.link_url && <span style={{ fontSize: 11, color: '#185FA5' }}>Learn more →</span>}
                        </div>
                      </>
                    )
                    const wrapperStyle: React.CSSProperties = {
                      padding: '14px 16px',
                      borderBottom: idx < announcements.length - 1 ? '0.5px solid rgba(0,0,0,0.05)' : 'none',
                      display: 'block', textDecoration: 'none',
                      transition: 'background 0.15s',
                    }
                    return a.link_url ? (
                      <Link key={a.id} href={a.link_url} onClick={() => setPanelOpen(false)} style={{ ...wrapperStyle, color: 'inherit' }} className="announcement-item">
                        {inner}
                      </Link>
                    ) : (
                      <div key={a.id} style={wrapperStyle}>
                        {inner}
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .app-header-pill:hover { background: #f5f4f0 !important; color: #1a1a18 !important; }
        .app-header-icon:hover { background: #f5f4f0 !important; }
        .app-header-crumb:hover { color: #1a1a18 !important; }
        .announcement-item:hover { background: #f9f8f6 !important; }
      `}</style>
    </header>
  )
}

const pillButtonStyle: React.CSSProperties = {
  background: 'transparent', border: '0.5px solid var(--border)',
  borderRadius: 'var(--radius-md)', padding: '5px 12px', fontSize: 12, color: 'var(--fg-muted)',
  cursor: 'pointer', fontFamily: 'inherit',
  transition: 'background 0.15s, color 0.15s',
  display: 'inline-flex', alignItems: 'center',
}

const iconButtonStyle: React.CSSProperties = {
  background: 'transparent', border: '0.5px solid var(--border)',
  borderRadius: 'var(--radius-md)', width: 28, height: 28, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  transition: 'background 0.15s',
}
