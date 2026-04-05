'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSent(true)
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
      {/* Logo / brand */}
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
        <h1 style={{ margin: '0 0 8px', fontSize: '28px', fontWeight: 500, color: '#1a1a18', lineHeight: 1.2 }}>
          Liberate your<br />sales team.
        </h1>
        <p style={{ margin: 0, fontSize: '16px', color: '#9b9890', lineHeight: 1.5 }}>
          Snap, speak, or screenshot — AI handles the rest.
        </p>
      </div>

      {/* Form */}
      <div>
        {!sent ? (
          <form onSubmit={handleMagicLink} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '13px', color: '#6b6960', display: 'block', marginBottom: '8px' }}>
                Work email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                style={{
                  width: '100%', padding: '14px 16px',
                  fontSize: '16px', color: '#1a1a18',
                  background: 'white', border: '0.5px solid rgba(0,0,0,0.12)',
                  borderRadius: '14px', outline: 'none',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            {error && (
              <p style={{ margin: 0, fontSize: '13px', color: '#E24B4A' }}>{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !email}
              style={{
                width: '100%', padding: '16px',
                fontSize: '16px', fontWeight: 500,
                color: 'white', background: loading ? '#6b6960' : '#1a1a18',
                border: 'none', borderRadius: '22px',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s ease',
                fontFamily: 'inherit',
              }}
            >
              {loading ? 'Sending...' : 'Send magic link'}
            </button>

            <p style={{ margin: 0, fontSize: '13px', color: '#9b9890', textAlign: 'center' }}>
              No password needed. We'll email you a link.
            </p>
          </form>
        ) : (
          <div style={{
            background: 'white', borderRadius: '18px',
            border: '0.5px solid rgba(0,0,0,0.07)',
            padding: '24px', textAlign: 'center',
          }} className="animate-fade-in-up">
            <div style={{
              width: '48px', height: '48px', borderRadius: '50%',
              background: '#E1F5EE', display: 'flex', alignItems: 'center',
              justifyContent: 'center', margin: '0 auto 16px',
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M3 8l7.5 5L18 8" stroke="#1D9E75" strokeWidth="1.5" strokeLinecap="round" />
                <rect x="3" y="5" width="18" height="14" rx="2" stroke="#1D9E75" strokeWidth="1.5" />
              </svg>
            </div>
            <p style={{ margin: '0 0 8px', fontSize: '17px', fontWeight: 500, color: '#1a1a18' }}>
              Check your email
            </p>
            <p style={{ margin: '0 0 20px', fontSize: '14px', color: '#9b9890', lineHeight: 1.5 }}>
              We sent a magic link to<br />
              <strong style={{ fontWeight: 500, color: '#1a1a18' }}>{email}</strong>
            </p>
            <button
              onClick={() => { setSent(false); setEmail('') }}
              style={{
                background: 'none', border: 'none',
                fontSize: '14px', color: '#9b9890',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Use a different email
            </button>
          </div>
        )}
      </div>

      <p style={{ margin: 0, fontSize: '12px', color: '#c8c5be', textAlign: 'center' }}>
        SDM Prototype 001
      </p>
    </main>
  )
}
