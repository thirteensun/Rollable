'use client'

import { useState } from 'react'

interface OrgMember {
  role: string
  status: string
  user_id: string
  users: { email: string; full_name: string }[] | null
}

interface Org {
  id: string
  name: string
  created_at: string
  subscriptions: { plan: string; seats: number }[] | null
  organisation_members: OrgMember[]
}

interface WaitlistEntry {
  id: string
  email: string
  status: 'pending' | 'approved'
  created_at: string
  approved_at: string | null
  approved_by_email: string | null
}

interface Cap {
  enabled: boolean
  limit: number
}

interface Props {
  orgs: Org[]
  waitlist: WaitlistEntry[]
  cap: Cap
}

type Tab = 'registrations' | 'waitlist' | 'settings'

const planColor: Record<string, string> = {
  free: '#9b9890',
  pro: '#185FA5',
  business: '#854F0B',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

export default function AdminClient({ orgs, waitlist, cap }: Props) {
  const [tab, setTab] = useState<Tab>('registrations')
  const [waitlistItems, setWaitlistItems] = useState(waitlist)
  const [capEnabled, setCapEnabled] = useState(cap.enabled)
  const [capLimit, setCapLimit] = useState(String(cap.limit))
  const [approving, setApproving] = useState<string | null>(null)
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsSaved, setSettingsSaved] = useState(false)

  const handleApprove = async (id: string) => {
    setApproving(id)
    try {
      const res = await fetch(`/api/admin/waitlist/${id}/approve`, { method: 'POST' })
      if (res.ok) {
        setWaitlistItems(prev =>
          prev.map(e => e.id === id ? { ...e, status: 'approved' as const, approved_at: new Date().toISOString() } : e)
        )
      }
    } finally {
      setApproving(null)
    }
  }

  const handleSaveSettings = async () => {
    setSavingSettings(true)
    setSettingsSaved(false)
    try {
      await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'registration_cap',
          value: { enabled: capEnabled, limit: Number(capLimit) || 200 },
        }),
      })
      setSettingsSaved(true)
      setTimeout(() => setSettingsSaved(false), 2000)
    } finally {
      setSavingSettings(false)
    }
  }

  const pendingCount = waitlistItems.filter(e => e.status === 'pending').length

  return (
    <main style={{ minHeight: '100dvh', background: '#f5f4f0', padding: '32px 24px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
          <div>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 56" height="24" style={{ marginBottom: '8px' }}>
              <text y="44" fontFamily="Inter, -apple-system, BlinkMacSystemFont, sans-serif" fontSize="40" letterSpacing="-1">
                <tspan fontWeight="700" fill="#1a1a18">Roll</tspan>
                <tspan fontWeight="300" fill="#9b9890">able</tspan>
              </text>
            </svg>
            <p style={{ margin: 0, fontSize: '13px', color: '#9b9890' }}>Admin</p>
          </div>
          <a href="/" style={{ fontSize: '13px', color: '#9b9890', textDecoration: 'none' }}>← Back to app</a>
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '28px' }}>
          {[
            { label: 'Registered', value: orgs.length },
            { label: 'Waitlist', value: waitlistItems.length },
            { label: 'Pending approval', value: pendingCount },
            { label: 'Cap', value: capEnabled ? `${orgs.length} / ${capLimit}` : 'Off' },
          ].map(stat => (
            <div key={stat.label} style={{
              flex: 1, background: 'white', borderRadius: '14px',
              border: '0.5px solid rgba(0,0,0,0.07)', padding: '16px',
            }}>
              <p style={{ margin: '0 0 4px', fontSize: '22px', fontWeight: 600, color: '#1a1a18' }}>{stat.value}</p>
              <p style={{ margin: 0, fontSize: '12px', color: '#9b9890' }}>{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: 'white', borderRadius: '12px', padding: '4px', border: '0.5px solid rgba(0,0,0,0.07)', width: 'fit-content' }}>
          {(['registrations', 'waitlist', 'settings'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '8px 16px', borderRadius: '9px', border: 'none',
              background: tab === t ? '#1a1a18' : 'transparent',
              color: tab === t ? 'white' : '#9b9890',
              fontSize: '13px', fontWeight: 500, cursor: 'pointer',
              fontFamily: 'inherit', position: 'relative',
            }}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
              {t === 'waitlist' && pendingCount > 0 && (
                <span style={{
                  position: 'absolute', top: '4px', right: '4px',
                  width: '6px', height: '6px', borderRadius: '50%',
                  background: '#E24B4A',
                }} />
              )}
            </button>
          ))}
        </div>

        {/* Registrations */}
        {tab === 'registrations' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {orgs.length === 0 && (
              <p style={{ color: '#9b9890', fontSize: '14px' }}>No registrations yet.</p>
            )}
            {orgs.map(org => {
              const adminMember = org.organisation_members?.find(m => m.role === 'admin' && m.status === 'active')
              const owner = adminMember?.users?.[0] ?? null
              const sub = Array.isArray(org.subscriptions) ? org.subscriptions[0] : org.subscriptions
              const plan = (sub as any)?.plan ?? 'free'
              const memberCount = org.organisation_members?.filter(m => m.status === 'active').length ?? 1

              return (
                <div key={org.id} style={{
                  background: 'white', borderRadius: '14px',
                  border: '0.5px solid rgba(0,0,0,0.07)', padding: '16px 18px',
                  display: 'flex', alignItems: 'center', gap: '14px',
                }}>
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '10px',
                    background: '#1a1a18', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: '13px', fontWeight: 600,
                    color: 'white', flexShrink: 0,
                  }}>
                    {org.name[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: '#1a1a18' }}>{org.name}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#9b9890', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {owner?.email ?? '—'}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                    <span style={{
                      fontSize: '11px', fontWeight: 500, padding: '3px 8px',
                      borderRadius: '6px', background: '#f5f4f0',
                      color: planColor[plan] ?? '#9b9890', textTransform: 'capitalize',
                    }}>
                      {plan}
                    </span>
                    <span style={{ fontSize: '12px', color: '#c8c5be' }}>
                      {memberCount} {memberCount === 1 ? 'member' : 'members'}
                    </span>
                    <span style={{ fontSize: '12px', color: '#c8c5be' }}>{formatDate(org.created_at)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Waitlist */}
        {tab === 'waitlist' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {waitlistItems.length === 0 && (
              <p style={{ color: '#9b9890', fontSize: '14px' }}>Waitlist is empty.</p>
            )}
            {waitlistItems.map(entry => (
              <div key={entry.id} style={{
                background: 'white', borderRadius: '14px',
                border: '0.5px solid rgba(0,0,0,0.07)', padding: '16px 18px',
                display: 'flex', alignItems: 'center', gap: '14px',
              }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '10px',
                  background: entry.status === 'approved' ? '#E1F5EE' : '#f5f4f0',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  {entry.status === 'approved' ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M20 6L9 17l-5-5" stroke="#1D9E75" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="9" stroke="#9b9890" strokeWidth="1.5" />
                      <path d="M12 7v5l3 3" stroke="#9b9890" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: '#1a1a18', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {entry.email}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#9b9890' }}>
                    {entry.status === 'approved' && entry.approved_at
                      ? `Approved ${formatDate(entry.approved_at)}`
                      : `Joined ${formatDate(entry.created_at)}`}
                  </p>
                </div>
                {entry.status === 'pending' && (
                  <button
                    onClick={() => handleApprove(entry.id)}
                    disabled={approving === entry.id}
                    style={{
                      padding: '8px 16px', borderRadius: '10px', border: 'none',
                      background: approving === entry.id ? '#9b9890' : '#1a1a18',
                      color: 'white', fontSize: '13px', fontWeight: 500,
                      cursor: approving === entry.id ? 'not-allowed' : 'pointer',
                      fontFamily: 'inherit', flexShrink: 0,
                    }}
                  >
                    {approving === entry.id ? 'Approving…' : 'Approve'}
                  </button>
                )}
                {entry.status === 'approved' && (
                  <span style={{ fontSize: '12px', color: '#1D9E75', fontWeight: 500, flexShrink: 0 }}>Approved</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Settings */}
        {tab === 'settings' && (
          <div style={{ background: 'white', borderRadius: '16px', border: '0.5px solid rgba(0,0,0,0.07)', padding: '24px' }}>
            <h2 style={{ margin: '0 0 24px', fontSize: '16px', fontWeight: 500, color: '#1a1a18' }}>Registration cap</h2>

            {/* Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: '#1a1a18' }}>Enable registration cap</p>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#9b9890' }}>
                  When on, new signups are blocked once the limit is reached and added to the waitlist.
                </p>
              </div>
              <button
                onClick={() => setCapEnabled(v => !v)}
                style={{
                  width: '44px', height: '26px', borderRadius: '13px', border: 'none',
                  background: capEnabled ? '#1a1a18' : '#d4d2cc',
                  cursor: 'pointer', position: 'relative', flexShrink: 0, transition: 'background 0.2s ease',
                }}
              >
                <span style={{
                  position: 'absolute', top: '3px',
                  left: capEnabled ? '21px' : '3px',
                  width: '20px', height: '20px', borderRadius: '50%',
                  background: 'white', transition: 'left 0.2s ease',
                }} />
              </button>
            </div>

            {/* Limit */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ fontSize: '13px', color: '#6b6960', display: 'block', marginBottom: '8px' }}>
                Max registrations
              </label>
              <input
                type="number"
                value={capLimit}
                onChange={e => setCapLimit(e.target.value)}
                disabled={!capEnabled}
                min={1}
                style={{
                  width: '120px', padding: '10px 14px',
                  fontSize: '15px', color: capEnabled ? '#1a1a18' : '#9b9890',
                  background: capEnabled ? 'white' : '#f5f4f0',
                  border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: '10px',
                  outline: 'none', fontFamily: 'inherit',
                }}
              />
              <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#9b9890' }}>
                Currently {orgs.length} registered. Change this and save — no redeploy needed.
              </p>
            </div>

            <button
              onClick={handleSaveSettings}
              disabled={savingSettings}
              style={{
                padding: '12px 24px', borderRadius: '12px', border: 'none',
                background: settingsSaved ? '#1D9E75' : savingSettings ? '#9b9890' : '#1a1a18',
                color: 'white', fontSize: '14px', fontWeight: 500,
                cursor: savingSettings ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', transition: 'background 0.2s ease',
              }}
            >
              {settingsSaved ? 'Saved' : savingSettings ? 'Saving…' : 'Save settings'}
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
