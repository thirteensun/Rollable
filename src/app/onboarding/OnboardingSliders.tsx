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
  userName?: string
}

const DEFAULT_SCORES: OnboardingScores = {
  deal_length:         4,
  buyer_complexity:    3,
  relationship_driven: 4,
  pricing_complexity:  3,
  competitiveness:     3,
  data_maturity:       3,
}

const TEMPLATE_LABELS: Record<string, string> = {
  transactional: 'fast transactional',
  smb:           'SMB',
  saas:          'SaaS',
  enterprise:    'enterprise',
  other:         '',
}

function SliderInput({
  question, low, high, lowHint, highHint, scaleHint, value, onChange,
}: {
  question: string
  low: string
  high: string
  lowHint: string
  highHint: string
  scaleHint: string
  value: number
  onChange: (v: number) => void
}) {
  const pct = ((value - 1) / 6) * 100
  const hintText = value <= 2 ? lowHint : value >= 6 ? highHint : ''

  return (
    <div style={{
      background: 'white',
      borderRadius: 18,
      border: '0.5px solid rgba(0,0,0,0.07)',
      padding: '20px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 500, color: '#1a1a18', lineHeight: 1.4 }}>
        {question}
      </p>
      <p style={{ margin: '0 0 16px', fontSize: 12, color: '#9b9890', lineHeight: 1.4 }}>
        {scaleHint}
      </p>

      <div style={{ position: 'relative', paddingTop: 26, marginBottom: 8 }}>
        <div style={{ height: 4, borderRadius: 999, background: 'rgba(0,0,0,0.08)', position: 'relative' }}>
          <div style={{
            position: 'absolute', left: `${pct}%`, top: '50%',
            width: 14, height: 14, borderRadius: '50%',
            background: '#e9e8e5', border: '1px solid rgba(0,0,0,0.2)',
            transform: 'translate(-50%, -50%)', transition: 'left 0.1s ease',
          }} />
        </div>
        <input
          type="range" min={1} max={7} step={1} value={value}
          onChange={e => onChange(Number(e.target.value))}
          style={{
            position: 'absolute', top: 18, left: 0,
            width: '100%', height: 20, opacity: 0, cursor: 'pointer', margin: 0,
          }}
        />
        <div style={{
          position: 'absolute', left: `${pct}%`, top: 0,
          transform: 'translateX(-50%)', pointerEvents: 'none',
          background: '#1a1a18', color: 'white',
          borderRadius: 8, fontSize: 12, fontWeight: 600,
          lineHeight: 1, padding: '6px 9px', minWidth: 28, textAlign: 'center',
          transition: 'left 0.1s ease',
        }}>
          {value}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        <span style={{ fontSize: 11, color: '#9b9890', maxWidth: '42%', lineHeight: 1.3 }}>{low}</span>
        <span style={{ fontSize: 11, color: '#9b9890', maxWidth: '42%', textAlign: 'right', lineHeight: 1.3 }}>{high}</span>
      </div>

      <div style={{ marginTop: 8, minHeight: 20 }}>
        {hintText && (
          <p style={{ margin: 0, fontSize: 12, color: '#6b6960', lineHeight: 1.4 }}>{hintText}</p>
        )}
      </div>
    </div>
  )
}

export default function OnboardingSliders({ onComplete, userName }: Props) {
  const [scores, setScores] = useState<OnboardingScores>(DEFAULT_SCORES)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [saving, setSaving] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState('')

  const setScore = (key: keyof OnboardingScores, value: number) => {
    setScores(prev => ({ ...prev, [key]: value }))
  }

  const inferred = inferFromScores(scores)
  const total = ONBOARDING_QUESTIONS.length
  const currentQ = ONBOARDING_QUESTIONS[currentIndex]
  const isLast = currentIndex === total - 1

  const handleNext = () => {
    if (!isLast) {
      setCurrentIndex(i => i + 1)
    } else {
      handleSave()
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data: membership } = await supabase
        .from('organisation_members')
        .select('org_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle()

      if (!membership) throw new Error('No active workspace found')

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

  // ── Confirmation screen ──
  if (confirmed) {
    const templateLabel = TEMPLATE_LABELS[inferred.stage_template] || ''
    const firstName = userName ? userName.split(' ')[0] : ''
    const greeting = firstName ? `${firstName}, you're` : "You're"

    const highlights = [
      templateLabel
        ? `Pipeline configured for ${templateLabel} deals`
        : 'Pipeline configured for your sales process',
      `AI flags deals quiet for ${inferred.at_risk_days}+ days`,
      inferred.pain_points.length > 0
        ? inferred.pain_points[0].charAt(0).toUpperCase() + inferred.pain_points[0].slice(1)
        : 'Smart daily briefings enabled',
    ]

    return (
      <div className="animate-fade-in-up">
        <div style={{
          width: 48, height: 48, borderRadius: 14,
          background: '#1a1a18', display: 'flex',
          alignItems: 'center', justifyContent: 'center', marginBottom: 24,
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M5 13l4 4L19 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        <p style={{ margin: '0 0 8px', fontSize: 13, color: '#9b9890', letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: 500 }}>
          All set
        </p>
        <h1 style={{ margin: '0 0 8px', fontSize: 28, fontWeight: 500, color: '#1a1a18', lineHeight: 1.2 }}>
          {greeting} ready<br />to close deals.
        </h1>
        <p style={{ margin: '0 0 28px', fontSize: 14, color: '#9b9890', lineHeight: 1.5 }}>
          Rollable is configured for your team. You can adjust everything in settings.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
          {highlights.map((h, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#1a1a18', flexShrink: 0, marginTop: 5 }} />
              <p style={{ margin: 0, fontSize: 14, color: '#6b6960', lineHeight: 1.5 }}>{h}</p>
            </div>
          ))}
        </div>

        <button
          onClick={onComplete}
          style={{
            width: '100%', background: '#1a1a18', color: 'white',
            border: 'none', borderRadius: 22, padding: '16px 24px',
            fontSize: 16, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Let's go →
        </button>
      </div>
    )
  }

  // ── Slider (one at a time) ──
  return (
    <div className="animate-fade-in-up">
      {/* Progress bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 36 }}>
        <div style={{ flex: 1, height: 3, borderRadius: 2, background: 'rgba(0,0,0,0.07)', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 2, background: '#1a1a18',
            width: `${((currentIndex + 1) / total) * 100}%`,
            transition: 'width 0.3s ease',
          }} />
        </div>
        <span style={{ fontSize: 12, color: '#9b9890', flexShrink: 0 }}>{currentIndex + 1} of {total}</span>
      </div>

      <p style={{ margin: '0 0 8px', fontSize: 13, color: '#9b9890', letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: 500 }}>
        Quick setup
      </p>
      <h1 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 500, color: '#1a1a18', lineHeight: 1.2 }}>
        Describe your<br />sales process
      </h1>
      <p style={{ margin: '0 0 24px', fontSize: 14, color: '#9b9890', lineHeight: 1.5 }}>
        Rollable configures itself from your answers.
      </p>

      <SliderInput
        question={currentQ.question}
        low={currentQ.low}
        high={currentQ.high}
        scaleHint={currentQ.scaleHint}
        lowHint={currentQ.lowHint}
        highHint={currentQ.highHint}
        value={scores[currentQ.key]}
        onChange={v => setScore(currentQ.key, v)}
      />

      {error && <p style={{ margin: '12px 0 0', fontSize: 13, color: '#E24B4A' }}>{error}</p>}

      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        {currentIndex > 0 && (
          <button
            onClick={() => setCurrentIndex(i => i - 1)}
            style={{
              padding: '16px 20px', fontSize: 15, fontWeight: 500,
              color: '#1a1a18', background: 'white',
              border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: 22,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            ←
          </button>
        )}
        <button
          onClick={handleNext}
          disabled={saving}
          style={{
            flex: 1, padding: '16px', fontSize: 16, fontWeight: 500,
            color: 'white', background: saving ? '#9b9890' : '#1a1a18',
            border: 'none', borderRadius: 22,
            cursor: saving ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit', transition: 'background 0.2s ease',
          }}
        >
          {saving ? 'Configuring...' : isLast ? 'Finish →' : 'Next →'}
        </button>
      </div>
    </div>
  )
}
