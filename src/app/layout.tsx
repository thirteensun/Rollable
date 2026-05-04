import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import ProgressBar from '@/components/layout/ProgressBar'
import NavVisibilityWrapper from '@/components/layout/NavVisibilityWrapper'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Rollable — Effortless AI CRM',
  description: 'Your effortless AI sales companion. Capture, track, and close deals without the friction.',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Rollable' },
  icons: {
    icon: '/favicon-32.png',
    apple: '/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width', initialScale: 1, maximumScale: 1, themeColor: '#f5f4f0',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let userName = ''
  let userInitials = ''
  let userRole = ''
  let userAvatar = ''
  let userPlan = 'free'
  let nudgeCount = 0

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
        admin.from('organisation_members').select('role, org_id').eq('user_id', user.id).eq('status', 'active').limit(1).maybeSingle(),
      ])

      const name = profile?.full_name || user.email?.split('@')[0] || ''
      userName = name
      userInitials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
      userRole = membership?.role || 'rep'
      userAvatar = user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? ''

      if (membership?.org_id) {
        const { data: sub } = await admin
          .from('subscriptions')
          .select('plan')
          .eq('org_id', membership.org_id)
          .maybeSingle()
        userPlan = sub?.plan || 'free'
      }
    }
  } catch {}

  return (
    <html lang="en">
      <head>
        <style>{`
          @keyframes Rollable-fade-in {
            from { opacity: 0; transform: translateY(6px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          @keyframes Rollable-fade-out {
            from { opacity: 1; transform: translateY(0); }
            to   { opacity: 0; transform: translateY(-4px); }
          }
          ::view-transition-old(root) {
            animation: 120ms cubic-bezier(0.4, 0, 1, 1) both Rollable-fade-out;
          }
          ::view-transition-new(root) {
            animation: 200ms cubic-bezier(0, 0, 0.2, 1) both Rollable-fade-in;
          }
          ::view-transition-old(page-content) {
            animation: 90ms ease-in both Rollable-fade-out;
          }
          ::view-transition-new(page-content) {
            animation: 160ms ease-out both Rollable-fade-in;
          }
          @keyframes Rollable-card-in {
            from { opacity: 0; transform: translateY(10px) scale(0.99); }
            to   { opacity: 1; transform: translateY(0) scale(1); }
          }
          ::view-transition-new(card) {
            animation: 220ms cubic-bezier(0, 0, 0.2, 1) both Rollable-card-in;
          }
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
        <NavVisibilityWrapper
          userName={userName}
          userInitials={userInitials}
          userRole={userRole}
          userAvatar={userAvatar}
          userPlan={userPlan}
          notificationCount={nudgeCount}
        >
          {children}
        </NavVisibilityWrapper>
      </body>
    </html>
  )
}