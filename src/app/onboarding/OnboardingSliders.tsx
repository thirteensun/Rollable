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
  onComplete: () => void
}

const DEFAULT_SCORES: OnboardingScores = {
  deal_length:         4,
  buyer_complexity:    3,
  relationship_driven: 4,
  pricing_complexity:  3,
  competitiveness:     3,
  data_maturity:       3,
}

function SliderInput({
  question, low, high, lowHint, highHint, value, onChange, index,
}: {
  question: string
  low: string
  high: string
  lowHint: string
  highHint: string
  value: number
  onChange: (v: number) => void
  index: number
}) {
  const pct = ((value - 1) / 6) * 100

  return (
    <div style={{
      background: 'white',
      borderRadius: 18,
      border: '0.5px solid rgba(0,0,0,0.07)',
      padding: '18px 20px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      {/* Question */}
      <p style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 500, color: '#1a1a18', lineHeight: 1.4 }}>
        {question}
      </p>

      {/* Track + thumb */}
      <div style={{ position: 'relative', marginBottom: 10 }}>
        {/* Track background */}
        <div style={{
          height: 4, borderRadius: 2,
          background: 'rgba(0,0,0,0.07)',
          position: 'relative',
        }}>
          {/* Filled portion */}
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0,
            width: `${pct}%`,
            background: '#1a1a18',
            borderRadius: 2,
            transition: 'width 0.1s ease',
          }} />
        </div>

        {/* Native range input — invisible but functional */}
        <input
          type="range"
          min={1} max={7} step={1}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          style={{
            position: 'absolute',
            top: -8, left: 0, right: 0,
            width: '100%', height: 20,
            opacity: 0, cursor: 'pointer', margin: 0,
          }}
        />

        {/* Step dots */}
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          position: 'absolute', top: -3, left: 0, right: 0,
          pointerEvents: 'none',
        }}>
          {[1,2,3,4,5,6,7].map(v => (
            <div key={v} style={{
              width: 10, height: 10, borderRadius: '50%',
              background: v <= value ? '#1a1a18' : 'rgba(0,0,0,0.12)',
              border: v === value ? '2px solid white' : 'none',
              boxShadow: v === value ? '0 0 0 2px #1a1a18' : 'none',
              transition: 'all 0.1s ease',
              flexShrink: 0,
            }} />
          ))}
        </div>
      </div>

      {/* Labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
        <span style={{ fontSize: 11, color: '#9b9890', maxWidth: '42%', lineHeight: 1.3 }}>{low}</span>
        <span style={{
          fontSize: 12, fontWeight: 600, color: '#1a1a18',
          background: '#f5f4f0', borderRadius: 6,
          padding: '2px 10px', alignSelf: 'center',
        }}>{value}</span>
        <span style={{ fontSize: 11, color: '#9b9890', maxWidth: '42%', textAlign: 'right', lineHeight: 1.3 }}>{high}</span>
      </div>

      {/* Contextual hint */}
      <p style={{
        margin: '10px 0 0', fontSize: 12, color: '#6b6960',
        lineHeight: 1.4, minHeight: 16,
        transition: 'opacity 0.2s ease',
      }}>
        {value <= 2 ? lowHint : value >= 6 ? highHint : ''}
      </p>
    </div>
  )
}

