'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import BottomNav from '@/components/layout/BottomNav'

type Step = 'choose' | 'processing' | 'confirm'

interface AIResult {
  summary: string
  contact_name?: string
  company_name?: string
  deal_name?: string
  deal_value?: number
  follow_up_date?: string
  notes?: string
  event_type: string
  creates: { label: string; type: 'contact' | 'deal' | 'task' | 'note' }[]
}

const pillColors: Record<string, { bg: string; color: string }> = {
  contact: { bg: '#E6F1FB', color: '#185FA5' },
  deal: { bg: '#E1F5EE', color: '#0F6E56' },
  task: { bg: '#FAEEDA', color: '#854F0B' },
  note: { bg: '#EEEDFE', color: '#534AB7' },
}

export default function CapturePage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('choose')
  const [aiResult, setAiResult] = useState<AIResult | null>(null)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const processWithGemini = async (base64Image: string, mimeType: string) => {
    const response = await fetch('/api/capture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64Image, mimeType }),
    })
    if (!response.ok) throw new Error('AI processing failed')
    return response.json()
  }

  const handleImageSelect = async (file: File) => {
    setStep('processing')
    try {
      const reader = new FileReader()
      reader.onload = async (e) => {
        const base64 = (e.target?.result as string).split(',')[1]
        const result = await processWithGemini(base64, file.type)
        setAiResult(result)
        setStep('confirm')
      }
      reader.readAsDataURL(file)
    } catch (err) {
      console.error(err)
      setStep('choose')
      alert('Something went wrong. Please try again.')
    }
  }

  const handleSave = async () => {
    if (!aiResult) return
    setSaving(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    try {
      // 1. Create or find company
      let company_id = null
      if (aiResult.company_name) {
        const { data: existing } = await supabase
          .from('companies')
          .select('id')
          .eq('user_id', user.id)
          .ilike('name', aiResult.company_name)
          .maybeSingle()

        if (existing) {
          company_id = existing.id
        } else {
          const { data: newCompany } = await supabase
            .from('companies')
            .insert({ user_id: user.id, name: aiResult.company_name })
            .select('id')
            .maybeSingle()
          company_id = newCompany?.id
        }
      }

      // 2. Create or find contact
      let contact_id = null
      if (aiResult.contact_name) {
        const { data: existing } = await supabase
          .from('contacts')
          .select('id')
          .eq('user_id', user.id)
          .ilike('full_name', aiResult.contact_name)
          .maybeSingle()

        if (existing) {
          contact_id = existing.id
          await supabase.from('contacts').update({ last_contacted_at: new Date().toISOString(), company_id: company_id || undefined }).eq('id', contact_id)
        } else {
          const { data: newContact } = await supabase
            .from('contacts')
            .insert({ user_id: user.id, full_name: aiResult.contact_name, company_id, last_contacted_at: new Date().toISOString() })
            .select('id')
            .maybeSingle()
          contact_id = newContact?.id
        }
      }

      // 3. Create or find deal
      let deal_id = null
      if (aiResult.deal_name) {
        const { data: newDeal } = await supabase
          .from('deals')
          .insert({
            user_id: user.id,
            company_id,
            name: aiResult.deal_name,
            value: aiResult.deal_value || null,
            stage: 'lead',
            last_activity_at: new Date().toISOString(),
          })
          .select('id')
          .maybeSingle()
        deal_id = newDeal?.id

        if (deal_id && contact_id) {
          await supabase.from('deal_contacts').upsert({ deal_id, contact_id }, { onConflict: 'deal_id,contact_id' })
        }
      }

      // 4. Log the event
      await supabase.from('events').insert({
        user_id: user.id,
        deal_id,
        contact_id,
        company_id,
        type: aiResult.event_type || 'meeting',
        summary: aiResult.summary,
        ai_confidence: 0.9,
        metadata: { raw_ai_result: aiResult },
      })

      // 5. Create follow-up task if AI suggested one
      if (aiResult.follow_up_date) {
        await supabase.from('tasks').insert({
          user_id: user.id,
          deal_id,
          contact_id,
          title: `Follow up with ${aiResult.contact_name || aiResult.company_name || 'contact'}`,
          due_date: new Date(aiResult.follow_up_date).toISOString(),
          ai_generated: true,
        })
      }

      router.push('/')
      router.refresh()
    } catch (err) {
      console.error(err)
      alert('Failed to save. Please try again.')
      setSaving(false)
    }
  }

  return (
    <main style={{ minHeight: '100dvh', background: '#f5f4f0', paddingBottom: '100px' }}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={e => { if (e.target.files?.[0]) handleImageSelect(e.target.files[0]) }}
      />

      {/* Header */}
      <div style={{ padding: '56px 24px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        {step !== 'choose' && (
          <button onClick={() => setStep('choose')} style={{
            width: '32px', height: '32px', borderRadius: '50%',
            background: 'rgba(0,0,0,0.07)', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M10 4L6 8l4 4" stroke="#1a1a18" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          </button>
        )}
        <p style={{ margin: 0, fontSize: '20px', fontWeight: 500, color: '#1a1a18' }}>
          {step === 'choose' ? 'What happened?' : step === 'processing' ? 'Reading...' : 'Review capture'}
        </p>
      </div>

      {/* Choose */}
      {step === 'choose' && (
        <div style={{ padding: '0 24px' }} className="animate-fade-in-up">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
            <button onClick={() => fileInputRef.current?.click()} style={{
              background: '#1a1a18', borderRadius: '18px', padding: '20px',
              display: 'flex', alignItems: 'center', gap: '16px',
              border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%',
            }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="5" width="18" height="15" rx="2" stroke="white" strokeWidth="1.5" />
                  <circle cx="12" cy="12" r="3" stroke="white" strokeWidth="1.5" />
                  <circle cx="17.5" cy="7.5" r="1" fill="white" />
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: '15px', fontWeight: 500, color: 'white' }}>Image or screenshot</p>
                <p style={{ margin: '3px 0 0', fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>Photo, WhatsApp, email, business card, notes</p>
              </div>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M6 4l4 4-4 4" stroke="rgba(255,255,255,0.4)" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </button>

            <button onClick={() => alert('Voice memo coming soon!')} style={{
              background: 'white', borderRadius: '18px',
              border: '0.5px solid rgba(0,0,0,0.07)', padding: '20px',
              display: 'flex', alignItems: 'center', gap: '16px',
              cursor: 'pointer', textAlign: 'left', width: '100%',
            }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: '#f5f4f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <rect x="9" y="2" width="6" height="12" rx="3" stroke="#1a1a18" strokeWidth="1.5" />
                  <path d="M5 10a7 7 0 0 0 14 0" stroke="#1a1a18" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M12 17v4M9 21h6" stroke="#1a1a18" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: '15px', fontWeight: 500, color: '#1a1a18' }}>Voice memo</p>
                <p style={{ margin: '3px 0 0', fontSize: '13px', color: '#9b9890' }}>Coming soon</p>
              </div>
            </button>
          </div>

          <p style={{ margin: '0 0 12px', fontSize: '12px', fontWeight: 500, color: '#9b9890', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Or pick from library
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
            {[
              { label: 'Screenshot' }, { label: 'Email' },
              { label: 'Chat thread' }, { label: 'Business card' },
            ].map((item) => (
              <button key={item.label} onClick={() => fileInputRef.current?.click()} style={{
                background: 'white', borderRadius: '14px',
                border: '0.5px solid rgba(0,0,0,0.07)', padding: '14px',
                display: 'flex', alignItems: 'center', gap: '10px',
                cursor: 'pointer', width: '100%', fontSize: '13px', color: '#1a1a18',
                fontFamily: 'inherit',
              }}>
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Processing */}
      {step === 'processing' && (
        <div style={{ padding: '40px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }} className="animate-fade-in-up">
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#1a1a18', display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="capture-btn">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: '17px', fontWeight: 500, color: '#1a1a18' }}>AI is reading this...</p>
            <p style={{ margin: '6px 0 0', fontSize: '14px', color: '#9b9890' }}>Extracting people, companies, deals and tasks</p>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#1a1a18', animation: `breathe 1.2s ease-in-out ${i * 0.2}s infinite` }} />
            ))}
          </div>
        </div>
      )}

      {/* Confirm */}
      {step === 'confirm' && aiResult && (
        <div style={{ padding: '0 24px' }} className="animate-slide-up">
          <div style={{ background: 'white', borderRadius: '18px', border: '0.5px solid rgba(0,0,0,0.07)', overflow: 'hidden', marginBottom: '16px' }}>
            <div style={{ padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#1D9E75' }} />
                <span style={{ fontSize: '12px', fontWeight: 500, color: '#1D9E75' }}>AI processed</span>
              </div>
              <p style={{ margin: 0, fontSize: '15px', color: '#1a1a18', lineHeight: 1.6 }}>{aiResult.summary}</p>
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <p style={{ margin: '0 0 10px', fontSize: '12px', fontWeight: 500, color: '#9b9890', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              I'll create or update
            </p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {aiResult.creates.map((item, i) => (
                <div key={i} style={{
                  background: pillColors[item.type].bg,
                  borderRadius: '20px', padding: '6px 12px',
                  fontSize: '13px', color: pillColors[item.type].color, fontWeight: 500,
                }}>
                  {item.label}
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
            <button onClick={() => setStep('choose')} style={{
              flex: 1, background: 'white', border: '0.5px solid rgba(0,0,0,0.1)',
              borderRadius: '22px', padding: '15px', fontSize: '15px',
              color: '#6b6960', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
            }}>
              Discard
            </button>
            <button onClick={handleSave} disabled={saving} style={{
              flex: 2, background: saving ? '#6b6960' : '#1a1a18', border: 'none',
              borderRadius: '22px', padding: '15px', fontSize: '15px',
              color: 'white', fontWeight: 500, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
            }}>
              {saving ? 'Saving...' : 'Looks good, save it'}
            </button>
          </div>
        </div>
      )}

      <BottomNav />
    </main>
  )
}