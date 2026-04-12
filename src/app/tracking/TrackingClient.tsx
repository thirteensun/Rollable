'use client'

import Link from 'next/link'
import { useRef, useState, useEffect } from 'react'
import KanbanBoard from './KanbanBoard'

type Deal = {
  id: string
  name: string
  stage: string
  value?: number
  company_name?: string
  days_since_activity: number
  owner_initials?: string
}

type Props = {
  deals: Deal[]
  contacts: any[]
  companies: any[]
  events: any[]
}

export default function TrackingClient({ deals }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)

  function checkScroll() {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 0)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    checkScroll()
    el.addEventListener('scroll', checkScroll)
    window.addEventListener('resize', checkScroll)
    return () => {
      el.removeEventListener('scroll', checkScroll)
      window.removeEventListener('resize', checkScroll)
    }
  }, [])

  function scrollBy(amount: number) {
    scrollRef.current?.scrollBy({ left: amount, behavior: 'smooth' })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Top bar */}
      <div style={{
        height: 50, background: 'white',
        borderBottom: '0.5px solid rgba(0,0,0,0.07)',
        display: 'flex', alignItems: 'center',
        padding: '0 20px', gap: 12, flexShrink: 0,
      }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: '#1a1a18', flex: 1 }}>Pipeline</span>

        {/* Scroll arrows */}
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => scrollBy(-280)}
            disabled={!canScrollLeft}
            style={{
              width: 28, height: 28, borderRadius: 8,
              background: canScrollLeft ? 'white' : '#f5f4f0',
              border: '0.5px solid rgba(0,0,0,0.07)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: canScrollLeft ? 'pointer' : 'default',
              opacity: canScrollLeft ? 1 : 0.35,
              transition: 'opacity 0.15s',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M7.5 2L3.5 6L7.5 10" stroke="#1a1a18" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button
            onClick={() => scrollBy(280)}
            disabled={!canScrollRight}
            style={{
              width: 28, height: 28, borderRadius: 8,
              background: canScrollRight ? 'white' : '#f5f4f0',
              border: '0.5px solid rgba(0,0,0,0.07)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: canScrollRight ? 'pointer' : 'default',
              opacity: canScrollRight ? 1 : 0.35,
              transition: 'opacity 0.15s',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M4.5 2L8.5 6L4.5 10" stroke="#1a1a18" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        <Link href="/capture" style={{
          background: '#1a1a18', color: 'white', borderRadius: 10,
          padding: '7px 14px', fontSize: 12, fontWeight: 500, textDecoration: 'none',
        }}>
          + Add Deal
        </Link>
      </div>

      {/* Kanban scroll container */}
      <div
        ref={scrollRef}
        style={{ overflowX: 'auto', overflowY: 'hidden', flex: 1 }}
        className="no-scrollbar"
      >
        <KanbanBoard deals={deals} />
      </div>
    </div>
  )
}