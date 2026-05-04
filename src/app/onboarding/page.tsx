'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import OnboardingSliders from './OnboardingSliders'

type Step = 'choose' | 'create' | 'join' | 'chat'

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>('choose')
  const [orgName, setOrgName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(true)

  const slugify = (text: string) =>
    text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

  useEffect(() => {
    const check = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setChecking(false); return }
      const { data: membership } = await supabase
        .from('organisation_members')
        .select('org_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle()
      if (membership) {
        window.location.href = '/'
      } else {
        setChecking(false)
      }
    }
    check()
  }, [])

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!orgName.trim()) return
    setLoading(true)
    setError('')

    const supabase = createClient()

    try {
      const slug = slugify(orgName) + '-' + Math.random().toString(36).slice(2, 6)
      const res = await fetch('/api/org/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_name: orgName.trim(), org_slug: slug }),
      })

      if (!res.ok) {
        const data = await res.json()
        if (data.error === 'registration_limit_reached') {
          window.location.href = '/waitlist'
          return
        }
        throw new Error(data.error || 'Something went wrong. Please try again.')
      }

      await supabase.auth.refreshSession()
      await new Promise(r => setTimeout(r, 500))
      setLoading(false)
      setStep('chat')
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <main style={{ minHeight: '100dvh', background: '#f5f4f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#1a1a18', animation: `breathe 1.2s ease-in-out ${i * 0.2}s infinite` }} />
          ))}
        </div>
      </main>
    )
  }

  return (
    <main style={{
      minHeight: '100dvh',
      background: '#f5f4f0',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '64px 24px 48px',
    }}>
      <div>
        {/* Logo mark — hidden on chat step */}
        {step !== 'chat' && (
          <div style={{
            width: '48px', height: '48px', borderRadius: '14px',
            background: '#1a1a18', display: 'flex', alignItems: 'center',
            justifyContent: 'center', marginBottom: '40px',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
        )}

        {/* Step: Choose */}
        {step === 'choose' && (
          <div className="animate-fade-in-up">
            <p style={{ margin: '0 0 8px', fontSize: '13px', color: '#9b9890', letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: 500 }}>
              One last thing
            </p>
            <h1 style={{ margin: '0 0 12px', fontSize: '30px', fontWeight: 500, color: '#1a1a18', lineHeight: 1.15 }}>
              Liberate your<br />sales team.
            </h1>
            <p style={{ margin: '0 0 40px', fontSize: '16px', color: '#9b9890', lineHeight: 1.6 }}>
              Set up your workspace and let AI handle the rest — no forms, no friction, just results.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button onClick={() => setStep('create')} style={{
                background: '#1a1a18', borderRadius: '18px', padding: '20px',
                display: 'flex', alignItems: 'center', gap: '16px',
                border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%',
              }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: '15px', fontWeight: 500, color: 'white' }}>Create a new workspace</p>
                  <p style={{ margin: '3px 0 0', fontSize: '13px', color: 'rgba(255,255,255,0.45)' }}>For your company or team</p>
                </div>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M6 4l4 4-4 4" stroke="rgba(255,255,255,0.35)" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
              </button>

              <button onClick={() => setStep('join')} style={{
                background: 'white', borderRadius: '18px',
                border: '0.5px solid rgba(0,0,0,0.07)', padding: '20px',
                display: 'flex', alignItems: 'center', gap: '16px',
                cursor: 'pointer', textAlign: 'left', width: '100%',
              }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#f5f4f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="#1a1a18" strokeWidth="1.5" strokeLinecap="round" />
                    <circle cx="9" cy="7" r="4" stroke="#1a1a18" strokeWidth="1.5" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="#1a1a18" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: '15px', fontWeight: 500, color: '#1a1a18' }}>Join an existing workspace</p>
                  <p style={{ margin: '3px 0 0', fontSize: '13px', color: '#9b9890' }}>You have an invite from your team</p>
                </div>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M6 4l4 4-4 4" stroke="#c8c5be" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '36px' }}>
              {[
                {
                  text: 'Snap a photo or screenshot — AI logs everything',
                  icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="15" rx="2" stroke="#1a1a18" strokeWidth="1.5"/><circle cx="12" cy="12" r="3" stroke="#1a1a18" strokeWidth="1.5"/><circle cx="17.5" cy="7.5" r="1" fill="#1a1a18"/></svg>
                },
                {
                  text: 'Your day, intelligently planned every morning',
                  icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="8" height="8" rx="2" stroke="#1a1a18" strokeWidth="1.5"/><rect x="13" y="3" width="8" height="8" rx="2" stroke="#1a1a18" strokeWidth="1.5"/><rect x="3" y="13" width="8" height="8" rx="2" stroke="#1a1a18" strokeWidth="1.5"/><rect x="13" y="13" width="8" height="8" rx="2" stroke="#1a1a18" strokeWidth="1.5"/></svg>
                },
                {
                  text: 'Pipeline that updates itself, zero data entry',
                  icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M3 12h18M3 6h18M3 18h18" stroke="#1a1a18" strokeWidth="1.5" strokeLinecap="round"/></svg>
                },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '9px', background: 'white', border: '0.5px solid rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {item.icon}
                  </div>
                  <p style={{ margin: 0, fontSize: '14px', color: '#6b6960', lineHeight: 1.4 }}>{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step: Create */}
        {step === 'create' && (
          <div className="animate-fade-in-up">
            <button onClick={() => setStep('choose')} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '14px', color: '#9b9890', padding: 0,
              marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '6px',
              fontFamily: 'inherit',
            }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M10 4L6 8l4 4" stroke="#9b9890" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
              Back
            </button>

            <p style={{ margin: '0 0 8px', fontSize: '13px', color: '#9b9890', letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: 500 }}>Almost there</p>
            <h1 style={{ margin: '0 0 8px', fontSize: '28px', fontWeight: 500, color: '#1a1a18', lineHeight: 1.2 }}>
              Name your<br />workspace
            </h1>
            <p style={{ margin: '0 0 32px', fontSize: '15px', color: '#9b9890', lineHeight: 1.5 }}>
              This is usually your company name. You can always change it later.
            </p>

            <form onSubmit={handleCreateOrg} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '13px', color: '#6b6960', display: 'block', marginBottom: '8px' }}>Workspace name</label>
                <input
                  type="text"
                  value={orgName}
                  onChange={e => setOrgName(e.target.value)}
                  placeholder="Acme Sales Team"
                  required
                  autoFocus
                  style={{
                    width: '100%', padding: '15px 16px',
                    fontSize: '16px', color: '#1a1a18',
                    background: 'white', border: '0.5px solid rgba(0,0,0,0.12)',
                    borderRadius: '14px', outline: 'none', fontFamily: 'inherit',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {orgName.trim() && (
                <div style={{ background: 'white', borderRadius: '12px', border: '0.5px solid rgba(0,0,0,0.07)', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#1a1a18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 500, color: 'white', flexShrink: 0 }}>
                    {orgName.trim()[0].toUpperCase()}
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: '13px', fontWeight: 500, color: '#1a1a18' }}>{orgName.trim()}</p>
                    <p style={{ margin: 0, fontSize: '11px', color: '#9b9890' }}>You · Admin · Free plan</p>
                  </div>
                </div>
              )}

              {error && <p style={{ margin: 0, fontSize: '13px', color: '#E24B4A' }}>{error}</p>}

              <button type="submit" disabled={loading || !orgName.trim()} style={{
                width: '100%', padding: '16px', fontSize: '16px', fontWeight: 500,
                color: 'white', background: loading || !orgName.trim() ? '#9b9890' : '#1a1a18',
                border: 'none', borderRadius: '22px',
                cursor: loading || !orgName.trim() ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', marginTop: '8px', transition: 'background 0.2s ease',
              }}>
                {loading ? 'Setting up your workspace...' : 'Create workspace'}
              </button>
            </form>
          </div>
        )}

        {/* Step: Join */}
        {step === 'join' && (
          <div className="animate-fade-in-up">
            <button onClick={() => setStep('choose')} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '14px', color: '#9b9890', padding: 0,
              marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '6px',
              fontFamily: 'inherit',
            }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M10 4L6 8l4 4" stroke="#9b9890" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
              Back
            </button>

            <p style={{ margin: '0 0 8px', fontSize: '13px', color: '#9b9890', letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: 500 }}>Join your team</p>
            <h1 style={{ margin: '0 0 8px', fontSize: '28px', fontWeight: 500, color: '#1a1a18', lineHeight: 1.2 }}>
              Your team is<br />waiting for you.
            </h1>
            <p style={{ margin: '0 0 32px', fontSize: '15px', color: '#9b9890', lineHeight: 1.5 }}>
              Ask your admin to send you an invite link — it'll bring you straight in.
            </p>

            <div style={{ background: 'white', borderRadius: '16px', border: '0.5px solid rgba(0,0,0,0.07)', padding: '20px' }}>
              <p style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 500, color: '#1a1a18' }}>No invite yet?</p>
              <p style={{ margin: 0, fontSize: '13px', color: '#9b9890', lineHeight: 1.6 }}>
                Ask your admin to add your email from their workspace settings. You'll get a magic link to join instantly.
              </p>
            </div>
          </div>
        )}

        {/* Step: Chat */}
        {step === 'chat' && (
          <OnboardingSliders onComplete={() => { window.location.href = '/' }} />
        )}
      </div>

      {step !== 'chat' && (
        <p style={{ margin: 0, fontSize: '12px', color: '#c8c5be', textAlign: 'center' }}>rollable app</p>
      )}
    </main>
  )
}