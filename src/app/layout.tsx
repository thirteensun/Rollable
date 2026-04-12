import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import BottomNav from '@/components/layout/BottomNav'
import ProgressBar from '@/components/layout/ProgressBar'
import SidebarNav from '@/components/layout/SidebarNav'
import NavVisibilityWrapper from '@/components/layout/NavVisibilityWrapper'
import { createServerSupabaseClient } from '@/lib/supabase-server'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'SDM — Sales & Deal Manager',
  description: 'Liberate sales and marketing through effortless AI.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'SDM',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#f5f4f0',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  let userName = ''
  let userInitials = ''
  let userRole = ''

  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      const { data: profile } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', user.id)
        .single()

      const { data: membership } = await supabase
        .from('organisation_members')
        .select('role')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle()

      const name = profile?.full_name || user.email?.split('@')[0] || ''
      userName = name
      userInitials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
      userRole = membership?.role || 'rep'
    }
  } catch {
    // Not logged in — nav will hide itself anyway
  }

  return (
    <html lang="en">
      <body className={inter.className}>
        <ProgressBar />
        <NavVisibilityWrapper>
          <div className="hidden md:block">
            <SidebarNav userName={userName} userInitials={userInitials} userRole={userRole} />
          </div>

          <div
            className="app-shell md:ml-[210px]"
            style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', overflow: 'hidden' }}
          >
            <main className="page-content" style={{ flex: 1, overflowY: 'auto' }}>
              <div className="px-4 py-4 pb-[90px] md:px-10 md:py-8 md:pb-8 md:max-w-[1240px] md:mx-auto">
                {children}
              </div>
            </main>

            <div className="block md:hidden flex-shrink-0">
              <BottomNav />
            </div>
          </div>
        </NavVisibilityWrapper>
      </body>
    </html>
  )
}