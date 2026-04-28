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
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) { setError(error.message); setLoading(false) }
    else { setSent(true); setLoading(false) }
  }

  const handleGitHub = async () => {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  const handleGoogle = async () => {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  return (
    <main style={{
      minHeight: '100dvh',
      background: '#f5f4f0',
      display: 'flex',
      justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '420px',
        margin: '0 auto',
        minHeight: 'min(760px, calc(100dvh - 48px))',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '40px 0 24px',
      }}>
        <div>
          {/* Logo */}
          {/* Logo */}
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 56" height="32" style={{ marginBottom: '32px' }}>
            <text y="44" fontFamily="Inter, -apple-system, BlinkMacSystemFont, sans-serif" fontSize="40" letterSpacing="-1">
              <tspan fontWeight="700" fill="#1a1a18">Roll</tspan>
              <tspan fontWeight="300" fill="#9b9890">able</tspan>
            </text>
          </svg>

          <h1 style={{ margin: '0 0 8px', fontSize: '28px', fontWeight: 500, color: '#1a1a18', lineHeight: 1.2 }}>
            Liberate your<br />sales team.
          </h1>
          <p style={{ margin: '0 0 40px', fontSize: '16px', color: '#9b9890', lineHeight: 1.5 }}>
            Snap, speak, or screenshot — AI handles the rest.
          </p>
        </div>

        <div>
          {!sent ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

              {/* OAuth buttons */}
              <button onClick={handleGoogle} style={{
                width: '100%', padding: '14px 16px',
                background: 'white', border: '0.5px solid rgba(0,0,0,0.12)',
                borderRadius: '16px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                fontSize: '15px', fontWeight: 500, color: '#1a1a18', fontFamily: 'inherit',
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Continue with Google
              </button>

              <button onClick={handleGitHub} style={{
                width: '100%', padding: '14px 16px',
                background: '#1a1a18', border: 'none',
                borderRadius: '16px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                fontSize: '15px', fontWeight: 500, color: 'white', fontFamily: 'inherit',
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                  <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
                </svg>
                Continue with GitHub
              </button>

              {/* Divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '4px 0' }}>
                <div style={{ flex: 1, height: '0.5px', background: 'rgba(0,0,0,0.1)' }} />
                <span style={{ fontSize: '13px', color: '#9b9890' }}>or use email</span>
                <div style={{ flex: 1, height: '0.5px', background: 'rgba(0,0,0,0.1)' }} />
              </div>

              {/* Magic link form */}
              <form onSubmit={handleMagicLink} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
                    borderRadius: '16px', outline: 'none', fontFamily: 'inherit',
                  }}
                />
                {error && <p style={{ margin: 0, fontSize: '13px', color: '#E24B4A' }}>{error}</p>}
                <button type="submit" disabled={loading || !email} style={{
                  width: '100%', padding: '15px',
                  fontSize: '15px', fontWeight: 500,
                  color: 'white', background: loading ? '#6b6960' : '#1a1a18',
                  border: 'none', borderRadius: '16px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit', transition: 'background 0.2s ease',
                }}>
                  {loading ? 'Sending...' : 'Send magic link'}
                </button>
                <p style={{ margin: 0, fontSize: '13px', color: '#9b9890', textAlign: 'center' }}>
                  No password needed. We'll email you a link.
                </p>
              </form>
            </div>
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
              <button onClick={() => { setSent(false); setEmail('') }} style={{
                background: 'none', border: 'none', fontSize: '14px',
                color: '#9b9890', cursor: 'pointer', fontFamily: 'inherit',
              }}>
                Use a different email
              </button>
            </div>
          )}
        </div>

        <p style={{ margin: 0, fontSize: '12px', color: '#c8c5be', textAlign: 'center' }}>
          rollable app
        </p>
      </div>
    </main>
  )
}