'use client'

import { useState } from 'react'
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

  return (
    <div style={{ paddingBottom: 20, borderBottom: '0.5px solid rgba(0,0,0,0.05)' }}>
      <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 500, color: '#1a1a18', lineHeight: 1.4 }}>
        {question}
      </p>

      <div style={{ position: 'relative', marginBottom: 8 }}>
        <div style={{ height: 3, borderRadius: 999, background: 'rgba(0,0,0,0.07)', position: 'relative' }}>
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0,
            width: `${pct}%`, background: '#1a1a18', borderRadius: 999,
            transition: 'width 0.1s ease',
          }} />
        </div>
        <input
          type="range" min={1} max={7} step={1} value={value}
          onChange={e => onChange(Number(e.target.value))}
          style={{
            position: 'absolute', top: -8, left: 0,
            width: '100%', height: 20, opacity: 0,
            cursor: 'pointer', margin: 0,
          }}
        />
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          position: 'absolute', top: -2, left: 0, right: 0,
          pointerEvents: 'none',
        }}>
          {[1,2,3,4,5,6,7].map(v => (
            <div key={v} style={{
              width: 8, height: 8, borderRadius: '50%',
              background: v <= value ? '#1a1a18' : 'rgba(0,0,0,0.12)',
              border: v === value ? '1.5px solid white' : 'none',
              boxShadow: v === value ? '0 0 0 1.5px #1a1a18' : 'none',
              transition: 'all 0.1s ease', flexShrink: 0,
            }} />
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
        <span style={{ fontSize: 11, color: '#9b9890', maxWidth: '40%', lineHeight: 1.3 }}>{low}</span>
        <span style={{
          fontSize: 12, fontWeight: 600, color: '#1a1a18',
          background: '#f5f4f0', borderRadius: 6, padding: '2px 10px',
        }}>{value}</span>
        <span style={{ fontSize: 11, color: '#9b9890', maxWidth: '40%', textAlign: 'right', lineHeight: 1.3 }}>{high}</span>
      </div>

      {(value <= 2 || value >= 6) && (
        <p style={{ margin: '8px 0 0', fontSize: 12, color: '#6b6960', lineHeight: 1.4 }}>
          {value <= 2 ? lowHint : highHint}
        </p>
      )}
    </div>
  )
}

export default function SettingsSliders({ orgId, orgContext }: Props) {
  // Restore previous scores or default to 4
  const saved = orgContext?.onboarding_scores
  const [scores, setScores] = useState<OnboardingScores>({
    deal_length:         saved?.deal_length         ?? 4,
    buyer_complexity:    saved?.buyer_complexity     ?? 3,
    relationship_driven: saved?.relationship_driven  ?? 4,
    pricing_complexity:  saved?.pricing_complexity   ?? 3,
    competitiveness:     saved?.competitiveness      ?? 3,
    data_maturity:       saved?.data_maturity        ?? 3,
  })
  const [saving, setSaving] = useState(false)
  const [saved2, setSaved2] = useState(false)
  const [error, setError] = useState('')

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
      setSaved2(true)
      setTimeout(() => setSaved2(false), 2500)
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
        {saved2 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#1D9E75' }} />
            <span style={{ fontSize: 13, color: '#1D9E75' }}>Saved</span>
          </div>
        )}
      </div>
    </div>
  )
}
