'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import SettingsSliders from './SettingsSliders'

interface Member {
  id: string
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
  avatar?: string
  role: string
  orgName: string
  orgId: string
  orgContext: Record<string, any>
  members: Member[]
  plan: string
  seats: number
}

const roleColor: Record<string, string> = {
  admin:   '#185FA5',
  manager: '#854F0B',
  member:  '#0F6E56',
  rep:     '#0F6E56',
}
const roleBg: Record<string, string> = {
  admin:   '#E6F1FB',
  manager: '#FAEEDA',
  member:  '#E1F5EE',
  rep:     '#E1F5EE',
}
const planColor: Record<string, string> = {
  free:     '#9b9890',
  pro:      '#185FA5',
  business: '#854F0B',
}

export default function SettingsClient({
  name, email, initials, avatar, role, orgName, orgId, orgContext, members, plan, seats,
}: Props) {
  const router = useRouter()

  const isAdmin = role === 'admin'

  const [inviteEmail, setInviteEmail]       = useState('')
  const [inviteRole, setInviteRole]         = useState<'manager' | 'member'>('member')
  const [inviting, setInviting]             = useState(false)
  const [inviteSuccess, setInviteSuccess]   = useState(false)
  const [inviteError, setInviteError]       = useState('')
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false)

  const [memberList, setMemberList] = useState<Member[]>(members)
  const [togglingRole, setTogglingRole]     = useState<string | null>(null)
  const [removing, setRemoving]             = useState<string | null>(null)

  const handleRoleToggle = async (member: Member) => {
    const newRole = member.role === 'manager' ? 'member' : 'manager'
    setTogglingRole(member.id)
    try {
      const res = await fetch(`/api/org/member/${member.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      if (res.ok) {
        setMemberList(prev => prev.map(m => m.id === member.id ? { ...m, role: newRole } : m))
      }
    } finally {
      setTogglingRole(null)
    }
  }

  const handleRemove = async (member: Member) => {
    setRemoving(member.id)
    try {
      const res = await fetch(`/api/org/member/${member.id}`, { method: 'DELETE' })
      if (res.ok) {
        setMemberList(prev => prev.filter(m => m.id !== member.id))
      }
    } finally {
      setRemoving(null)
    }
  }

  const [editingName, setEditingName]       = useState(false)
  const [nameValue, setNameValue]           = useState(name)
  const [savingName, setSavingName]         = useState(false)

  const handleNameSave = async () => {
    if (!nameValue.trim() || nameValue.trim() === name) { setEditingName(false); return }
    setSavingName(true)
    await fetch('/api/user/name', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nameValue.trim() }),
    })
    setSavingName(false)
    setEditingName(false)
    router.refresh()
  }

  const [editingOrgName, setEditingOrgName] = useState(false)
  const [orgNameValue, setOrgNameValue]     = useState(orgName)
  const [savingOrgName, setSavingOrgName]   = useState(false)

  const handleOrgNameSave = async () => {
    if (!orgNameValue.trim() || orgNameValue.trim() === orgName) { setEditingOrgName(false); return }
    setSavingOrgName(true)
    await fetch('/api/org/name', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ org_id: orgId, name: orgNameValue.trim() }),
    })
    setSavingOrgName(false)
    setEditingOrgName(false)
    router.refresh()
  }

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    const activeMembers = memberList.filter(m => m.status === 'active').length
    if (activeMembers >= seats) {
      setInviteError(`Seat limit reached (${seats} seats on ${plan} plan). Upgrade to invite more.`)
      return
    }
    setInviting(true)
    setInviteError('')
    const supabase = createClient()
    try {
      const existing = memberList.find(
        m => m.invited_email === inviteEmail.trim() || m.users?.email === inviteEmail.trim()
      )
      if (existing) { setInviteError('This person is already in your workspace.'); return }
      const { error } = await supabase.from('organisation_members').insert({
        org_id: orgId, invited_email: inviteEmail.trim(), role: inviteRole, status: 'invited',
      })
      if (error) throw error
      await supabase.auth.signInWithOtp({
        email: inviteEmail.trim(),
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      })
      setInviteSuccess(true)
      setInviteEmail('')
      setTimeout(() => setInviteSuccess(false), 4000)
    } catch (err: any) {
      setInviteError(err.message || 'Failed to send invite.')
    } finally {
      setInviting(false)
    }
  }

  return (
    <main style={{ background: '#f5f4f0', paddingBottom: 0 }}>

      {/* Header */}
      <div style={{ padding: '56px 24px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={() => router.back()}
          style={{ width: 32, height: 32, borderRadius: 'var(--radius-md)', background: 'rgba(0,0,0,0.07)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M10 4L6 8l4 4" stroke="#1a1a18" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
        </button>
        <p style={{ margin: 0, fontSize: 20, fontWeight: 500, color: '#1a1a18' }}>Settings</p>
      </div>

      <div style={{ padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── Profile card ── */}
        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-2xl)', border: '0.5px solid var(--border)', padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%', background: '#1a1a18',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, fontWeight: 500, color: 'white', flexShrink: 0, overflow: 'hidden',
            }}>
              {avatar
                ? <img src={avatar} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
                : initials
              }
            </div>
            <div style={{ flex: 1 }}>
              {editingName ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <input
                    autoFocus
                    value={nameValue}
                    onChange={e => setNameValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleNameSave(); if (e.key === 'Escape') setEditingName(false) }}
                    style={{ fontSize: 15, color: '#1a1a18', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 8, padding: '4px 8px', outline: 'none', fontFamily: 'inherit', width: 160, fontWeight: 500 }}
                  />
                  <button onClick={handleNameSave} disabled={savingName} style={{ fontSize: 12, color: 'white', background: '#1a1a18', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>
                    {savingName ? '…' : 'Save'}
                  </button>
                  <button onClick={() => { setEditingName(false); setNameValue(name) }} style={{ fontSize: 12, color: '#9b9890', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                </div>
              ) : (
                <button onClick={() => setEditingName(true)} style={{ margin: 0, fontSize: 16, fontWeight: 500, color: '#1a1a18', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {nameValue}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="#c8c5be" strokeWidth="1.5" strokeLinecap="round"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="#c8c5be" strokeWidth="1.5" strokeLinecap="round"/></svg>
                </button>
              )}
              <p style={{ margin: '2px 0 0', fontSize: 13, color: '#9b9890' }}>{email}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                <span style={{
                  fontSize: 11, fontWeight: 500,
                  background: roleBg[role] || '#f5f4f0',
                  color: roleColor[role] || '#6b6960',
                  borderRadius: 6, padding: '2px 8px', textTransform: 'capitalize',
                }}>
                  {role}
                </span>
                <span style={{ fontSize: 12, color: '#9b9890' }}>{orgName}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Workspace ── */}
        <div>
          <p style={{ margin: '0 0 10px', fontSize: 10, fontWeight: 600, color: '#9b9890', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace' }}>
            Workspace
          </p>
          <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-2xl)', border: '0.5px solid var(--border)', overflow: 'hidden' }}>
            <Row label="Name" value={
              isAdmin ? (
                editingOrgName ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      autoFocus
                      value={orgNameValue}
                      onChange={e => setOrgNameValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleOrgNameSave(); if (e.key === 'Escape') setEditingOrgName(false) }}
                      style={{ fontSize: 13, color: '#1a1a18', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 8, padding: '4px 8px', outline: 'none', fontFamily: 'inherit', width: 160 }}
                    />
                    <button onClick={handleOrgNameSave} disabled={savingOrgName} style={{ fontSize: 12, color: 'white', background: '#1a1a18', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>
                      {savingOrgName ? '…' : 'Save'}
                    </button>
                    <button onClick={() => setEditingOrgName(false)} style={{ fontSize: 12, color: '#9b9890', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => setEditingOrgName(true)} style={{ fontSize: 13, color: '#1a1a18', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {orgNameValue}
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="#c8c5be" strokeWidth="1.5" strokeLinecap="round"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="#c8c5be" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  </button>
                )
              ) : orgNameValue
            } />
            <Row label="Plan" value={
              <span style={{ fontSize: 13, fontWeight: 500, color: planColor[plan] || '#9b9890', textTransform: 'capitalize' }}>
                {plan}
              </span>
            } />
            <Row
              label="Members"
              value={`${memberList.filter(m => m.status === 'active').length} / ${seats} seat${seats !== 1 ? 's' : ''}`}
              last
            />
          </div>
        </div>

        {/* ── Customise — admin only ── */}
        {isAdmin && (
          <div>
            <p style={{ margin: '0 0 10px', fontSize: 10, fontWeight: 600, color: '#9b9890', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace' }}>
              Customise
            </p>
            <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-2xl)', border: '0.5px solid var(--border)', padding: '16px 18px' }}>
              <p style={{ margin: '0 0 18px', fontSize: 13, color: '#6b6960', lineHeight: 1.5 }}>
                Describe your sales process — Rollable configures fields, pipeline stages, and AI behaviour automatically.
              </p>
              <SettingsSliders orgId={orgId} orgContext={orgContext} />
            </div>
          </div>
        )}

        {/* ── Customise — read-only notice for non-admins ── */}
        {!isAdmin && (
          <div>
            <p style={{ margin: '0 0 10px', fontSize: 10, fontWeight: 600, color: '#9b9890', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace' }}>
              Customise
            </p>
            <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-2xl)', border: '0.5px solid var(--border)', padding: '16px 18px' }}>
              <p style={{ margin: 0, fontSize: 13, color: '#6b6960', lineHeight: 1.5 }}>
                Workspace configuration is managed by your admin. Reach out to them if you'd like to adjust pipeline stages, fields, or AI focus areas.
              </p>
            </div>
          </div>
        )}

        {/* ── Team ── */}
        <div>
          <p style={{ margin: '0 0 10px', fontSize: 10, fontWeight: 600, color: '#9b9890', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace' }}>
            Team
          </p>
          <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-2xl)', border: '0.5px solid var(--border)', overflow: 'hidden' }}>
            {memberList.map((member, i) => {
              const memberName     = member.users?.full_name || member.users?.email || member.invited_email || 'Unknown'
              const memberEmail    = member.users?.email || member.invited_email || ''
              const memberInitials = memberName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
              const isPending      = member.status === 'invited'
              const isOrgAdmin     = member.role === 'admin'
              const canEdit        = isAdmin && !isOrgAdmin
              const isToggling     = togglingRole === member.id
              const isRemoving     = removing === member.id
              return (
                <div
                  key={member.id}
                  style={{
                    padding: '13px 18px', display: 'flex', alignItems: 'center', gap: 12,
                    borderBottom: i < memberList.length - 1 ? '0.5px solid rgba(0,0,0,0.05)' : 'none',
                    opacity: isRemoving ? 0.4 : 1, transition: 'opacity 0.2s',
                  }}
                >
                  <div style={{
                    width: 34, height: 34, borderRadius: '50%',
                    background: isPending ? '#f5f4f0' : '#1a1a18',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 500,
                    color: isPending ? '#9b9890' : 'white', flexShrink: 0,
                  }}>
                    {memberInitials}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: isPending ? '#9b9890' : '#1a1a18' }}>
                      {memberName}
                    </p>
                    <p style={{ margin: '1px 0 0', fontSize: 12, color: '#9b9890' }}>
                      {isPending ? 'Invite pending' : memberEmail}
                    </p>
                  </div>
                  {canEdit ? (
                    <button
                      onClick={() => handleRoleToggle(member)}
                      disabled={isToggling}
                      title={`Switch to ${member.role === 'manager' ? 'member' : 'manager'}`}
                      style={{
                        fontSize: 11, fontWeight: 500,
                        background: roleBg[member.role] || '#f5f4f0',
                        color: roleColor[member.role] || '#6b6960',
                        borderRadius: 6, padding: '2px 8px',
                        textTransform: 'capitalize', flexShrink: 0,
                        border: 'none', cursor: isToggling ? 'not-allowed' : 'pointer',
                        fontFamily: 'inherit', opacity: isToggling ? 0.5 : 1,
                      }}
                    >
                      {isToggling ? '…' : member.role}
                    </button>
                  ) : (
                    <span style={{
                      fontSize: 11, fontWeight: 500,
                      background: roleBg[member.role] || '#f5f4f0',
                      color: roleColor[member.role] || '#6b6960',
                      borderRadius: 6, padding: '2px 8px',
                      textTransform: 'capitalize', flexShrink: 0,
                    }}>
                      {member.role}
                    </span>
                  )}
                  {canEdit && (
                    <button
                      onClick={() => handleRemove(member)}
                      disabled={isRemoving}
                      title="Remove from workspace"
                      style={{
                        width: 26, height: 26, borderRadius: 6, border: 'none',
                        background: 'transparent', cursor: isRemoving ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#c8c5be', flexShrink: 0, padding: 0,
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Invite — admin only ── */}
        {isAdmin && (
          <div>
            <p style={{ margin: '0 0 10px', fontSize: 10, fontWeight: 600, color: '#9b9890', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace' }}>
              Invite teammate
            </p>
            <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-2xl)', border: '0.5px solid var(--border)', padding: '16px 18px' }}>
              <form onSubmit={handleInvite} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  style={inputStyle}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['member', 'manager'] as const).map(r => (
                    <button
                      key={r} type="button" onClick={() => setInviteRole(r)}
                      style={{
                        flex: 1, padding: '9px 0', borderRadius: 10, fontSize: 13, fontWeight: 500,
                        border: inviteRole === r ? 'none' : '0.5px solid rgba(0,0,0,0.1)',
                        background: inviteRole === r ? roleBg[r] : 'transparent',
                        color: inviteRole === r ? roleColor[r] : '#6b6960',
                        cursor: 'pointer', textTransform: 'capitalize', fontFamily: 'inherit',
                      }}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <p style={{ margin: 0, fontSize: 12, color: '#9b9890', lineHeight: 1.5 }}>
                  {inviteRole === 'member'
                    ? 'Member — sees and manages their own deals, contacts and tasks.'
                    : 'Manager — sees all team data, can reassign deals and tasks.'}
                </p>
                {inviteError && (
                  <p style={{ margin: 0, fontSize: 13, color: '#E24B4A' }}>{inviteError}</p>
                )}
                {inviteSuccess && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#1D9E75' }} />
                    <p style={{ margin: 0, fontSize: 13, color: '#1D9E75' }}>Invite sent!</p>
                  </div>
                )}
                <button
                  type="submit"
                  disabled={inviting || !inviteEmail.trim()}
                  className="btn-chrome"
                  style={{
                    width: '100%', padding: 13, fontSize: 14, justifyContent: 'center',
                    opacity: inviting || !inviteEmail.trim() ? 0.45 : 1,
                    cursor: inviting || !inviteEmail.trim() ? 'not-allowed' : 'pointer',
                  }}
                >
                  {inviting ? 'Sending…' : `Send invite as ${inviteRole}`}
                </button>
              </form>
              <p style={{ margin: '10px 0 0', fontSize: 12, color: '#9b9890', lineHeight: 1.5 }}>
                They'll receive a magic link to join your workspace.
              </p>
            </div>
          </div>
        )}

        {/* ── Sign out ── */}
        <div>
          {!showSignOutConfirm ? (
            <button
              onClick={() => setShowSignOutConfirm(true)}
              style={{
                width: '100%', padding: 15, fontSize: 15, fontWeight: 500,
                color: '#E24B4A', background: 'var(--bg-card)',
                border: '0.5px solid rgba(226,75,74,0.2)',
                borderRadius: 'var(--radius-2xl)', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Sign out
            </button>
          ) : (
            <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-2xl)', border: '0.5px solid rgba(226,75,74,0.2)', padding: '16px 18px' }}>
              <p style={{ margin: '0 0 14px', fontSize: 14, color: '#1a1a18', textAlign: 'center' }}>
                Are you sure you want to sign out?
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setShowSignOutConfirm(false)}
                  style={{ flex: 1, padding: 13, fontSize: 14, fontWeight: 500, color: '#6b6960', background: '#f5f4f0', border: 'none', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSignOut}
                  style={{ flex: 1, padding: 13, fontSize: 14, fontWeight: 500, color: 'white', background: '#E24B4A', border: 'none', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>

        <p style={{ margin: '0 0 24px', fontSize: 12, color: '#c8c5be', textAlign: 'center' }}>
          rollable app
        </p>
      </div>
    </main>
  )
}

function Row({ label, value, last }: { label: string; value: React.ReactNode; last?: boolean }) {
  return (
    <div style={{
      padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      borderBottom: last ? 'none' : '0.5px solid rgba(0,0,0,0.05)',
    }}>
      <span style={{ fontSize: 14, color: '#6b6960' }}>{label}</span>
      {typeof value === 'string'
        ? <span style={{ fontSize: 14, fontWeight: 500, color: '#1a1a18' }}>{value}</span>
        : value}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 14px', fontSize: 15, color: '#1a1a18',
  background: '#f5f4f0', border: '0.5px solid rgba(0,0,0,0.08)',
  borderRadius: 12, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
}