export default function OnboardingSliders({ onComplete }: Props) {
  const [scores, setScores] = useState<OnboardingScores>(DEFAULT_SCORES)
  const [saving, setSaving] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState('')

  const setScore = (key: keyof OnboardingScores, value: number) => {
    setScores(prev => ({ ...prev, [key]: value }))
  }

  // Live preview of what will be inferred
  const inferred = inferFromScores(scores)

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Get current org
      const { data: membership } = await supabase
        .from('organisation_members')
        .select('org_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle()

      if (!membership) throw new Error('No active workspace found')

      // Get existing context
      const { data: org } = await supabase
        .from('organisations')
        .select('context')
        .eq('id', membership.org_id)
        .single()

      const merged = mergeIntoOrgContext(org?.context || {}, inferred)

      const { error: updateError } = await supabase
        .from('organisations')
        .update({ context: merged })
        .eq('id', membership.org_id)

      if (updateError) throw updateError

      setConfirmed(true)
    } catch (err: any) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setSaving(false)
    }
  }

  // ── Confirmation card ──
  if (confirmed) {
    return (
      <div className="animate-fade-in-up">
        <p style={{ margin: '0 0 8px', fontSize: 13, color: '#9b9890', letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: 500 }}>
          All set
        </p>
        <h1 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 500, color: '#1a1a18', lineHeight: 1.2 }}>
          Rollable is configured<br />for your team
        </h1>
        <p style={{ margin: '0 0 24px', fontSize: 14, color: '#9b9890', lineHeight: 1.5 }}>
          You can adjust any of this from settings at any time.
        </p>

        <div style={{ background: 'white', borderRadius: 18, border: '0.5px solid rgba(0,0,0,0.07)', padding: 20, marginBottom: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            {[
              { label: 'Pipeline template', value: inferred.stage_template.replace(/_/g, ' ') },
              { label: 'At-risk after',     value: `${inferred.at_risk_days} days inactive` },
              { label: 'Contact fields',    value: `${inferred.visible_fields.contacts.length} fields active` },
              { label: 'Company fields',    value: `${inferred.visible_fields.companies.length} fields active` },
              { label: 'Deal fields',       value: `${inferred.visible_fields.deals.length} fields active` },
              ...(inferred.pain_points.length > 0
                ? [{ label: 'AI focus areas', value: `${inferred.pain_points.length} configured` }]
                : []),
            ].map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                <span style={{ fontSize: 13, color: '#6b6960' }}>{label}</span>
                <span style={{ fontSize: 13, color: '#1a1a18', fontWeight: 500, textAlign: 'right', textTransform: 'capitalize' }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={onComplete}
          style={{
            width: '100%', background: '#1a1a18', color: 'white',
            border: 'none', borderRadius: 22, padding: '16px 24px',
            fontSize: 16, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Take me to my dashboard →
        </button>
      </div>
    )
  }

  // ── Sliders ──
  return (
    <div className="animate-fade-in-up">
      <p style={{ margin: '0 0 8px', fontSize: 13, color: '#9b9890', letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: 500 }}>
        Quick setup
      </p>
      <h1 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 500, color: '#1a1a18', lineHeight: 1.2 }}>
        Describe your<br />sales process
      </h1>
      <p style={{ margin: '0 0 24px', fontSize: 14, color: '#9b9890', lineHeight: 1.5 }}>
        Six sliders. Rollable configures itself from the answers.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        {ONBOARDING_QUESTIONS.map((q, i) => (
          <SliderInput
            key={q.key}
            index={i}
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

      {/* Live preview strip */}
      <div style={{
        background: 'white', borderRadius: 14,
        border: '0.5px solid rgba(0,0,0,0.07)',
        padding: '12px 16px', marginBottom: 16,
        display: 'flex', gap: 8, flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 11, color: '#9b9890', width: '100%', marginBottom: 4 }}>
          ROLLABLE WILL SET UP
        </span>
        {[
          { label: 'Template', value: inferred.stage_template.replace(/_/g, ' ') },
          { label: 'At-risk', value: `${inferred.at_risk_days}d` },
          { label: 'Contact fields', value: String(inferred.visible_fields.contacts.length) },
          { label: 'Deal fields', value: String(inferred.visible_fields.deals.length) },
        ].map(item => (
          <div key={item.label} style={{
            background: '#f5f4f0', borderRadius: 8,
            padding: '5px 10px', display: 'flex', gap: 5, alignItems: 'center',
          }}>
            <span style={{ fontSize: 11, color: '#9b9890' }}>{item.label}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#1a1a18', textTransform: 'capitalize' }}>{item.value}</span>
          </div>
        ))}
      </div>

      {error && (
        <p style={{ margin: '0 0 12px', fontSize: 13, color: '#E24B4A' }}>{error}</p>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          width: '100%', background: saving ? '#9b9890' : '#1a1a18',
          color: 'white', border: 'none', borderRadius: 22,
          padding: '16px 24px', fontSize: 16, fontWeight: 500,
          cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
          transition: 'background 0.2s ease',
        }}
      >
        {saving ? 'Configuring...' : 'Set up my workspace →'}
      </button>
    </div>
  )
}
