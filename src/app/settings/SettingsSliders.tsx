'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import {
  ONBOARDING_QUESTIONS,
  inferFromScores,
  mergeIntoOrgContext,
  type OnboardingScores,
} from '@/lib/onboarding-inference'

interface Props {
  orgId: string
  orgContext: Record<string, any>
}

function SliderInput({
  question, low, high, lowHint, highHint, value, onChange,
}: {
  question: string
  low: string
  high: string
  lowHint: string
  highHint: string
  value: number
  onChange: (v: number) => void
}) {
  const pct = ((value - 1) / 6) * 100
  const hintText = value <= 2 ? lowHint : value >= 6 ? highHint : ''

  return (
    <div style={{ paddingBottom: 20, borderBottom: '0.5px solid rgba(0,0,0,0.05)' }}>
      <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 500, color: '#1a1a18', lineHeight: 1.4 }}>
        {question}
      </p>

      <div style={{ position: 'relative', marginBottom: 10, paddingTop: 26 }}>
        <div style={{ height: 4, borderRadius: 999, background: 'rgba(0,0,0,0.08)', position: 'relative' }}>
          <div
            style={{
              position: 'absolute',
              left: `${pct}%`,
              top: '50%',
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: '#e9e8e5',
              border: '1px solid rgba(0,0,0,0.2)',
              transform: 'translate(-50%, -50%)',
              transition: 'left 0.1s ease',
            }}
          />
        </div>
        <input
          type="range" min={1} max={7} step={1} value={value}
          onChange={e => onChange(Number(e.target.value))}
          style={{
            position: 'absolute', top: 18, left: 0,
            width: '100%', height: 20, opacity: 0,
            cursor: 'pointer', margin: 0,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: `${pct}%`,
            top: 0,
            transform: 'translateX(-50%)',
            pointerEvents: 'none',
            background: '#1a1a18',
            color: 'white',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            lineHeight: 1,
            padding: '6px 9px',
            minWidth: 28,
            textAlign: 'center',
            transition: 'left 0.1s ease',
          }}
        >
          {value}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        <span style={{ fontSize: 11, color: '#9b9890', maxWidth: '40%', lineHeight: 1.3 }}>{low}</span>
        <span style={{ fontSize: 11, color: '#9b9890', maxWidth: '40%', textAlign: 'right', lineHeight: 1.3 }}>{high}</span>
      </div>

      <div style={{ marginTop: 8, minHeight: 34 }}>
        <p
          style={{
            margin: 0,
            fontSize: 12,
            color: '#6b6960',
            lineHeight: 1.4,
            visibility: hintText ? 'visible' : 'hidden',
          }}
        >
          {hintText || 'placeholder'}
        </p>
      </div>
    </div>
  )
}

export default function SettingsSliders({ orgId, orgContext }: Props) {
  const router = useRouter()

  // Restore previously saved scores from org context, or fall back to defaults
  const savedScores = orgContext?.onboarding_scores
  const [scores, setScores] = useState<OnboardingScores>({
    deal_length:         savedScores?.deal_length         ?? 4,
    buyer_complexity:    savedScores?.buyer_complexity    ?? 3,
    relationship_driven: savedScores?.relationship_driven ?? 4,
    pricing_complexity:  savedScores?.pricing_complexity  ?? 3,
    competitiveness:     savedScores?.competitiveness     ?? 3,
    data_maturity:       savedScores?.data_maturity       ?? 3,
  })
  const [saving, setSaving]       = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const [error, setError]         = useState('')

  const setScore = (key: keyof OnboardingScores, value: number) =>
    setScores(prev => ({ ...prev, [key]: value }))

  const inferred = inferFromScores(scores)

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      const supabase = createClient()
      const merged = mergeIntoOrgContext(orgContext, inferred)
      const { error: err } = await supabase
        .from('organisations')
        .update({ context: merged })
        .eq('id', orgId)
      if (err) throw err

      // Refresh server components so visible_fields, field_options, stage_template
      // pick up the new context everywhere (capture, detail pages, kanban, analytics).
      router.refresh()

      setJustSaved(true)
      setTimeout(() => setJustSaved(false), 2500)
    } catch (e: any) {
      setError(e.message || 'Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      {/* Impact preview */}
      <div style={{
        background: '#f5f4f0', borderRadius: 12,
        padding: '12px 14px', marginBottom: 18,
      }}>
        <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 600, color: '#9b9890', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          Current configuration
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            { label: 'Pipeline template', value: inferred.stage_template.replace(/_/g, ' ') },
            { label: 'At-risk threshold', value: `${inferred.at_risk_days} days` },
            { label: 'Contact fields',   value: `${inferred.visible_fields.contacts.length} active` },
            { label: 'Company fields',   value: `${inferred.visible_fields.companies.length} active` },
            { label: 'Deal fields',      value: `${inferred.visible_fields.deals.length} active` },
            { label: 'AI focus areas',   value: `${inferred.pain_points.length} configured` },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: '#6b6960' }}>{label}</span>
              <span style={{ fontSize: 12, fontWeight: 500, color: '#1a1a18', textTransform: 'capitalize' }}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Sliders */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {ONBOARDING_QUESTIONS.map(q => (
          <SliderInput
            key={q.key}
            question={q.question}
            low={q.low}
            high={q.high}
            lowHint={q.lowHint}
            highHint={q.highHint}
            value={scores[q.key]}
            onChange={v => setScore(q.key, v)}
          />
        ))}
      </div>

      {error && (
        <p style={{ margin: '12px 0 0', fontSize: 13, color: '#E24B4A' }}>{error}</p>
      )}

      {/* Save */}
      <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            flex: 1, padding: 13, fontSize: 15, fontWeight: 500,
            color: 'white', background: saving ? '#9b9890' : '#1a1a18',
            border: 'none', borderRadius: 14,
            cursor: saving ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit', transition: 'background 0.2s',
          }}
        >
          {saving ? 'Saving...' : 'Save changes'}
        </button>
        {justSaved && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#1D9E75' }} />
            <span style={{ fontSize: 13, color: '#1D9E75' }}>Saved</span>
          </div>
        )}
      </div>
    </div>
  )
}