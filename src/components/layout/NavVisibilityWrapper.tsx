'use client'

import { usePathname } from 'next/navigation'
import { useState } from 'react'
import BottomNav from '@/components/layout/BottomNav'
import SidebarNav from '@/components/layout/SidebarNav'
import AppHeader from '@/components/layout/AppHeader'
import FeedbackModal from '@/components/FeedbackModal'

import SearchModal from '@/components/layout/SearchModal'

const HIDDEN_ROUTES = ['/login', '/onboarding', '/auth']

interface Props {
  children: React.ReactNode
  userName: string
  userInitials: string
  userRole: string
  userAvatar: string
  userPlan: string
  appMode?: string
  /** Shown on the header bell; wire feedback from this wrapper (layout is a server component). */
  notificationCount?: number
}

export default function NavVisibilityWrapper({
  children, userName, userInitials, userRole, userAvatar, userPlan, appMode, notificationCount = 0,
}: Props) {
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const pathname = usePathname()
  const hideNav = HIDDEN_ROUTES.some((route) => pathname.startsWith(route))

  // Auth/onboarding pages — no nav, no shell, just the page
  if (hideNav) {
    return <div style={{ minHeight: '100dvh' }}>{children}</div>
  }

  // Normal app pages — full shell with sidebar + bottom nav
  return (
    <>
      <SearchModal />
      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />

      {/* Sidebar — desktop only */}
      <div className="hidden md:block">
        <SidebarNav userName={userName} userInitials={userInitials} userRole={userRole} userAvatar={userAvatar} userPlan={userPlan} appMode={appMode as any} />
      </div>

      <div className="app-shell md:ml-[210px]" data-mode={appMode || 'fire'}>

        {/* ── Desktop: inset card ──────────────────────────────────────────── */}
        {/* content-card in globals.css adds m-2 / rounded-xl / 0.5px border  */}
        <div className="hidden md:flex flex-col flex-1 content-card" style={{ minHeight: 0 }}>
          <AppHeader
            notificationCount={notificationCount}
            onFeedback={() => setFeedbackOpen(true)}
          />
          <main
            className="page-content"
            style={{ flex: 1, overflowY: 'auto', viewTransitionName: 'page-content' }}
          >
            <div className="px-8 py-6 pb-8 max-w-[1200px] mx-auto">
              {children}
            </div>
          </main>
        </div>

        {/* ── Mobile: full-bleed layout ────────────────────────────────────── */}
        <div className="flex flex-col flex-1 overflow-hidden md:hidden">
          <main
            className="page-content"
            style={{ flex: 1, overflowY: 'auto', viewTransitionName: 'page-content' }}
          >
            <div className="px-4 py-4 pb-[90px]">
              {children}
            </div>
          </main>
          <div className="flex-shrink-0">
            <BottomNav />
          </div>
        </div>

      </div>
    </>
  )
}