'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { getStagesForTemplate } from '@/lib/stage-templates'

const STAGE_BG: Record<string, string> = {
  lead:        'rgba(180,174,164,0.12)',
  qualified:   'rgba(130,155,170,0.12)',
  demo:        'rgba(115,145,160,0.14)',
  proposal:    'rgba(160,140,100,0.12)',
  negotiation: 'rgba(170,115,100,0.12)',
  closed_won:  'rgba(90,145,120,0.13)',
  closed_lost: 'rgba(160,100,100,0.08)',
}
const STAGE_DOT: Record<string, string> = {
  lead:        '#9b9890',
  qualified:   '#7a9aaa',
  demo:        '#5d8899',
  proposal:    '#a08840',
  negotiation: '#a06050',
  closed_won:  '#4a8a6a',
  closed_lost: '#c0a0a0',
}

type Deal = {
  id: string
  name: string
  company_name?: string
  value?: number
  stage: string
  days_since_activity: number
  owner_initials?: string
}

interface Props {
  deals: Deal[]
  stageTemplate?: string
}

function activityTag(days: number | undefined | null, stage: string) {
  if (stage === 'closed_won' || stage === 'closed_lost') return null
  if (days === undefined || days === null || isNaN(days)) return null
  if (days >= 14) return { label: `${days}d`, style: { background: '#fdeaea', color: '#E24B4A' } }
  if (days >= 7)  return { label: `${days}d`, style: { background: '#fdf3e3', color: '#EF9F27' } }
  return null
}

function formatValue(v?: number) {
  if (!v) return '—'
  if (v >= 1000) return `€${(v / 1000).toFixed(0)}k`
  return `€${v}`
}

