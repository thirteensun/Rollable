'use client'

export interface PillOption {
  value: string
  label: string
  colors?: { bg: string; color: string }
}

interface FilterPillsProps {
  options: PillOption[]   // includes the "all" option as first item
  active: string
  onChange: (v: string) => void
}

export default function FilterPills({ options, active, onChange }: FilterPillsProps) {
  if (options.length <= 2) return null // "all" + 1 real option — not worth showing

  return (
    <div
      style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, marginBottom: 10 }}
      className="no-scrollbar"
    >
      {options.map(opt => {
        const isActive = active === opt.value
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              flexShrink: 0,
              padding: '5px 12px', borderRadius: 20,
              border: isActive ? 'none' : '0.5px solid rgba(0,0,0,0.09)',
              background: isActive ? (opt.colors?.bg ?? '#1a1a18') : 'white',
              color: isActive ? (opt.colors?.color ?? 'white') : '#6b6960',
              fontSize: 12, fontWeight: isActive ? 600 : 400,
              cursor: 'pointer', fontFamily: 'inherit',
              transition: 'all 0.15s ease',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
