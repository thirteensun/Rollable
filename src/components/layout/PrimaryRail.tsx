'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { MODE_CONFIGS, getModeConfig, type AppMode } from '@/lib/mode-config'

type Props = {
  appMode?: AppMode
  userName: string
  userInitials: string
  userAvatar?: string
}

export default function PrimaryRail({ appMode, userName, userInitials, userAvatar }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [switching, setSwitching] = useState<AppMode | null>(null)
  const active = getModeConfig(appMode)

  async function switchMode(mode: AppMode) {
    if (mode === active.key || switching) return
    setSwitching(mode)
    try {
      await fetch('/api/org/app-mode', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      })
      startTransition(() => router.refresh())
    } finally {
      setSwitching(null)
    }
  }

  return (
    <div className="mode-rail">
      {/* Logo glyph */}
      <Link
        href="/"
        title="Rollable"
        style={{
          width: 30, height: 30, borderRadius: 9, marginBottom: 14,
          background: 'var(--mode-accent, #C44B2E)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: 700, fontSize: 15, textDecoration: 'none',
          flexShrink: 0,
        }}
      >
        R
      </Link>

      {/* Element switchers */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
        {MODE_CONFIGS.map(mode => {
          const isActive = mode.key === active.key
          const isLoading = switching === mode.key
          return (
            <button
              key={mode.key}
              onClick={() => switchMode(mode.key)}
              className="mode-rail-item"
              data-active={isActive}
              style={{
                color: isActive ? mode.accent : undefined,
                opacity: isLoading ? 0.5 : 1,
                // active pip color, read by ::before
                ['--rail-active-accent' as any]: mode.accent,
              }}
              aria-label={`${mode.elementName} · ${mode.name}`}
            >
              {mode.element}
              <span className="mode-rail-tooltip">
                <strong style={{ fontWeight: 600 }}>{mode.name}</strong>
                <span style={{ opacity: 0.6, marginLeft: 6 }}>{mode.elementName}</span>
              </span>
            </button>
          )
        })}
      </div>

      {/* User avatar → settings */}
      <Link
        href="/settings"
        title={userName || 'Account'}
        style={{
          width: 30, height: 30, borderRadius: '50%', marginTop: 8, flexShrink: 0,
          overflow: 'hidden', background: '#3a3a36',
          display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none',
        }}
      >
        {userAvatar ? (
          <img src={userAvatar} alt={userName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
        ) : (
          <span style={{ color: '#f5f4f0', fontSize: 10, fontWeight: 600 }}>{userInitials || '?'}</span>
        )}
      </Link>
    </div>
  )
}
