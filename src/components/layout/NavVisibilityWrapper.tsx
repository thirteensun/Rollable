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
  /** Shown on the header bell; wire feedback from this wrapper (layout is a server component). */
  notificationCount?: number
}

export default function NavVisibilityWrapper({
  children, userName, userInitials, userRole, userAvatar, notificationCount = 0,
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
      <div className="hidden md:block">
        <SidebarNav userName={userName} userInitials={userInitials} userRole={userRole} userAvatar={userAvatar} />
      </div>
      <div
        className="app-shell md:ml-[210px]"
        style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', overflow: 'hidden' }}
      >
        <div className="hidden md:block">
          <AppHeader
            notificationCount={notificationCount}
            onFeedback={() => setFeedbackOpen(true)}
          />
        </div>
        <main
          className="page-content"
          style={{
            flex: 1,
            overflowY: 'auto',
            viewTransitionName: 'page-content',
          }}
        >
          <div className="px-4 py-4 pb-[90px] md:px-10 md:py-8 md:pb-8 md:max-w-[1240px] md:mx-auto">
            {children}
          </div>
        </main>
        <div className="block md:hidden flex-shrink-0">
          <BottomNav />
        </div>
      </div>
    </>
  )
}