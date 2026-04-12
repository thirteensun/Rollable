'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createBrowserSupabaseClient } from '@/lib/supabase'

const STAGES = ['lead', 'qualified', 'demo', 'proposal', 'negotiation', 'closed_won', 'closed_lost']
const STAGE_LABELS: Record<string, string> = {
  lead: 'Lead', qualified: 'Qualified', demo: 'Demo',
  proposal: 'Proposal', negotiation: 'Negotiation',
  closed_won: 'Won', closed_lost: 'Lost',
}

const PAYMENT_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  none:     { bg: 'rgba(239,159,39,0.1)',  text: '#EF9F27', label: 'Not invoiced' },
  invoiced: { bg: 'rgba(59,130,246,0.1)',  text: '#3b82f6', label: 'Invoiced' },
  paid:     { bg: 'rgba(29,158,117,0.1)',  text: '#1D9E75', label: 'Paid' },
}

const PRIORITY_COLOR: Record<string, string> = {
  high: '#E24B4A', medium: '#EF9F27', low: '#9b9890',
}

function formatCurrency(val?: number | null) {
  if (val == null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val)
}

function formatDate(val?: string | null) {
  if (!val) return '—'
  return new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function timeAgo(val: string) {
  const diff = Date.now() - new Date(val).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export default function DealDetailClient({ deal, events, tasks }: { deal: any; events: any[]; tasks: any[] }) {
  const router = useRouter()
  const supabase = createBrowserSupabaseClient()

  const [stage, setStage] = useState(deal.stage)
  const [paymentStatus, setPaymentStatus] = useState(deal.payment_status ?? 'none')
  const [invoiceRef, setInvoiceRef] = useState(deal.invoice_ref ?? '')
  const [poRef, setPoRef] = useState(deal.po_ref ?? '')
  const [invoiceDate, setInvoiceDate] = useState(deal.invoice_date ?? '')
  const [poDate, setPoDate] = useState(deal.po_date ?? '')
  const [confirmedRevenue, setConfirmedRevenue] = useState(
    deal.confirmed_revenue != null ? String(deal.confirmed_revenue) : ''
  )
  const [saving, setSaving] = useState(false)
  const [editingFinancials, setEditingFinancials] = useState(false)
  const [saved, setSaved] = useState(false)

  const contacts = deal.deal_contacts?.map((dc: any) => dc.contacts).filter(Boolean) ?? []
  const payment = PAYMENT_COLORS[paymentStatus] ?? PAYMENT_COLORS.none
  const stageIndex = STAGES.indexOf(stage)
  const isLost = stage === 'closed_lost'

  // Merge events + tasks into one timeline sorted by date
  const timeline = [
    ...events.map(e => ({ ...e, _type: 'event' as const })),
    ...tasks.map(t => ({ ...t, _type: 'task' as const })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  async function updateStage(newStage: string) {
    setStage(newStage)
    await supabase.from('deals').update({ stage: newStage }).eq('id', deal.id)
  }

  async function saveFinancials() {
    setSaving(true)
    await supabase.from('deals').update({
      payment_status: paymentStatus,
      invoice_ref: invoiceRef || null,
      po_ref: poRef || null,
      invoice_date: invoiceDate || null,
      po_date: poDate || null,
      confirmed_revenue: confirmedRevenue ? parseFloat(confirmedRevenue) : null,
    }).eq('id', deal.id)
    setSaving(false)
    setEditingFinancials(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div style={{ background: '#f5f4f0', minHeight: '100dvh', paddingBottom: 100 }}>

      <div style={{ padding: '56px 20px 12px' }}>
        <button onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#9b9890', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          Back
        </button>
      </div>

      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Header */}
        <div style={{ background: 'white', borderRadius: 16, border: '0.5px solid rgba(0,0,0,0.07)', padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
            <h1 style={{ fontSize: 20, fontWeight: 600, color: '#1a1a18', margin: 0, flex: 1, paddingRight: 12 }}>{deal.name}</h1>
            <div style={{ padding: '4px 10px', borderRadius: 20, flexShrink: 0, background: payment.bg, color: payment.text, fontSize: 12, fontWeight: 500 }}>
              {payment.label}
            </div>
          </div>
          {deal.companies?.name && <p style={{ fontSize: 13, color: '#9b9890', margin: '0 0 14px' }}>{deal.companies.name}</p>}
          <div style={{ display: 'flex', gap: 20 }}>
            <div>
              <p style={{ fontSize: 11, color: '#9b9890', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Expected</p>
              <p style={{ fontSize: 20, fontWeight: 600, color: '#1a1a18', margin: 0 }}>{formatCurrency(deal.value)}</p>
            </div>
            {deal.confirmed_revenue != null && (
              <div>
                <p style={{ fontSize: 11, color: '#9b9890', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Confirmed</p>
                <p style={{ fontSize: 20, fontWeight: 600, color: '#1D9E75', margin: 0 }}>{formatCurrency(deal.confirmed_revenue)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Stage */}
        <div style={{ background: 'white', borderRadius: 16, border: '0.5px solid rgba(0,0,0,0.07)', padding: 16 }}>
          <p style={{ fontSize: 11, color: '#9b9890', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Stage</p>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {STAGES.filter(s => s !== 'closed_lost').map((s, i) => {
              const isActive = s === stage
              const isPast = !isLost && i < stageIndex
              return (
                <button key={s} onClick={() => updateStage(s)} style={{
                  padding: '6px 11px', borderRadius: 20, fontSize: 12,
                  fontWeight: isActive ? 600 : 400,
                  border: isActive ? 'none' : '0.5px solid rgba(0,0,0,0.1)',
                  background: isActive ? '#1a1a18' : isPast ? 'rgba(29,158,117,0.08)' : 'transparent',
                  color: isActive ? 'white' : isPast ? '#1D9E75' : '#6b6960',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}>{STAGE_LABELS[s]}</button>
              )
            })}
            <button onClick={() => updateStage('closed_lost')} style={{
              padding: '6px 11px', borderRadius: 20, fontSize: 12,
              fontWeight: isLost ? 600 : 400,
              border: isLost ? 'none' : '0.5px solid rgba(0,0,0,0.1)',
              background: isLost ? '#E24B4A' : 'transparent',
              color: isLost ? 'white' : '#E24B4A', cursor: 'pointer',
            }}>Lost</button>
          </div>
        </div>

        {/* Invoice & PO */}
        <div style={{ background: 'white', borderRadius: 16, border: '0.5px solid rgba(0,0,0,0.07)', padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <p style={{ fontSize: 11, color: '#9b9890', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Invoice & PO</p>
            <button onClick={() => setEditingFinancials(e => !e)} style={{ fontSize: 13, color: '#1a1a18', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>
              {editingFinancials ? 'Cancel' : 'Edit'}
            </button>
          </div>
          {editingFinancials ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['none', 'invoiced', 'paid'] as const).map(s => (
                  <button key={s} onClick={() => setPaymentStatus(s)} style={{
                    flex: 1, padding: '8px 0', borderRadius: 10, fontSize: 12, fontWeight: 500,
                    border: paymentStatus === s ? 'none' : '0.5px solid rgba(0,0,0,0.1)',
                    background: paymentStatus === s ? PAYMENT_COLORS[s].bg : 'transparent',
                    color: paymentStatus === s ? PAYMENT_COLORS[s].text : '#6b6960', cursor: 'pointer',
                  }}>{PAYMENT_COLORS[s].label}</button>
                ))}
              </div>
              <input placeholder="Invoice ref" value={invoiceRef} onChange={e => setInvoiceRef(e.target.value)} style={inputStyle} />
              <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} style={inputStyle} />
              <input placeholder="PO ref" value={poRef} onChange={e => setPoRef(e.target.value)} style={inputStyle} />
              <input type="date" value={poDate} onChange={e => setPoDate(e.target.value)} style={inputStyle} />
              <input type="number" placeholder="Confirmed revenue" value={confirmedRevenue} onChange={e => setConfirmedRevenue(e.target.value)} style={inputStyle} />
              <button onClick={saveFinancials} disabled={saving} style={{ marginTop: 4, padding: 12, borderRadius: 20, background: '#1a1a18', color: 'white', fontWeight: 600, fontSize: 14, border: 'none', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <FinancialRow label="Invoice ref" value={invoiceRef || '—'} />
              <FinancialRow label="Invoice date" value={formatDate(invoiceDate)} />
              <FinancialRow label="PO ref" value={poRef || '—'} />
              <FinancialRow label="PO date" value={formatDate(poDate)} />
              <FinancialRow label="Confirmed revenue" value={formatCurrency(confirmedRevenue ? parseFloat(confirmedRevenue) : null)} highlight={!!confirmedRevenue} />
              {saved && <p style={{ fontSize: 12, color: '#1D9E75', textAlign: 'center' }}>Saved ✓</p>}
            </div>
          )}
        </div>

        {/* Contacts */}
        {contacts.length > 0 && (
          <div style={{ background: 'white', borderRadius: 16, border: '0.5px solid rgba(0,0,0,0.07)', padding: 16 }}>
            <p style={{ fontSize: 11, color: '#9b9890', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Contacts</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {contacts.map((c: any) => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#f5f4f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, color: '#1a1a18', flexShrink: 0 }}>
                    {getInitials(c.full_name ?? '')}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 500, color: '#1a1a18', margin: 0 }}>{c.full_name}</p>
                    {c.role && <p style={{ fontSize: 12, color: '#6b6960', margin: 0 }}>{c.role}</p>}
                  </div>
                  {c.email && <a href={`mailto:${c.email}`} style={{ color: '#6b6960' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 7 10 7 10-7"/></svg></a>}
                  {c.phone && <a href={`tel:${c.phone}`} style={{ color: '#6b6960' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3-8.59A2 2 0 0 1 3.62 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6 6l.92-.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg></a>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Merged Activity + Tasks timeline */}
        <div style={{ background: 'white', borderRadius: 16, border: '0.5px solid rgba(0,0,0,0.07)', padding: 16 }}>
          <p style={{ fontSize: 11, color: '#9b9890', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Activity & Tasks</p>
          {timeline.length === 0 ? (
            <p style={{ fontSize: 14, color: '#9b9890', textAlign: 'center', padding: '12px 0' }}>No activity yet</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {timeline.map((item, i) => (
                <div key={item.id} style={{ display: 'flex', gap: 12, paddingBottom: i < timeline.length - 1 ? 14 : 0 }}>
                  {/* Timeline dot */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%', marginTop: 4, flexShrink: 0,
                      background: item._type === 'task'
                        ? (item.done ? '#1D9E75' : item.priority ? PRIORITY_COLOR[item.priority] : '#EF9F27')
                        : '#1a1a18',
                    }} />
                    {i < timeline.length - 1 && <div style={{ width: 1, flex: 1, background: 'rgba(0,0,0,0.07)', marginTop: 4 }} />}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, paddingBottom: i < timeline.length - 1 ? 4 : 0 }}>
                    {item._type === 'task' ? (
                      <Link href={`/tasks/${item.id}`} style={{ textDecoration: 'none' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                          <div style={{
                            width: 12, height: 12, borderRadius: 3, flexShrink: 0,
                            border: item.done ? 'none' : '1.5px solid rgba(0,0,0,0.2)',
                            background: item.done ? '#1D9E75' : 'white',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            {item.done && <svg width="7" height="7" viewBox="0 0 8 8" fill="none"><path d="M1.5 4L3 5.5L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>}
                          </div>
                          <p style={{ fontSize: 13, color: item.done ? '#9b9890' : '#1a1a18', margin: 0, textDecoration: item.done ? 'line-through' : 'none' }}>
                            {item.title ?? 'Task'}
                          </p>
                          {item.priority && !item.done && (
                            <span style={{ fontSize: 10, fontWeight: 500, padding: '1px 6px', borderRadius: 4, background: `${PRIORITY_COLOR[item.priority]}18`, color: PRIORITY_COLOR[item.priority] }}>
                              {item.priority}
                            </span>
                          )}
                        </div>
                        <p style={{ fontSize: 11, color: '#9b9890', margin: 0 }}>
                          Task · {item.due_date ? `Due ${new Date(item.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : timeAgo(item.created_at)}
                        </p>
                      </Link>
                    ) : (
                      <>
                        <p style={{ fontSize: 13, color: '#1a1a18', margin: '0 0 2px' }}>
                          {item.metadata?.summary ?? item.summary ?? item.type ?? 'Event'}
                        </p>
                        <p style={{ fontSize: 11, color: '#9b9890', margin: 0 }}>{timeAgo(item.created_at)}</p>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

function FinancialRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 13, color: '#6b6960' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: highlight ? '#1D9E75' : '#1a1a18' }}>{value}</span>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 10,
  border: '0.5px solid rgba(0,0,0,0.12)', fontSize: 14,
  color: '#1a1a18', background: '#f5f4f0', outline: 'none',
  boxSizing: 'border-box',
}