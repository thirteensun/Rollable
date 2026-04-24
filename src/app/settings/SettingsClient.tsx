'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { STAGE_TEMPLATES, HOME_PRIORITY_OPTIONS, type HomePriority } from '@/lib/stage-templates'

interface Member {
  role: string
  status: string
  invited_email: string | null
  user_id: string | null
  users: { full_name: string | null; email: string | null } | null
}

interface OrgContext {
  industry?: string
  cycle_days?: number
  at_risk_days?: number
  team_size?: number
  stage_template?: string
  home_priority?: HomePriority
  pain_points?: string[]
}

interface Props {
  name: string
  email: string
  initials: string
  role: string
  orgName: string
  orgId: string
  orgContext: OrgContext
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

export default function SettingsClient({ name, email, initials, role, orgName, orgId, orgContext, members, plan, seats }: Props) {
  const router = useRouter()

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'manager' | 'member'>('member')
  const [inviting, setInviting] = useState(false)
  const [inviteSuccess, setInviteSuccess] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false)

  const [activeCustomTab, setActiveCustomTab] = useState<'profile' | 'pipeline' | 'ai' | 'preview'>('profile')
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Business Profile
  const [industry, setIndustry] = useState(orgContext.industry || '')
  const [teamSize, setTeamSize] = useState(orgContext.team_size?.toString() || '')
  const [homePriority, setHomePriority] = useState<HomePriority>(orgContext.home_priority || 'tasks')

  // Pipeline
  const [stageTemplate, setStageTemplate] = useState(orgContext.stage_template || 'other')
  const [atRiskDays, setAtRiskDays] = useState(orgContext.at_risk_days?.toString() || '14')
  const [cycleDays, setCycleDays] = useState(orgContext.cycle_days?.toString() || '')

  // AI
  const [painPoints, setPainPoints] = useState<string[]>(orgContext.pain_points || [])
  const [newPainPoint, setNewPainPoint] = useState('')

