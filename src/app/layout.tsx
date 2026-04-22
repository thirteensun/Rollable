import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import BottomNav from '@/components/layout/BottomNav'
import ProgressBar from '@/components/layout/ProgressBar'
import SidebarNav from '@/components/layout/SidebarNav'
import NavVisibilityWrapper from '@/components/layout/NavVisibilityWrapper'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'SDM — Sales & Deal Manager',
  description: 'Liberate sales and marketing through effortless AI.',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'SDM' },
}

export const viewport: Viewport = {
  width: 'device-width', initialScale: 1, maximumScale: 1, themeColor: '#f5f4f0',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let userName = ''
  let userInitials = ''
  let userRole = ''

  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      const admin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

      const [{ data: profile }, { data: membership }] = await Promise.all([
        admin.from('users').select('full_name').eq('id', user.id).single(),
        admin.from('organisation_members').select('role').eq('user_id', user.id).eq('status', 'active').limit(1).maybeSingle(),
      ])

      const name = profile?.full_name || user.email?.split('@')[0] || ''
      userName = name
      userInitials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
      userRole = membership?.role || 'rep'
    }
  } catch {}

  return (
    <html lang="en">
      <head>
        <style>{`
          /* ── View Transitions ─────────────────────────────────────────────── */

          /* Default cross-page transition: fast fade + subtle upward drift */
          @keyframes sdm-fade-in {
            from { opacity: 0; transform: translateY(6px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          @keyframes sdm-fade-out {
            from { opacity: 1; transform: translateY(0); }
            to   { opacity: 0; transform: translateY(-4px); }
          }

          ::view-transition-old(root) {
            animation: 120ms cubic-bezier(0.4, 0, 1, 1) both sdm-fade-out;
          }
          ::view-transition-new(root) {
            animation: 200ms cubic-bezier(0, 0, 0.2, 1) both sdm-fade-in;
          }

          /* Named transition for page-level content — faster, no drift */
          ::view-transition-old(page-content) {
            animation: 90ms ease-in both sdm-fade-out;
          }
          ::view-transition-new(page-content) {
            animation: 160ms ease-out both sdm-fade-in;
          }

          /* Cards slide in from slightly below on entry */
          @keyframes sdm-card-in {
            from { opacity: 0; transform: translateY(10px) scale(0.99); }
            to   { opacity: 1; transform: translateY(0) scale(1); }
          }
          ::view-transition-new(card) {
            animation: 220ms cubic-bezier(0, 0, 0.2, 1) both sdm-card-in;
          }

          /* Reduce motion: respect system preference */
          @media (prefers-reduced-motion: reduce) {
            ::view-transition-old(root),
            ::view-transition-new(root),
            ::view-transition-old(page-content),
            ::view-transition-new(page-content) {
              animation: none;
            }
          }
        `}</style>
      </head>
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
            <main
              className="page-content"
              style={{
                flex: 1,
                overflowY: 'auto',
                viewTransitionName: 'page-content', /* named transition for main content */
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
        </NavVisibilityWrapper>
      </body>
    </html>
  )
}