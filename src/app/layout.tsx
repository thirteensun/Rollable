import type { Metadata, Viewport } from 'next'
import './globals.css'
import ProgressBar from '@/components/layout/ProgressBar'
import BottomNav from '@/components/layout/BottomNav'


export const metadata: Metadata = {
  title: 'SDM — Sales Development Manager',
  description: 'Liberate sales and marketing through effortless AI.',
  manifest: '/manifest.json',
  appleWebApp: { statusBarStyle: 'default', title: 'SDM' },
  other: { 'mobile-web-app-capable': 'yes' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#f5f4f0',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <ProgressBar />
          <div className="page-content">
            {children}
          </div>
          <BottomNav />
        </div>
      </body>    </html>
  )
}