  const selectedTemplate = STAGE_TEMPLATES.find(t => t.key === stageTemplate) || STAGE_TEMPLATES.find(t => t.key === 'other')!

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    const activeMembers = members.filter(m => m.status === 'active').length
    if (activeMembers >= seats) {
      setInviteError(`Seat limit reached (${seats} seats on ${plan} plan). Upgrade to invite more.`)
      return
    }
    setInviting(true)
    setInviteError('')
    const supabase = createClient()
    try {
      const existing = members.find(m => m.invited_email === inviteEmail.trim() || m.users?.email === inviteEmail.trim())
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

  const saveContext = async () => {
    setSaving(true)
    const supabase = createClient()
    const context: OrgContext = {
      industry: industry.trim() || undefined,
      team_size: teamSize ? parseInt(teamSize) : undefined,
      home_priority: homePriority,
      stage_template: stageTemplate,
      at_risk_days: atRiskDays ? parseInt(atRiskDays) : 14,
      cycle_days: cycleDays ? parseInt(cycleDays) : undefined,
      pain_points: painPoints.filter(Boolean),
    }
    await supabase.from('organisations').update({ context }).eq('id', orgId)
    setSaving(false)
    setSaveSuccess(true)
    setTimeout(() => setSaveSuccess(false), 2500)
  }

  const addPainPoint = () => {
    if (!newPainPoint.trim()) return
    setPainPoints([...painPoints, newPainPoint.trim()])
    setNewPainPoint('')
  }
  const removePainPoint = (i: number) => setPainPoints(painPoints.filter((_, idx) => idx !== i))

  const planColor: Record<string, string> = { free: '#9b9890', pro: '#185FA5', business: '#854F0B' }

  const customTabs = [
    { id: 'profile' as const, label: 'Profile' },
    { id: 'pipeline' as const, label: 'Pipeline' },
    { id: 'ai' as const, label: 'AI' },
    { id: 'preview' as const, label: 'Preview' },
  ]

  return (
    <main style={{ background: '#f5f4f0', paddingBottom: 0 }}>

      {/* Header */}
      <div style={{ padding: '56px 24px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.back()} style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(0,0,0,0.07)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M10 4L6 8l4 4" stroke="#1a1a18" strokeWidth="1.3" strokeLinecap="round"/></svg>
        </button>
        <p style={{ margin: 0, fontSize: 20, fontWeight: 500, color: '#1a1a18' }}>Settings</p>
      </div>

      <div style={{ padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Profile card */}
        <div style={{ background: 'white', borderRadius: 18, border: '0.5px solid rgba(0,0,0,0.07)', padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#1a1a18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 500, color: 'white', flexShrink: 0 }}>{initials}</div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 500, color: '#1a1a18' }}>{name}</p>
              <p style={{ margin: '2px 0 0', fontSize: 13, color: '#9b9890' }}>{email}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 500, background: roleBg[role] || '#f5f4f0', color: roleColor[role] || '#6b6960', borderRadius: 6, padding: '2px 8px', textTransform: 'capitalize' }}>{role}</span>
                <span style={{ fontSize: 12, color: '#9b9890' }}>{orgName}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Workspace info */}
        <div>
          <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 500, color: '#9b9890', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Workspace</p>
          <div style={{ background: 'white', borderRadius: 18, border: '0.5px solid rgba(0,0,0,0.07)', overflow: 'hidden' }}>
            <Row label="Name" value={orgName} />
            <Row label="Plan" value={<span style={{ fontSize: 13, fontWeight: 500, color: planColor[plan] || '#9b9890', textTransform: 'capitalize' }}>{plan}</span>} />
            <Row label="Members" value={`${members.filter(m => m.status === 'active').length} / ${seats} seat${seats !== 1 ? 's' : ''}`} last />
          </div>
        </div>

        {/* ── Customisation panel — admin/manager only ── */}
        {(role === 'admin' || role === 'manager') && (
          <div>
            <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 500, color: '#9b9890', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Customise</p>
            <div style={{ background: 'white', borderRadius: 18, border: '0.5px solid rgba(0,0,0,0.07)', overflow: 'hidden' }}>

              {/* Tab bar */}
              <div style={{ display: 'flex', borderBottom: '0.5px solid rgba(0,0,0,0.07)', padding: '0 4px' }}>
                {customTabs.map(tab => (
                  <button key={tab.id} onClick={() => setActiveCustomTab(tab.id)} style={{
                    flex: 1, padding: '13px 0', fontSize: 13, fontWeight: 500,
                    color: activeCustomTab === tab.id ? '#1a1a18' : '#9b9890',
                    background: 'none', border: 'none', cursor: 'pointer',
                    borderBottom: activeCustomTab === tab.id ? '2px solid #1a1a18' : '2px solid transparent',
                    fontFamily: 'inherit', transition: 'color 0.15s',
                  }}>{tab.label}</button>
                ))}
              </div>

              <div style={{ padding: 18 }}>

                {/* ── Profile tab ── */}
                {activeCustomTab === 'profile' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <Field label="Industry">
                      <input value={industry} onChange={e => setIndustry(e.target.value)} placeholder="e.g. SaaS, Construction, Legal" style={inputStyle} />
                    </Field>

                    <Field label="Team size">
                      <input type="number" value={teamSize} onChange={e => setTeamSize(e.target.value)} placeholder="e.g. 5" style={{ ...inputStyle, width: 80 }} />
                    </Field>

                    <Field label="Home screen priority">
                      <p style={{ margin: '0 0 8px', fontSize: 12, color: '#9b9890' }}>What should your team see first when they open the app?</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {HOME_PRIORITY_OPTIONS.map(opt => (
                          <button key={opt.key} onClick={() => setHomePriority(opt.key)} style={{
                            display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                            borderRadius: 12, border: homePriority === opt.key ? '1.5px solid #1a1a18' : '0.5px solid rgba(0,0,0,0.1)',
                            background: homePriority === opt.key ? '#1a1a18' : 'transparent',
                            cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                          }}>
                            <div style={{ flex: 1 }}>
                              <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: homePriority === opt.key ? 'white' : '#1a1a18' }}>{opt.label}</p>
                              <p style={{ margin: '2px 0 0', fontSize: 12, color: homePriority === opt.key ? 'rgba(255,255,255,0.6)' : '#9b9890' }}>{opt.description}</p>
                            </div>
                            {homePriority === opt.key && (
                              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                <path d="M3 8l4 4 6-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </button>
                        ))}
                      </div>
                    </Field>
                  </div>
                )}

                {/* ── Pipeline tab ── */}
                {activeCustomTab === 'pipeline' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                    <Field label="Sales motion">
                      <p style={{ margin: '0 0 8px', fontSize: 12, color: '#9b9890' }}>Choose the template that best fits your sales process.</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {STAGE_TEMPLATES.map(t => {
                          const isSelected = stageTemplate === t.key
                          return (
                            <button key={t.key} onClick={() => setStageTemplate(t.key)} style={{
                              display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 14px',
                              borderRadius: 12, border: isSelected ? '1.5px solid #1a1a18' : '0.5px solid rgba(0,0,0,0.1)',
                              background: isSelected ? '#1a1a18' : 'transparent',
                              cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: 13, fontWeight: 500, color: isSelected ? 'white' : '#1a1a18' }}>{t.label}</span>
                                {isSelected && (
                                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                    <path d="M3 8l4 4 6-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                )}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                                {t.stages.map((s, i) => (
                                  <span key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <span style={{ fontSize: 11, color: isSelected ? 'rgba(255,255,255,0.7)' : '#6b6960' }}>{s.label}</span>
                                    {i < t.stages.length - 1 && <span style={{ fontSize: 10, color: isSelected ? 'rgba(255,255,255,0.4)' : '#c8c5be' }}>→</span>}
                                  </span>
                                ))}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </Field>

                    <Field label="At-risk threshold (days)">
                      <p style={{ margin: '0 0 8px', fontSize: 12, color: '#9b9890' }}>Deals with no activity beyond this are flagged.</p>
                      <input type="number" value={atRiskDays} onChange={e => setAtRiskDays(e.target.value)} placeholder="14" style={{ ...inputStyle, width: 80 }} />
                    </Field>

                    <Field label="Typical sales cycle (days)">
                      <input type="number" value={cycleDays} onChange={e => setCycleDays(e.target.value)} placeholder="e.g. 30" style={{ ...inputStyle, width: 80 }} />
                    </Field>
                  </div>
                )}

                {/* ── AI tab ── */}
                {activeCustomTab === 'ai' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ background: '#f5f4f0', borderRadius: 12, padding: '12px 14px' }}>
                      <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 500, color: '#1a1a18' }}>What the AI knows about your business</p>
                      <p style={{ margin: 0, fontSize: 12, color: '#6b6960', lineHeight: 1.5 }}>This context is injected into every agent — assistant, analytics, and nudges.</p>
                    </div>

                    <Field label="Pain points / focus areas">
                      <p style={{ margin: '0 0 8px', fontSize: 12, color: '#9b9890' }}>What should the AI keep an eye on?</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {painPoints.map((p, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ flex: 1, background: '#f5f4f0', borderRadius: 10, padding: '8px 12px', fontSize: 13, color: '#1a1a18' }}>{p}</div>
                            <button onClick={() => removePainPoint(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c8c5be', padding: 4 }}>
                              <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
                            </button>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <input value={newPainPoint} onChange={e => setNewPainPoint(e.target.value)} onKeyDown={e => e.key === 'Enter' && addPainPoint()} placeholder="e.g. deals stall after proposal" style={{ ...inputStyle, flex: 1, padding: '8px 12px', fontSize: 13 }} />
                        <button onClick={addPainPoint} disabled={!newPainPoint.trim()} style={{ padding: '8px 14px', background: '#1a1a18', color: 'white', border: 'none', borderRadius: 10, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', opacity: !newPainPoint.trim() ? 0.4 : 1 }}>Add</button>
                      </div>
                    </Field>

                    {/* Summary */}
                    <Field label="Current AI context">
                      <div style={{ background: '#f5f4f0', borderRadius: 10, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {[
                          { label: 'Industry', value: industry || '—' },
                          { label: 'Sales motion', value: selectedTemplate.label },
                          { label: 'Pipeline', value: selectedTemplate.stages.map(s => s.label).join(' → ') },
                          { label: 'Cycle', value: cycleDays ? `${cycleDays} days` : '—' },
                          { label: 'At-risk after', value: `${atRiskDays} days` },
                          { label: 'Home priority', value: HOME_PRIORITY_OPTIONS.find(o => o.key === homePriority)?.label || homePriority },
                        ].map(({ label, value }) => (
                          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                            <span style={{ fontSize: 12, color: '#6b6960' }}>{label}</span>
                            <span style={{ fontSize: 12, color: '#1a1a18', fontWeight: 500, textAlign: 'right' }}>{value}</span>
                          </div>
                        ))}
                      </div>
                    </Field>
                  </div>
                )}

                {/* ── Preview tab ── */}
                {activeCustomTab === 'preview' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <p style={{ margin: 0, fontSize: 13, color: '#6b6960' }}>How your pipeline and home screen will look.</p>

                    <Field label="Pipeline preview">
                      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
                        {[...selectedTemplate.stages, { key: 'closed_won', label: 'Won' }, { key: 'closed_lost', label: 'Lost' }].map((stage) => (
                          <div key={stage.key} style={{ flexShrink: 0, background: '#f5f4f0', borderRadius: 10, padding: '8px 12px', minWidth: 90, textAlign: 'center' }}>
                            <p style={{ margin: 0, fontSize: 11, fontWeight: 500, color: stage.key === 'closed_won' ? '#1D9E75' : stage.key === 'closed_lost' ? '#E24B4A' : '#1a1a18' }}>{stage.label}</p>
                            <p style={{ margin: '4px 0 0', fontSize: 11, color: '#9b9890' }}>0 deals</p>
                          </div>
                        ))}
                      </div>
                    </Field>

                    <Field label="Home screen priority">
                      <div style={{ background: '#f5f4f0', borderRadius: 12, padding: '12px 14px' }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: '#1a1a18' }}>
                          {HOME_PRIORITY_OPTIONS.find(o => o.key === homePriority)?.label}
                        </p>
                        <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b6960' }}>
                          {HOME_PRIORITY_OPTIONS.find(o => o.key === homePriority)?.description}
                        </p>
                      </div>
                    </Field>

                    <Field label="Sample nudge">
                      <div style={{ background: '#f5f4f0', borderRadius: 12, padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#EF9F27', flexShrink: 0 }} />
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: '#1a1a18' }}>Acme deal</p>
                        </div>
                        <p style={{ margin: 0, fontSize: 12, color: '#6b6960' }}>No activity in {atRiskDays} days — time to follow up?</p>
                      </div>
                    </Field>
                  </div>
                )}

                {/* Save button */}
                {activeCustomTab !== 'preview' && (
                  <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button onClick={saveContext} disabled={saving} style={{
                      flex: 1, padding: 13, fontSize: 15, fontWeight: 500, color: 'white',
                      background: saving ? '#9b9890' : '#1a1a18', border: 'none', borderRadius: 14,
                      cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'background 0.2s',
                    }}>
                      {saving ? 'Saving...' : 'Save changes'}
                    </button>
                    {saveSuccess && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#1D9E75' }} />
                        <span style={{ fontSize: 13, color: '#1D9E75' }}>Saved</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Team */}
        <div>
          <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 500, color: '#9b9890', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Team</p>
          <div style={{ background: 'white', borderRadius: 18, border: '0.5px solid rgba(0,0,0,0.07)', overflow: 'hidden' }}>
            {members.map((member, i) => {
              const memberName = member.users?.full_name || member.users?.email || member.invited_email || 'Unknown'
              const memberEmail = member.users?.email || member.invited_email || ''
              const memberInitials = memberName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
              const isPending = member.status === 'invited'
              return (
                <div key={i} style={{ padding: '13px 18px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: i < members.length - 1 ? '0.5px solid rgba(0,0,0,0.05)' : 'none' }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: isPending ? '#f5f4f0' : '#1a1a18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 500, color: isPending ? '#9b9890' : 'white', flexShrink: 0 }}>{memberInitials}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: isPending ? '#9b9890' : '#1a1a18' }}>{memberName}</p>
                    <p style={{ margin: '1px 0 0', fontSize: 12, color: '#9b9890' }}>{isPending ? 'Invite pending' : memberEmail}</p>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 500, background: roleBg[member.role] || '#f5f4f0', color: roleColor[member.role] || '#6b6960', borderRadius: 6, padding: '2px 8px', textTransform: 'capitalize', flexShrink: 0 }}>{member.role}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Invite */}
        {role === 'admin' && (
          <div>
            <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 500, color: '#9b9890', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Invite teammate</p>
            <div style={{ background: 'white', borderRadius: 18, border: '0.5px solid rgba(0,0,0,0.07)', padding: '16px 18px' }}>
              <form onSubmit={handleInvite} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="colleague@company.com" style={inputStyle} />
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['member', 'manager'] as const).map(r => (
                    <button key={r} type="button" onClick={() => setInviteRole(r)} style={{ flex: 1, padding: '9px 0', borderRadius: 10, fontSize: 13, fontWeight: 500, border: inviteRole === r ? 'none' : '0.5px solid rgba(0,0,0,0.1)', background: inviteRole === r ? roleBg[r] : 'transparent', color: inviteRole === r ? roleColor[r] : '#6b6960', cursor: 'pointer', textTransform: 'capitalize' }}>{r}</button>
                  ))}
                </div>
                <div style={{ fontSize: 12, color: '#9b9890', lineHeight: 1.5 }}>
                  {inviteRole === 'member' ? 'Member — sees and manages their own deals, contacts and tasks.' : 'Manager — sees all team data, can reassign deals and tasks.'}
                </div>
                {inviteError && <p style={{ margin: 0, fontSize: 13, color: '#E24B4A' }}>{inviteError}</p>}
                {inviteSuccess && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#1D9E75' }} />
                    <p style={{ margin: 0, fontSize: 13, color: '#1D9E75' }}>Invite sent!</p>
                  </div>
                )}
                <button type="submit" disabled={inviting || !inviteEmail.trim()} style={{ width: '100%', padding: 13, fontSize: 15, fontWeight: 500, color: 'white', background: inviting || !inviteEmail.trim() ? '#9b9890' : '#1a1a18', border: 'none', borderRadius: 14, cursor: inviting || !inviteEmail.trim() ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                  {inviting ? 'Sending...' : `Send invite as ${inviteRole}`}
                </button>
              </form>
              <p style={{ margin: '10px 0 0', fontSize: 12, color: '#9b9890', lineHeight: 1.5 }}>They'll receive a magic link to join your workspace.</p>
            </div>
          </div>
        )}

        {/* Sign out */}
        <div>
          {!showSignOutConfirm ? (
            <button onClick={() => setShowSignOutConfirm(true)} style={{ width: '100%', padding: 15, fontSize: 15, fontWeight: 500, color: '#E24B4A', background: 'white', border: '0.5px solid rgba(226,75,74,0.2)', borderRadius: 18, cursor: 'pointer', fontFamily: 'inherit' }}>Sign out</button>
          ) : (
            <div style={{ background: 'white', borderRadius: 18, border: '0.5px solid rgba(226,75,74,0.2)', padding: '16px 18px' }}>
              <p style={{ margin: '0 0 14px', fontSize: 14, color: '#1a1a18', textAlign: 'center' }}>Are you sure you want to sign out?</p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setShowSignOutConfirm(false)} style={{ flex: 1, padding: 13, fontSize: 14, fontWeight: 500, color: '#6b6960', background: '#f5f4f0', border: 'none', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                <button onClick={handleSignOut} style={{ flex: 1, padding: 13, fontSize: 14, fontWeight: 500, color: 'white', background: '#E24B4A', border: 'none', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Sign out</button>
              </div>
            </div>
          )}
        </div>

        <p style={{ margin: '0 0 24px', fontSize: 12, color: '#c8c5be', textAlign: 'center' }}>Rollable Prototype 001</p>
      </div>
    </main>
  )
}

function Row({ label, value, last }: { label: string; value: React.ReactNode; last?: boolean }) {
  return (
    <div style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: last ? 'none' : '0.5px solid rgba(0,0,0,0.05)' }}>
      <span style={{ fontSize: 14, color: '#6b6960' }}>{label}</span>
      {typeof value === 'string' ? <span style={{ fontSize: 14, fontWeight: 500, color: '#1a1a18' }}>{value}</span> : value}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 13, fontWeight: 500, color: '#6b6960' }}>{label}</label>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 14px', fontSize: 15, color: '#1a1a18',
  background: '#f5f4f0', border: '0.5px solid rgba(0,0,0,0.08)',
  borderRadius: 12, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
}