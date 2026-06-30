'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { getModeConfig, type AppMode, type NavSection } from '@/lib/mode-config'
import NavIcon from '@/components/layout/NavIcons'

type Props = {
  userPlan: string
  appMode?: AppMode
}

export default function SidebarNav({ userPlan, appMode }: Props) {
  const pathname = usePathname()
  const mode = getModeConfig(appMode)

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    if (href === '/deals') return pathname.startsWith('/deals') && !pathname.startsWith('/deals/pipeline')
    if (href === '/deals/pipeline') return pathname.startsWith('/deals/pipeline')
    return pathname.startsWith(href)
  }

  const workspace = mode.sections.filter(s => s.group === 'workspace')
  const records   = mode.sections.filter(s => s.group === 'records')

  return (
    <aside
      className="mode-secondary"
      style={{
        minHeight: '100dvh', background: 'var(--bg)',
        display: 'flex', flexDirection: 'column',
        padding: '16px 0 16px', flexShrink: 0,
        position: 'fixed', top: 0, left: 56, bottom: 0, zIndex: 40,
      }}
    >
      {/* Mode label header */}
      <div style={{ padding: '0 16px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: mode.accent, fontWeight: 700, fontSize: 15, lineHeight: 1 }}>{mode.element}</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)', lineHeight: 1.1 }}>{mode.name}</div>
          <div style={{ fontSize: 10, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace' }}>{mode.elementName}</div>
        </div>
      </div>

      <div style={{ padding: '0 10px', flex: 1 }}>
        <GroupLabel>Workspace</GroupLabel>
        {workspace.map(s => (
          <Item key={s.key} section={s} active={isActive(s.href)} accent={mode.accent} accentMuted={mode.accentMuted} isPro={['pro', 'business'].includes(userPlan)} />
        ))}

        <div style={{ height: 12 }} />
        <GroupLabel>Records</GroupLabel>
        {records.map(s => (
          <Item key={s.key} section={s} active={isActive(s.href)} accent={mode.accent} accentMuted={mode.accentMuted} isPro={['pro', 'business'].includes(userPlan)} />
        ))}
      </div>
    </aside>
  )
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10, color: 'var(--fg-subtle)', textTransform: 'uppercase',
      letterSpacing: '0.1em', padding: '0 8px', marginBottom: 4,
      fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace', fontWeight: 500,
    }}>
      {children}
    </div>
  )
}

function Item({ section, active, accent, accentMuted, isPro }: {
  section: NavSection; active: boolean; accent: string; accentMuted: string; isPro: boolean
}) {
  return (
    <Link
      href={section.href}
      className="mode-nav-item"
      style={{
        display: 'flex', alignItems: 'center', gap: 9,
        padding: '7px 8px', borderRadius: 9, fontSize: 13,
        color: active ? 'var(--fg)' : 'var(--fg-muted)',
        fontWeight: active ? 500 : 400,
        background: active ? accentMuted : 'transparent',
        textDecoration: 'none', marginBottom: 1,
        transition: 'background 0.15s, color 0.15s',
      }}
    >
      <span style={{ width: 15, height: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: active ? accent : 'inherit' }}>
        <NavIcon name={section.icon} />
      </span>
      <span style={{ flex: 1 }}>{section.label}</span>
      {section.pro && (
        <span style={{
          fontSize: 9, fontWeight: 700, letterSpacing: '0.04em',
          color: isPro ? accent : 'var(--fg-subtle)',
          background: isPro ? accentMuted : 'rgba(0,0,0,0.05)',
          borderRadius: 4, padding: '2px 5px', textTransform: 'uppercase',
        }}>
          Pro
        </span>
      )}
    </Link>
  )
}
