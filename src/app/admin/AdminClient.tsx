'use client'

import { useState } from 'react'

interface OrgMember {
  role: string
  status: string
  user_id: string
  user: { id: string; email: string; full_name: string | null } | null
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

interface UsageRow {
  org_id: string
  route: string
  model: string
  input_tokens: number
  output_tokens: number
  created_at: string
}

interface Announcement {
  id: string
  title: string
  body: string
  image_url: string | null
  link_url: string | null
  published: boolean
  published_at: string | null
  created_at: string
}

interface Props {
  orgs: Org[]
  waitlist: WaitlistEntry[]
  cap: Cap
  usage: UsageRow[]
  announcements: Announcement[]
}

type Tab = 'registrations' | 'waitlist' | 'usage' | 'settings' | 'announcements'

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

// Cost per million tokens
const PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-6':         { input: 3.00,  output: 15.00 },
  'claude-haiku-4-5-20251001': { input: 0.80,  output: 4.00  },
  'claude-opus-4-7':           { input: 15.00, output: 75.00 },
}
function calcCost(model: string, input: number, output: number) {
  const p = PRICING[model] ?? { input: 3.00, output: 15.00 }
  return (input / 1_000_000) * p.input + (output / 1_000_000) * p.output
}

export default function AdminClient({ orgs, waitlist, cap, usage, announcements: initialAnnouncements }: Props) {
  const [tab, setTab] = useState<Tab>('registrations')
  const [waitlistItems, setWaitlistItems] = useState(waitlist)
  const [capEnabled, setCapEnabled] = useState(cap.enabled)
  const [capLimit, setCapLimit] = useState(String(cap.limit))
  const [orgPlans, setOrgPlans] = useState<Record<string, string>>(() =>
    Object.fromEntries(orgs.map(o => {
      const sub = Array.isArray(o.subscriptions) ? o.subscriptions[0] : o.subscriptions
      return [o.id, (sub as any)?.plan ?? 'free']
    }))
  )
  const [savingPlan, setSavingPlan] = useState<string | null>(null)
  const [approving, setApproving] = useState<string | null>(null)
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsSaved, setSettingsSaved] = useState(false)

  // Announcements state
  const [announcements, setAnnouncements] = useState<Announcement[]>(initialAnnouncements)
  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [aForm, setAForm] = useState({ title: '', body: '', image_url: '', link_url: '', published: false })
  const [savingA, setSavingA] = useState(false)
  const [aError, setAError] = useState<string | null>(null)

  const handlePlanChange = async (orgId: string, newPlan: string) => {
    setOrgPlans(prev => ({ ...prev, [orgId]: newPlan }))
    setSavingPlan(orgId)
    try {
      await fetch(`/api/admin/org/${orgId}/plan`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: newPlan }),
      })
    } finally {
      setSavingPlan(null)
    }
  }

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
          {(['registrations', 'waitlist', 'usage', 'settings', 'announcements'] as Tab[]).map(t => (
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
              const owner = adminMember?.user ?? null
              const plan = orgPlans[org.id] ?? 'free'
              const memberCount = org.organisation_members?.filter(m => m.status === 'active').length ?? 1
              const isSaving = savingPlan === org.id

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
                    <div style={{ position: 'relative' }}>
                      <select
                        value={plan}
                        onChange={e => handlePlanChange(org.id, e.target.value)}
                        disabled={isSaving}
                        style={{
                          fontSize: '11px', fontWeight: 500, padding: '3px 20px 3px 8px',
                          borderRadius: '6px', background: '#f5f4f0', border: 'none',
                          color: planColor[plan] ?? '#9b9890', cursor: 'pointer',
                          appearance: 'none', fontFamily: 'inherit',
                          opacity: isSaving ? 0.5 : 1,
                        }}
                      >
                        <option value="free">free</option>
                        <option value="pro">pro</option>
                        <option value="business">business</option>
                      </select>
                      <svg style={{ position: 'absolute', right: '5px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="8" height="8" viewBox="0 0 10 10" fill="none">
                        <path d="M2 3.5l3 3 3-3" stroke={planColor[plan] ?? '#9b9890'} strokeWidth="1.3" strokeLinecap="round" />
                      </svg>
                    </div>
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

        {/* Usage */}
        {tab === 'usage' && (() => {
          // Aggregate by org
          const byOrg: Record<string, { input: number; output: number; calls: number; cost: number }> = {}
          for (const row of usage) {
            const key = row.org_id ?? 'unknown'
            if (!byOrg[key]) byOrg[key] = { input: 0, output: 0, calls: 0, cost: 0 }
            byOrg[key].input += row.input_tokens
            byOrg[key].output += row.output_tokens
            byOrg[key].calls += 1
            byOrg[key].cost += calcCost(row.model, row.input_tokens, row.output_tokens)
          }
          const orgMap = Object.fromEntries(orgs.map(o => [o.id, o.name]))
          const rows = Object.entries(byOrg).sort((a, b) => b[1].cost - a[1].cost)
          const totalCost = rows.reduce((s, [, v]) => s + v.cost, 0)
          const totalCalls = rows.reduce((s, [, v]) => s + v.calls, 0)

          return (
            <div>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                {[
                  { label: 'Total API calls', value: totalCalls },
                  { label: 'Est. total cost', value: `$${totalCost.toFixed(4)}` },
                ].map(s => (
                  <div key={s.label} style={{ background: 'white', borderRadius: '14px', border: '0.5px solid rgba(0,0,0,0.07)', padding: '16px 20px' }}>
                    <p style={{ margin: '0 0 4px', fontSize: '22px', fontWeight: 600, color: '#1a1a18' }}>{s.value}</p>
                    <p style={{ margin: 0, fontSize: '12px', color: '#9b9890' }}>{s.label}</p>
                  </div>
                ))}
              </div>

              {rows.length === 0 && (
                <p style={{ color: '#9b9890', fontSize: '14px' }}>No usage recorded yet. Use the AI assistant or sandbox to generate data.</p>
              )}

              <div style={{ background: 'white', borderRadius: '14px', border: '0.5px solid rgba(0,0,0,0.07)', overflow: 'hidden' }}>
                {rows.map(([orgId, stats], i) => (
                  <div key={orgId} style={{
                    padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '14px',
                    borderTop: i === 0 ? 'none' : '0.5px solid rgba(0,0,0,0.06)',
                  }}>
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '9px', background: '#1a1a18',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '12px', fontWeight: 600, color: 'white', flexShrink: 0,
                    }}>
                      {(orgMap[orgId] ?? '?')[0]?.toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: '#1a1a18' }}>
                        {orgMap[orgId] ?? orgId}
                      </p>
                      <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#9b9890' }}>
                        {stats.calls} {stats.calls === 1 ? 'call' : 'calls'} · {(stats.input + stats.output).toLocaleString()} tokens
                      </p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: '#1a1a18' }}>
                        ${stats.cost.toFixed(4)}
                      </p>
                      <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#c8c5be' }}>
                        {stats.input.toLocaleString()} in · {stats.output.toLocaleString()} out
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })()}

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
        {/* Announcements */}
        {tab === 'announcements' && (
          <div>
            {/* New button */}
            {editingId === null && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                <button
                  onClick={() => { setAForm({ title: '', body: '', image_url: '', link_url: '', published: false }); setEditingId('new') }}
                  style={{ padding: '10px 20px', borderRadius: 12, border: 'none', background: '#1a1a18', color: 'white', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  + New announcement
                </button>
              </div>
            )}

            {/* Form */}
            {editingId !== null && (
              <div style={{ background: 'white', borderRadius: 16, border: '0.5px solid rgba(0,0,0,0.07)', padding: 24, marginBottom: 16 }}>
                <h3 style={{ margin: '0 0 20px', fontSize: 15, fontWeight: 500, color: '#1a1a18' }}>
                  {editingId === 'new' ? 'New announcement' : 'Edit announcement'}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 12, color: '#6b6960', display: 'block', marginBottom: 6 }}>Title</label>
                    <input
                      value={aForm.title}
                      onChange={e => setAForm(f => ({ ...f, title: e.target.value }))}
                      placeholder="Introducing..."
                      style={{ width: '100%', padding: '10px 14px', fontSize: 14, border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: 10, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: '#6b6960', display: 'block', marginBottom: 6 }}>Body</label>
                    <textarea
                      value={aForm.body}
                      onChange={e => setAForm(f => ({ ...f, body: e.target.value }))}
                      placeholder="Describe the new feature..."
                      rows={4}
                      style={{ width: '100%', padding: '10px 14px', fontSize: 14, border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: 10, outline: 'none', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: '#6b6960', display: 'block', marginBottom: 6 }}>Image URL <span style={{ color: '#c8c5be' }}>(optional)</span></label>
                    <input
                      value={aForm.image_url}
                      onChange={e => setAForm(f => ({ ...f, image_url: e.target.value }))}
                      placeholder="https://..."
                      style={{ width: '100%', padding: '10px 14px', fontSize: 14, border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: 10, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: '#6b6960', display: 'block', marginBottom: 6 }}>Link URL <span style={{ color: '#c8c5be' }}>(optional — where clicking takes the user)</span></label>
                    <input
                      value={aForm.link_url}
                      onChange={e => setAForm(f => ({ ...f, link_url: e.target.value }))}
                      placeholder="/capture or https://..."
                      style={{ width: '100%', padding: '10px 14px', fontSize: 14, border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: 10, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button
                      onClick={() => setAForm(f => ({ ...f, published: !f.published }))}
                      style={{
                        width: 40, height: 24, borderRadius: 12, border: 'none',
                        background: aForm.published ? '#1a1a18' : '#d4d2cc',
                        cursor: 'pointer', position: 'relative', flexShrink: 0, transition: 'background 0.2s',
                      }}
                    >
                      <span style={{ position: 'absolute', top: 2, left: aForm.published ? 18 : 2, width: 20, height: 20, borderRadius: '50%', background: 'white', transition: 'left 0.2s' }} />
                    </button>
                    <span style={{ fontSize: 13, color: '#6b6960' }}>Publish immediately</span>
                  </div>
                </div>
                {aError && (
                  <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(226,75,74,0.08)', border: '0.5px solid rgba(226,75,74,0.2)', marginTop: 16 }}>
                    <p style={{ margin: 0, fontSize: 13, color: '#E24B4A' }}>{aError}</p>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                  <button
                    disabled={savingA || !aForm.title.trim() || !aForm.body.trim()}
                    onClick={async () => {
                      setSavingA(true)
                      setAError(null)
                      try {
                        if (editingId === 'new') {
                          const res = await fetch('/api/admin/announcements', {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(aForm),
                          })
                          const data = await res.json()
                          if (!res.ok) { setAError(data.error ?? 'Failed to create announcement'); return }
                          setAnnouncements(prev => [data, ...prev])
                        } else {
                          const res = await fetch(`/api/admin/announcements/${editingId}`, {
                            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(aForm),
                          })
                          const data = await res.json()
                          if (!res.ok) { setAError(data.error ?? 'Failed to save announcement'); return }
                          setAnnouncements(prev => prev.map(a => a.id === editingId ? data : a))
                        }
                        setEditingId(null)
                      } catch (e) {
                        setAError('Network error — check your connection')
                      } finally {
                        setSavingA(false)
                      }
                    }}
                    style={{
                      padding: '10px 20px', borderRadius: 10, border: 'none',
                      background: savingA ? '#9b9890' : '#1a1a18', color: 'white',
                      fontSize: 13, fontWeight: 500, cursor: savingA ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    {savingA ? 'Saving…' : editingId === 'new' ? 'Create' : 'Save'}
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    style={{ padding: '10px 20px', borderRadius: 10, border: '0.5px solid rgba(0,0,0,0.1)', background: 'transparent', color: '#6b6960', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {announcements.length === 0 && (
                <p style={{ color: '#9b9890', fontSize: 14 }}>No announcements yet.</p>
              )}
              {announcements.map(a => (
                <div key={a.id} style={{
                  background: 'white', borderRadius: 14, border: '0.5px solid rgba(0,0,0,0.07)',
                  padding: '16px 18px', display: 'flex', alignItems: 'flex-start', gap: 14,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: '#1a1a18' }}>{a.title}</span>
                      <span style={{
                        fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase',
                        padding: '2px 6px', borderRadius: 4,
                        background: a.published ? 'rgba(29,158,117,0.1)' : 'rgba(0,0,0,0.05)',
                        color: a.published ? '#1D9E75' : '#9b9890',
                      }}>
                        {a.published ? 'Published' : 'Draft'}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: 13, color: '#9b9890', lineHeight: 1.4 }}>{a.body}</p>
                    <p style={{ margin: '6px 0 0', fontSize: 11, color: '#c8c5be' }}>{formatDate(a.created_at)}</p>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    {/* Publish toggle */}
                    <button
                      onClick={async () => {
                        const updated = await fetch(`/api/admin/announcements/${a.id}`, {
                          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ published: !a.published }),
                        }).then(r => r.json())
                        setAnnouncements(prev => prev.map(x => x.id === a.id ? updated : x))
                      }}
                      style={{
                        padding: '6px 12px', borderRadius: 8, border: '0.5px solid rgba(0,0,0,0.1)',
                        background: 'transparent', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                        color: a.published ? '#E24B4A' : '#1D9E75',
                      }}
                    >
                      {a.published ? 'Unpublish' : 'Publish'}
                    </button>
                    {/* Edit */}
                    <button
                      onClick={() => {
                        setAForm({ title: a.title, body: a.body, image_url: a.image_url ?? '', link_url: a.link_url ?? '', published: a.published })
                        setEditingId(a.id)
                      }}
                      style={{ padding: '6px 12px', borderRadius: 8, border: '0.5px solid rgba(0,0,0,0.1)', background: 'transparent', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', color: '#6b6960' }}
                    >
                      Edit
                    </button>
                    {/* Delete */}
                    <button
                      onClick={async () => {
                        if (!confirm('Delete this announcement?')) return
                        await fetch(`/api/admin/announcements/${a.id}`, { method: 'DELETE' })
                        setAnnouncements(prev => prev.filter(x => x.id !== a.id))
                      }}
                      style={{ padding: '6px 12px', borderRadius: 8, border: '0.5px solid rgba(0,0,0,0.1)', background: 'transparent', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', color: '#E24B4A' }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </main>
  )
}
