import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import BottomNav from '@/components/layout/BottomNav'
import ProgressBar from '@/components/layout/ProgressBar'
import SidebarNav from '@/components/layout/SidebarNav'
import NavVisibilityWrapper from '@/components/layout/NavVisibilityWrapper'

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ProgressBar />
        <NavVisibilityWrapper>
          {/* Desktop sidebar — hidden below md */}
          <div className="hidden md:block">
            <SidebarNav />
          </div>

          {/*
            App shell:
            - Mobile:  full width, column layout, bottom nav at the bottom
            - Desktop: push content right of the 210px sidebar
          */}
          <div
            className="app-shell md:ml-[210px]"
            style={{
              display: 'flex',
              flexDirection: 'column',
              minHeight: '100dvh',
              overflow: 'hidden',
            }}
          >
            {/* Page content */}
            <main
              className="page-content"
              style={{
                flex: 1,
                overflowY: 'auto',
                // Mobile: leave room for bottom nav
                // Desktop: no bottom nav, so no padding needed
              }}
            >
              <div className="pb-[90px] md:pb-0">
                {children}
              </div>
            </main>

            {/* Bottom nav — mobile only */}
            <div className="block md:hidden flex-shrink-0">
              <BottomNav />
            </div>
          </div>
        </NavVisibilityWrapper>
      </body>
    </html>
  )
}