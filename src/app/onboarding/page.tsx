'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

type Step = 'choose' | 'create' | 'join'

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('choose')
  const [orgName, setOrgName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const slugify = (text: string) =>
    text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!orgName.trim()) return
    setLoading(true)
    setError('')

    const supabase = createClient()

    try {
      const slug = slugify(orgName) + '-' + Math.random().toString(36).slice(2, 6)
      const { data, error: fnError } = await supabase.rpc('create_organisation', {
        org_name: orgName.trim(),
        org_slug: slug,
      })

      if (fnError) throw fnError

      router.push('/')
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.')
      setLoading(false)
    }
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
      {/* Logo */}
      <div>
        <div style={{
          width: '48px', height: '48px', borderRadius: '14px',
          background: '#1a1a18', display: 'flex', alignItems: 'center',
          justifyContent: 'center', marginBottom: '32px',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>

        {step === 'choose' && (
          <div className="animate-fade-in-up">
            <h1 style={{ margin: '0 0 8px', fontSize: '26px', fontWeight: 500, color: '#1a1a18' }}>
              Welcome aboard.
            </h1>
            <p style={{ margin: '0 0 32px', fontSize: '15px', color: '#9b9890', lineHeight: 1.5 }}>
              Set up your workspace to get started.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button onClick={() => setStep('create')} style={{
                background: '#1a1a18', borderRadius: '18px', padding: '20px',
                display: 'flex', alignItems: 'center', gap: '16px',
                border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%',
              }}>
                <div style={{
                  width: '44px', height: '44px', borderRadius: '12px',
                  background: 'rgba(255,255,255,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: '15px', fontWeight: 500, color: 'white' }}>
                    Create a new workspace
                  </p>
                  <p style={{ margin: '3px 0 0', fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>
                    For your company or team
                  </p>
                </div>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M6 4l4 4-4 4" stroke="rgba(255,255,255,0.4)" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
              </button>

              <button onClick={() => setStep('join')} style={{
                background: 'white', borderRadius: '18px',
                border: '0.5px solid rgba(0,0,0,0.07)', padding: '20px',
                display: 'flex', alignItems: 'center', gap: '16px',
                cursor: 'pointer', textAlign: 'left', width: '100%',
              }}>
                <div style={{
                  width: '44px', height: '44px', borderRadius: '12px',
                  background: '#f5f4f0',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="#1a1a18" strokeWidth="1.5" strokeLinecap="round" />
                    <circle cx="9" cy="7" r="4" stroke="#1a1a18" strokeWidth="1.5" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="#1a1a18" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: '15px', fontWeight: 500, color: '#1a1a18' }}>
                    Join an existing workspace
                  </p>
                  <p style={{ margin: '3px 0 0', fontSize: '13px', color: '#9b9890' }}>
                    You have an invite from your team
                  </p>
                </div>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M6 4l4 4-4 4" stroke="#9b9890" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {step === 'create' && (
          <div className="animate-fade-in-up">
            <button onClick={() => setStep('choose')} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '14px', color: '#9b9890', padding: 0,
              marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '6px',
              fontFamily: 'inherit',
            }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M10 4L6 8l4 4" stroke="#9b9890" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
              Back
            </button>

            <h1 style={{ margin: '0 0 8px', fontSize: '24px', fontWeight: 500, color: '#1a1a18' }}>
              Name your workspace
            </h1>
            <p style={{ margin: '0 0 28px', fontSize: '15px', color: '#9b9890' }}>
              This is usually your company name.
            </p>

            <form onSubmit={handleCreateOrg} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '13px', color: '#6b6960', display: 'block', marginBottom: '8px' }}>
                  Workspace name
                </label>
                <input
                  type="text"
                  value={orgName}
                  onChange={e => setOrgName(e.target.value)}
                  placeholder="Acme Sales Team"
                  required
                  autoFocus
                  style={{
                    width: '100%', padding: '14px 16px',
                    fontSize: '16px', color: '#1a1a18',
                    background: 'white', border: '0.5px solid rgba(0,0,0,0.12)',
                    borderRadius: '14px', outline: 'none',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              {orgName && (
                <p style={{ margin: 0, fontSize: '13px', color: '#9b9890' }}>
                  You'll be the admin of this workspace.
                </p>
              )}

              {error && (
                <p style={{ margin: 0, fontSize: '13px', color: '#E24B4A' }}>{error}</p>
              )}

              <button
                type="submit"
                disabled={loading || !orgName.trim()}
                style={{
                  width: '100%', padding: '16px',
                  fontSize: '16px', fontWeight: 500,
                  color: 'white', background: loading ? '#6b6960' : '#1a1a18',
                  border: 'none', borderRadius: '22px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                  marginTop: '8px',
                }}
              >
                {loading ? 'Creating...' : 'Create workspace'}
              </button>
            </form>
          </div>
        )}

        {step === 'join' && (
          <div className="animate-fade-in-up">
            <button onClick={() => setStep('choose')} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '14px', color: '#9b9890', padding: 0,
              marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '6px',
              fontFamily: 'inherit',
            }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M10 4L6 8l4 4" stroke="#9b9890" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
              Back
            </button>

            <h1 style={{ margin: '0 0 8px', fontSize: '24px', fontWeight: 500, color: '#1a1a18' }}>
              Join your team
            </h1>
            <p style={{ margin: '0 0 28px', fontSize: '15px', color: '#9b9890', lineHeight: 1.5 }}>
              Ask your admin to send you an invite link. It will take you straight in.
            </p>

            <div style={{
              background: 'white', borderRadius: '16px',
              border: '0.5px solid rgba(0,0,0,0.07)',
              padding: '20px', textAlign: 'center',
            }}>
              <p style={{ margin: 0, fontSize: '14px', color: '#9b9890', lineHeight: 1.6 }}>
                Invite links coming soon. For now, ask your admin to add your email directly from their workspace settings.
              </p>
            </div>
          </div>
        )}
      </div>

      <p style={{ margin: 0, fontSize: '12px', color: '#c8c5be', textAlign: 'center' }}>
        SDM Prototype 001
      </p>
    </main>
  )
}
