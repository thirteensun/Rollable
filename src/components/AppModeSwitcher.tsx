'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { MODE_CONFIGS, type AppMode } from '@/lib/mode-config'

interface Props {
  currentMode: AppMode
  onClose: () => void
}

export default function AppModeSwitcher({ currentMode, onClose }: Props) {
  const [selected, setSelected] = useState<AppMode>(currentMode)
  const [isPending, startTransition] = useTransition()
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  async function apply() {
    if (selected === currentMode) { onClose(); return }
    setSaving(true)
    try {
      await fetch('/api/org/app-mode', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: selected }),
      })
      startTransition(() => { router.refresh() })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const active = MODE_CONFIGS.find(m => m.key === selected)!

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: active.theme.cardBg,
        borderRadius: 24,
        padding: '32px 28px 24px',
        width: '100%', maxWidth: 560,
        margin: '0 16px',
        boxShadow: '0 24px 80px rgba(0,0,0,0.22), 0 4px 16px rgba(0,0,0,0.10)',
        border: `0.5px solid ${active.theme.border}`,
        transition: 'background 0.3s, border-color 0.3s',
      }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: '#1a1a18', margin: 0 }}>
                Switch workspace mode
              </h2>
              <p style={{ fontSize: 13, color: '#6b6960', marginTop: 4 }}>
                Same data, different lens. Powered by the five elements.
              </p>
            </div>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#9b9890', fontSize: 18, lineHeight: 1 }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Element cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 24 }}>
          {MODE_CONFIGS.map(mode => {
            const isSelected = selected === mode.key
            return (
              <button
                key={mode.key}
                onClick={() => setSelected(mode.key)}
                style={{
                  border: isSelected
                    ? `2px solid ${mode.theme.accent}`
                    : '1.5px solid rgba(0,0,0,0.09)',
                  borderRadius: 16,
                  padding: '16px 8px 14px',
                  cursor: 'pointer',
                  background: isSelected ? mode.theme.sidebarBg : 'transparent',
                  transition: 'all 0.18s ease',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Element glow */}
                {isSelected && (
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: `radial-gradient(ellipse at 50% 0%, ${mode.theme.accent}22 0%, transparent 70%)`,
                    pointerEvents: 'none',
                  }} />
                )}

                {/* Chinese character */}
                <span style={{
                  fontSize: 26,
                  lineHeight: 1,
                  color: isSelected ? mode.theme.accent : '#1a1a18',
                  fontWeight: 700,
                  letterSpacing: '-0.01em',
                  transition: 'color 0.18s',
                }}>
                  {mode.element}
                </span>

                {/* Element name */}
                <span style={{
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: isSelected ? mode.theme.sidebarMuted : '#9b9890',
                  fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                  transition: 'color 0.18s',
                }}>
                  {mode.elementName}
                </span>

                {/* Mode name */}
                <span style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: isSelected ? mode.theme.sidebarText : '#1a1a18',
                  transition: 'color 0.18s',
                }}>
                  {mode.name}
                </span>
              </button>
            )
          })}
        </div>

        {/* Selected mode detail */}
        <div style={{
          background: active.theme.accentMuted,
          border: `1px solid ${active.theme.accent}33`,
          borderRadius: 12,
          padding: '14px 16px',
          marginBottom: 20,
          transition: 'all 0.25s ease',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: active.theme.sidebarBg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, flexShrink: 0,
            }}>
              <span style={{ color: active.theme.accent, fontWeight: 700, fontSize: 16 }}>{active.element}</span>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a18' }}>
                {active.elementName} · {active.name}
              </div>
              <div style={{ fontSize: 12, color: '#6b6960', marginTop: 2 }}>
                {active.description}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${active.theme.accent}22` }}>
            {[
              ['Pipeline', active.nav.pipeline],
              ['Records', `${active.nav.deals}, ${active.nav.contacts}, ${active.nav.companies}`],
            ].map(([label, value]) => (
              <div key={label}>
                <div style={{ fontSize: 10, color: '#9b9890', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace', marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 12, color: '#1a1a18', fontWeight: 500 }}>{value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '9px 18px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.12)',
              background: 'transparent', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: '#6b6960',
            }}
          >
            Cancel
          </button>
          <button
            onClick={apply}
            disabled={saving || isPending}
            style={{
              padding: '9px 20px', borderRadius: 10, border: 'none',
              background: saving || isPending ? '#9b9890' : active.theme.accent,
              color: '#fff', cursor: saving ? 'not-allowed' : 'pointer',
              fontSize: 13, fontWeight: 600, transition: 'background 0.2s',
            }}
          >
            {saving || isPending ? 'Applying…' : `Switch to ${active.name}`}
          </button>
        </div>
      </div>
    </div>
  )
}
