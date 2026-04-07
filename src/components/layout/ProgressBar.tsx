'use client'

import { useEffect, useState, useRef } from 'react'
import { usePathname } from 'next/navigation'

export default function ProgressBar() {
  const pathname = usePathname()
  const [progress, setProgress] = useState(0)
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const prevPathname = useRef(pathname)

  useEffect(() => {
    if (pathname !== prevPathname.current) {
      // New page loaded — complete the bar
      setProgress(100)
      setTimeout(() => {
        setVisible(false)
        setProgress(0)
      }, 400)
      prevPathname.current = pathname
    }
  }, [pathname])

  // Start progress bar on link clicks
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('a')
      if (!target) return
      const href = target.getAttribute('href')
      if (!href || href.startsWith('#') || href.startsWith('http')) return

      setVisible(true)
      setProgress(0)

      // Simulate progress
      let p = 0
      timerRef.current = setInterval(() => {
        p += Math.random() * 15
        if (p > 85) p = 85 // Never complete until page loads
        setProgress(p)
      }, 150)
    }

    document.addEventListener('click', handleClick)
    return () => {
      document.removeEventListener('click', handleClick)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  if (!visible) return null

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      height: '2px',
      zIndex: 9999,
      background: 'rgba(0,0,0,0.06)',
    }}>
      <div style={{
        height: '100%',
        width: `${progress}%`,
        background: '#1a1a18',
        transition: progress === 100 ? 'width 0.2s ease' : 'width 0.15s ease',
        borderRadius: '0 2px 2px 0',
      }} />
    </div>
  )
}
