'use client'

import { usePathname } from 'next/navigation'

const HIDDEN_ROUTES = ['/login', '/onboarding', '/auth']

export default function NavVisibilityWrapper({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const hideNav = HIDDEN_ROUTES.some((route) => pathname.startsWith(route))

  if (hideNav) {
    // On auth/onboarding pages, render children without any nav wrapper
    return (
      <div style={{ minHeight: '100dvh' }}>
        {children}
      </div>
    )
  }

  // On normal pages, render the full shell (sidebar + content + bottom nav)
  return <>{children}</>
}
