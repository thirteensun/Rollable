'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

interface Member {
  role: string
  status: string
  invited_email: string | null
  user_id: string | null
  users: { full_name: string | null; email: string | null } | null
}

interface Props {
  name: string
  email: string
  initials: string
  role: string
  orgName: string
  orgId: string
  members: Member[]
  plan: string
  seats: number
}

export default function SettingsClient({ name, email, initials, role, orgName, orgId, members, plan, seats }: Props) {
  const router = useRouter()
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteSuccess, setInviteSuccess] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false)

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setInviting(true)
    setInviteError('')

    const supabase = createClient()
    try {
      // Add to organisation_members as invited
      const { error } = await supabase
        .from('organisation_members')
        .insert({
          org_id: orgId,
          invited_email: inviteEmail.trim(),
          role: 'rep',
          status: 'invited',
        })

      if (error) throw error

      // Send magic link to their email
      await supabase.auth.signInWithOtp({
        email: inviteEmail.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      setInviteSuccess(true)
      setInviteEmail('')
      setTimeout(() => setInviteSuccess(false), 3000)
    } catch (err: any) {
      setInviteError(err.message || 'Failed to send invite.')
    } finally {
      setInviting(false)
    }
  }

  const roleColor: Record<string, string> = {
    admin: '#185FA5',
    manager: '#854F0B',
    rep: '#0F6E56',
  }

  const roleBg: Record<string, string> = {
    admin: '#E6F1FB',
    manager: '#FAEEDA',
    rep: '#E1F5EE',
  }

  return (
    <main style={{ background: '#f5f4f0', paddingBottom: 0 }}>

      {/* Header */}
      <div style={{ padding: '56px 24px 24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button onClick={() => router.back()} style={{
          width: '32px', height: '32px', borderRadius: '50%',
          background: 'rgba(0,0,0,0.07)', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M10 4L6 8l4 4" stroke="#1a1a18" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        </button>
        <p style={{ margin: 0, fontSize: '20px', fontWeight: 500, color: '#1a1a18' }}>Settings</p>
      </div>

      {/* Profile card */}
      <div style={{ padding: '0 24px 16px' }}>
        <div style={{ background: 'white', borderRadius: '18px', border: '0.5px solid rgba(0,0,0,0.07)', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '52px', height: '52px', borderRadius: '50%',
              background: '#1a1a18', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: '16px', fontWeight: 500, color: 'white', flexShrink: 0,
            }}>
              {initials}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: '16px', fontWeight: 500, color: '#1a1a18' }}>{name}</p>
              <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#9b9890' }}>{email}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                <span style={{
                  fontSize: '11px', fontWeight: 500,
                  background: roleBg[role] || '#f5f4f0',
                  color: roleColor[role] || '#6b6960',
                  borderRadius: '6px', padding: '2px 8px', textTransform: 'capitalize',
                }}>
                  {role}
                </span>
                <span style={{ fontSize: '12px', color: '#9b9890' }}>{orgName}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Workspace */}
      <div style={{ padding: '0 24px 16px' }}>
        <p style={{ margin: '0 0 10px', fontSize: '12px', fontWeight: 500, color: '#9b9890', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Workspace
        </p>
        <div style={{ background: 'white', borderRadius: '18px', border: '0.5px solid rgba(0,0,0,0.07)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '0.5px solid rgba(0,0,0,0.05)' }}>
            <span style={{ fontSize: '14px', color: '#6b6960' }}>Name</span>
            <span style={{ fontSize: '14px', fontWeight: 500, color: '#1a1a18' }}>{orgName}</span>
          </div>
          <div style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '0.5px solid rgba(0,0,0,0.05)' }}>
            <span style={{ fontSize: '14px', color: '#6b6960' }}>Plan</span>
            <span style={{ fontSize: '14px', fontWeight: 500, color: '#1a1a18', textTransform: 'capitalize' }}>{plan}</span>
          </div>
          <div style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', color: '#6b6960' }}>Members</span>
            <span style={{ fontSize: '14px', fontWeight: 500, color: '#1a1a18' }}>{members.length} / {seats} seat{seats !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>

      {/* Team */}
      <div style={{ padding: '0 24px 16px' }}>
        <p style={{ margin: '0 0 10px', fontSize: '12px', fontWeight: 500, color: '#9b9890', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Team
        </p>
        <div style={{ background: 'white', borderRadius: '18px', border: '0.5px solid rgba(0,0,0,0.07)', overflow: 'hidden' }}>
          {members.map((member, i) => {
            const memberName = member.users?.full_name || member.users?.email || member.invited_email || 'Unknown'
            const memberEmail = member.users?.email || member.invited_email || ''
            const memberInitials = memberName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
            return (
              <div key={i} style={{
                padding: '13px 18px', display: 'flex', alignItems: 'center', gap: '12px',
                borderBottom: i < members.length - 1 ? '0.5px solid rgba(0,0,0,0.05)' : 'none',
              }}>
                <div style={{
                  width: '34px', height: '34px', borderRadius: '50%',
                  background: '#f5f4f0', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: '11px', fontWeight: 500, color: '#6b6960', flexShrink: 0,
                }}>
                  {memberInitials}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: '#1a1a18' }}>{memberName}</p>
                  <p style={{ margin: '1px 0 0', fontSize: '12px', color: '#9b9890' }}>{memberEmail}</p>
                </div>
                <span style={{
                  fontSize: '11px', fontWeight: 500,
                  background: roleBg[member.role] || '#f5f4f0',
                  color: roleColor[member.role] || '#6b6960',
                  borderRadius: '6px', padding: '2px 8px', textTransform: 'capitalize',
                }}>
                  {member.role}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Invite — admin only */}
      {role === 'admin' && (
        <div style={{ padding: '0 24px 16px' }}>
          <p style={{ margin: '0 0 10px', fontSize: '12px', fontWeight: 500, color: '#9b9890', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Invite teammate
          </p>
          <div style={{ background: 'white', borderRadius: '18px', border: '0.5px solid rgba(0,0,0,0.07)', padding: '16px 18px' }}>
            <form onSubmit={handleInvite} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="colleague@company.com"
                style={{
                  width: '100%', padding: '12px 14px',
                  fontSize: '15px', color: '#1a1a18',
                  background: '#f5f4f0', border: '0.5px solid rgba(0,0,0,0.08)',
                  borderRadius: '12px', outline: 'none', fontFamily: 'inherit',
                }}
              />
              {inviteError && <p style={{ margin: 0, fontSize: '13px', color: '#E24B4A' }}>{inviteError}</p>}
              {inviteSuccess && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#1D9E75' }} />
                  <p style={{ margin: 0, fontSize: '13px', color: '#1D9E75' }}>Invite sent!</p>
                </div>
              )}
              <button type="submit" disabled={inviting || !inviteEmail.trim()} style={{
                width: '100%', padding: '13px',
                fontSize: '15px', fontWeight: 500,
                color: 'white',
                background: inviting || !inviteEmail.trim() ? '#9b9890' : '#1a1a18',
                border: 'none', borderRadius: '14px',
                cursor: inviting || !inviteEmail.trim() ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', transition: 'background 0.2s ease',
              }}>
                {inviting ? 'Sending...' : 'Send invite'}
              </button>
            </form>
            <p style={{ margin: '10px 0 0', fontSize: '12px', color: '#9b9890', lineHeight: 1.5 }}>
              They'll receive a magic link to join your workspace.
            </p>
          </div>
        </div>
      )}

      {/* Sign out */}
      <div style={{ padding: '0 24px 16px' }}>
        {!showSignOutConfirm ? (
          <button onClick={() => setShowSignOutConfirm(true)} style={{
            width: '100%', padding: '15px',
            fontSize: '15px', fontWeight: 500,
            color: '#E24B4A', background: 'white',
            border: '0.5px solid rgba(226,75,74,0.2)',
            borderRadius: '18px', cursor: 'pointer',
            fontFamily: 'inherit',
          }}>
            Sign out
          </button>
        ) : (
          <div style={{ background: 'white', borderRadius: '18px', border: '0.5px solid rgba(226,75,74,0.2)', padding: '16px 18px' }}>
            <p style={{ margin: '0 0 14px', fontSize: '14px', color: '#1a1a18', textAlign: 'center' }}>
              Are you sure you want to sign out?
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowSignOutConfirm(false)} style={{
                flex: 1, padding: '13px', fontSize: '14px', fontWeight: 500,
                color: '#6b6960', background: '#f5f4f0', border: 'none',
                borderRadius: '12px', cursor: 'pointer', fontFamily: 'inherit',
              }}>
                Cancel
              </button>
              <button onClick={handleSignOut} style={{
                flex: 1, padding: '13px', fontSize: '14px', fontWeight: 500,
                color: 'white', background: '#E24B4A', border: 'none',
                borderRadius: '12px', cursor: 'pointer', fontFamily: 'inherit',
              }}>
                Sign out
              </button>
            </div>
          </div>
        )}
      </div>

      <p style={{ margin: '0 0 24px', fontSize: '12px', color: '#c8c5be', textAlign: 'center' }}>
        SDM Prototype 001
      </p>

    </main>
  )
}