export default function KanbanBoard({ deals, stageTemplate }: Props) {
  const STAGES = getStagesForTemplate(stageTemplate || 'other')

  const [dragId, setDragId] = useState<string | null>(null)
  const [overStage, setOverStage] = useState<string | null>(null)
  const [localDeals, setLocalDeals] = useState<Deal[]>(deals)
  const [pendingChanges, setPendingChanges] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const hasPending = Object.keys(pendingChanges).length > 0

  const grouped = STAGES.reduce<Record<string, Deal[]>>((acc, s) => {
    acc[s.key] = localDeals.filter(d => d.stage === s.key)
    return acc
  }, {})

  function handleDragStart(id: string) { setDragId(id) }
  function handleDragOver(e: React.DragEvent, stage: string) { e.preventDefault(); setOverStage(stage) }
  function handleDrop(stage: string) {
    if (!dragId) return
    const deal = localDeals.find(d => d.id === dragId)
    if (!deal) return
    if (deal.stage !== stage) {
      setLocalDeals(prev => prev.map(d => d.id === dragId ? { ...d, stage } : d))
      setPendingChanges(prev => ({ ...prev, [dragId]: stage }))
    }
    setDragId(null); setOverStage(null)
  }
  function handleDragEnd() { setDragId(null); setOverStage(null) }

  function handleDiscard() {
    setLocalDeals(prev => prev.map(d => {
      if (pendingChanges[d.id]) {
        const original = deals.find(od => od.id === d.id)
        return original ? { ...d, stage: original.stage } : d
      }
      return d
    }))
    setPendingChanges({}); setSaveError(null)
  }

  const handleSave = useCallback(async () => {
    if (!hasPending || saving) return
    setSaving(true); setSaveError(null)
    try {
      await Promise.all(Object.entries(pendingChanges).map(([id, stage]) =>
        fetch(`/api/deals/${id}/stage`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stage }),
        }).then(res => { if (!res.ok) throw new Error(`Failed to update deal ${id}`) })
      ))
      setPendingChanges({})
    } catch (err) {
      setSaveError('Some changes failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }, [pendingChanges, hasPending, saving])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {hasPending && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: 'white', borderBottom: '0.5px solid rgba(0,0,0,0.07)', gap: 12, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#EF9F27' }} />
            <span style={{ fontSize: 12, color: '#6b6960' }}>{Object.keys(pendingChanges).length} unsaved {Object.keys(pendingChanges).length === 1 ? 'change' : 'changes'}</span>
            {saveError && <span style={{ fontSize: 12, color: '#E24B4A' }}>{saveError}</span>}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleDiscard} style={{ padding: '6px 14px', borderRadius: 20, border: '0.5px solid rgba(0,0,0,0.12)', background: 'transparent', fontSize: 12, color: '#6b6960', cursor: 'pointer' }}>Discard</button>
            <button onClick={handleSave} disabled={saving} style={{ padding: '6px 16px', borderRadius: 20, border: 'none', background: saving ? '#9b9890' : '#1a1a18', color: 'white', fontSize: 12, fontWeight: 500, cursor: saving ? 'not-allowed' : 'pointer' }}>{saving ? 'Saving…' : 'Save changes'}</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, padding: '16px', overflowX: 'auto', overflowY: 'hidden', flex: 1, alignItems: 'flex-start' }}>
        {STAGES.map((stage) => {
          const cards = grouped[stage.key] ?? []
          const isOver = overStage === stage.key
          const isWon = stage.key === 'closed_won'
          const isLost = stage.key === 'closed_lost'
          const stageBg = STAGE_BG[stage.key] || 'rgba(130,155,170,0.12)'
          const stageDot = STAGE_DOT[stage.key] || '#9b9890'

          return (
            <div key={stage.key} style={{ width: 210, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }} onDragOver={e => handleDragOver(e, stage.key)} onDrop={() => handleDrop(stage.key)}>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', borderRadius: 8, background: stageBg }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: stageDot, flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontWeight: 500, flex: 1, letterSpacing: '0.04em', textTransform: 'uppercase', color: isWon ? '#1D9E75' : isLost ? '#E24B4A' : '#6b6960' }}>
                  {stage.label}
                </span>
                <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(255,255,255,0.7)', fontSize: 10, color: '#9b9890', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{cards.length}</span>
                {isWon && <span style={{ fontSize: 10, color: '#1D9E75' }}>{formatValue(cards.reduce((s, d) => s + (d.value ?? 0), 0))}</span>}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minHeight: 80, borderRadius: 14, padding: isOver ? 4 : 0, background: isOver ? 'rgba(0,0,0,0.03)' : 'transparent', border: isOver ? '1.5px dashed rgba(0,0,0,0.12)' : '1.5px solid transparent', transition: 'all 0.15s' }}>
                {cards.map(deal => {
                  const tag = activityTag(deal.days_since_activity, deal.stage)
                  const atRisk = (deal.days_since_activity ?? 0) >= 14 && !isWon && !isLost
                  const isDragging = dragId === deal.id
                  const isPending = !!pendingChanges[deal.id]
                  return (
                    <div key={deal.id} draggable onDragStart={() => handleDragStart(deal.id)} onDragEnd={handleDragEnd}
                      style={{ background: isPending ? 'rgba(239,159,39,0.07)' : 'white', border: isPending ? '1px solid rgba(239,159,39,0.35)' : '0.5px solid rgba(0,0,0,0.07)', borderLeft: atRisk && !isPending ? '2.5px solid #EF9F27' : isPending ? '2.5px solid #EF9F27' : undefined, borderRadius: 12, padding: '11px 12px', cursor: 'grab', opacity: isDragging ? 0.4 : isWon || isLost ? 0.65 : 1, transition: 'opacity 0.15s, transform 0.1s', userSelect: 'none' }}
                      className="kanban-card">
                      <Link href={`/tracking/deals/${deal.id}`} style={{ textDecoration: 'none', display: 'block' }} onClick={e => { if (dragId) e.preventDefault() }}>
                        <div style={{ fontSize: 12, fontWeight: 500, color: '#1a1a18', marginBottom: 3 }}>{deal.name}</div>
                        {deal.company_name && <div style={{ fontSize: 11, color: '#9b9890', marginBottom: 8 }}>{deal.company_name}</div>}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 12, fontWeight: 500, color: '#1a1a18' }}>{formatValue(deal.value)}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            {deal.owner_initials && <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#1a1a18', color: 'white', fontSize: 8, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{deal.owner_initials}</div>}
                            {tag && <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 6px', borderRadius: 6, ...tag.style }}>{tag.label}</span>}
                            {isWon && <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 6px', borderRadius: 6, background: '#e8f5f0', color: '#1D9E75' }}>Won</span>}
                            {isLost && <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 6px', borderRadius: 6, background: '#fdeaea', color: '#E24B4A' }}>Lost</span>}
                          </div>
                        </div>
                      </Link>
                    </div>
                  )
                })}
                {!isWon && !isLost && (
                  <Link href="/capture" style={{ textDecoration: 'none' }}>
                    <button style={{ background: 'transparent', border: '0.5px dashed rgba(0,0,0,0.1)', borderRadius: 12, padding: '9px 12px', cursor: 'pointer', fontSize: 11, color: '#9b9890', textAlign: 'left', width: '100%' }} className="add-deal-btn">+ Add deal</button>
                  </Link>
                )}
              </div>
            </div>
          )
        })}
        <style>{`.kanban-card:hover { border-color: rgba(0,0,0,0.14) !important; transform: translateY(-1px); } .add-deal-btn:hover { border-color: rgba(0,0,0,0.2) !important; color: #6b6960 !important; }`}</style>
      </div>
    </div>
  )
}