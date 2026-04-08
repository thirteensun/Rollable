'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

type Mode = 'choose' | 'image_processing' | 'image_confirm' | 'assistant'

interface AIResult {
  summary: string
  contact_name?: string
  contacts?: { full_name: string; role?: string; company_name?: string; email?: string; phone?: string }[]
  company_name?: string
  deal_name?: string
  deal_value?: number
  follow_up_date?: string
  event_type: string
  creates: { label: string; type: 'contact' | 'deal' | 'task' | 'note' }[]
}

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const pillColors: Record<string, { bg: string; color: string }> = {
  contact: { bg: '#E6F1FB', color: '#185FA5' },
  deal: { bg: '#E1F5EE', color: '#0F6E56' },
  task: { bg: '#FAEEDA', color: '#854F0B' },
  note: { bg: '#EEEDFE', color: '#534AB7' },
}

export default function CapturePage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('choose')
  const [aiResult, setAiResult] = useState<AIResult | null>(null)
  const [saving, setSaving] = useState(false)
  const [processingStep, setProcessingStep] = useState(0)
  const [displayedSummary, setDisplayedSummary] = useState('')
  const [visibleCreates, setVisibleCreates] = useState(0)
  const [selectedCreates, setSelectedCreates] = useState<number[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [conversationHistory, setConversationHistory] = useState<any[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<any>(null)
  const transcriptRef = useRef('')
  const isListeningRef = useRef(false)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isThinking])

  const compressImage = (file: File): Promise<{ base64: string; mimeType: string }> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        URL.revokeObjectURL(url)
        const canvas = document.createElement('canvas')
        const MAX = 1280
        let { width, height } = img
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round(height * MAX / width); width = MAX }
          else { width = Math.round(width * MAX / height); height = MAX }
        }
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, width, height)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
        resolve({ base64: dataUrl.split(',')[1], mimeType: 'image/jpeg' })
      }
      img.onerror = reject
      img.src = url
    })
  }

  const handleImageSelect = async (file: File) => {
    setMode('image_processing')
    try {
      const { base64, mimeType } = await compressImage(file)
      const response = await fetch('/api/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, mimeType }),
      })
      if (!response.ok) throw new Error('AI processing failed')
      const result = await response.json()
      setAiResult(result)
      setSelectedCreates(result.creates.map((_: any, i: number) => i))
      setMode('image_confirm')
    } catch {
      setMode('choose')
      alert('Something went wrong. Please try again.')
    }
  }

  const handleImageSave = async () => {
    if (!aiResult) return
    setSaving(true)

    const selectedItems = aiResult.creates.filter((_, i) => selectedCreates.includes(i))
    const shouldCreateContact = selectedItems.some(c => c.type === 'contact')
    const shouldCreateDeal = selectedItems.some(c => c.type === 'deal')
    const shouldCreateTask = selectedItems.some(c => c.type === 'task')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: membership } = await supabase
      .from('organisation_members').select('org_id')
      .eq('user_id', user.id).eq('status', 'active').limit(1).maybeSingle()
    const org_id = membership?.org_id || null

    try {
      let company_id = null
      if (aiResult.company_name) {
        const { data: existing } = await supabase.from('companies').select('id').eq('user_id', user.id).ilike('name', aiResult.company_name).maybeSingle()
        company_id = existing?.id
        if (!company_id) {
          const { data: newCo } = await supabase.from('companies').insert({ user_id: user.id, name: aiResult.company_name, org_id }).select('id').maybeSingle()
          company_id = newCo?.id
        }
      }

      let contact_id = null
      const allContacts = shouldCreateContact
        ? (aiResult.contacts?.length ? aiResult.contacts : aiResult.contact_name ? [{ full_name: aiResult.contact_name }] : [])
        : []
      for (const c of allContacts) {
        let cCompanyId = company_id
        if (c.company_name && c.company_name !== aiResult.company_name) {
          const { data: existingCo } = await supabase.from('companies').select('id').eq('user_id', user.id).ilike('name', c.company_name).maybeSingle()
          if (existingCo) { cCompanyId = existingCo.id } else {
            const { data: newCo } = await supabase.from('companies').insert({ user_id: user.id, name: c.company_name, org_id }).select('id').maybeSingle()
            cCompanyId = newCo?.id
          }
        }
        const { data: existing } = await supabase.from('contacts').select('id').eq('user_id', user.id).ilike('full_name', c.full_name).maybeSingle()
        if (existing) {
          if (!contact_id) contact_id = existing.id
          await supabase.from('contacts').update({ last_contacted_at: new Date().toISOString(), company_id: cCompanyId || undefined, role: c.role || undefined, email: c.email || undefined, phone: c.phone || undefined }).eq('id', existing.id)
        } else {
          const { data: newContact } = await supabase.from('contacts').insert({ user_id: user.id, full_name: c.full_name, company_id: cCompanyId, role: c.role || null, email: c.email || null, phone: c.phone || null, last_contacted_at: new Date().toISOString(), org_id }).select('id').maybeSingle()
          if (!contact_id) contact_id = newContact?.id
        }
      }

      let deal_id = null
      if (shouldCreateDeal && aiResult.deal_name) {
        const { data: newDeal } = await supabase.from('deals').insert({ user_id: user.id, company_id, name: aiResult.deal_name, value: aiResult.deal_value || null, stage: 'lead', last_activity_at: new Date().toISOString(), org_id }).select('id').maybeSingle()
        deal_id = newDeal?.id
        if (deal_id && contact_id) await supabase.from('deal_contacts').upsert({ deal_id, contact_id }, { onConflict: 'deal_id,contact_id' })
      }

      await supabase.from('events').insert({ user_id: user.id, deal_id, contact_id, company_id, org_id, type: aiResult.event_type || 'meeting', summary: aiResult.summary, ai_confidence: 0.9, metadata: { raw_ai_result: aiResult } })

      if (shouldCreateTask && aiResult.follow_up_date) {
        await supabase.from('tasks').insert({ user_id: user.id, deal_id, contact_id, org_id, title: `Follow up with ${aiResult.contact_name || aiResult.company_name || 'contact'}`, due_date: new Date(aiResult.follow_up_date).toISOString(), ai_generated: true })
      }

      router.push('/')
      router.refresh()
    } catch (err: any) {
      alert(err.message || 'Failed to save.')
      setSaving(false)
    }
  }

  const sendMessage = async (text: string) => {
    if (!text.trim() || isThinking) return
    const userMsg: Message = { role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setInputText('')
    setTranscript('')
    transcriptRef.current = ''
    setIsThinking(true)

    try {
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: conversationHistory }),
      })
      const data = await response.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
      setConversationHistory(data.history)
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong. Please try again.' }])
    } finally {
      setIsThinking(false)
    }
  }

  const startVoice = () => {
    if (isListeningRef.current) return

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) { alert('Voice not supported. Try Chrome or Safari.'); return }

    transcriptRef.current = ''
    setTranscript('')

    const recognition = new SpeechRecognition()
    recognition.continuous = false      // auto-stop on silence
    recognition.interimResults = true
    recognition.lang = 'en-US'
    recognitionRef.current = recognition

    recognition.onstart = () => {
      isListeningRef.current = true
      setIsListening(true)
    }

    recognition.onresult = (e: any) => {
      const text = Array.from(e.results).map((r: any) => r[0].transcript).join('')
      setTranscript(text)
      transcriptRef.current = text
    }

    recognition.onend = () => {
      isListeningRef.current = false
      setIsListening(false)
      // auto-send when silence detected
      if (transcriptRef.current.trim()) {
        sendMessage(transcriptRef.current.trim())
      }
    }

    recognition.onerror = () => {
      isListeningRef.current = false
      setIsListening(false)
    }

    recognition.start()
  }

  const stopVoice = () => {
    if (!isListeningRef.current) return
    recognitionRef.current?.stop() // triggers onend which sends the message
  }

  const startVoiceFromChoose = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) { alert('Voice not supported. Try Chrome or Safari.'); return }
    setMode('assistant')
    setTimeout(() => startVoice(), 100)
  }

  const handleMicClick = () => {
    if (isListeningRef.current) {
      stopVoice()
    } else {
      startVoice()
    }
  }

  return (
    <main style={{ background: '#f5f4f0', paddingBottom: '90px', display: 'flex', flexDirection: 'column' }}>
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={e => { if (e.target.files?.[0]) handleImageSelect(e.target.files[0]) }} />

      {/* Header */}
      <div style={{ padding: '56px 24px 16px', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
        {mode !== 'choose' && (
          <button onClick={() => { setMode('choose'); setMessages([]); setTranscript(''); transcriptRef.current = ''; recognitionRef.current?.stop() }} style={{
            width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(0,0,0,0.07)',
            border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M10 4L6 8l4 4" stroke="#1a1a18" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          </button>
        )}
        <p style={{ margin: 0, fontSize: '20px', fontWeight: 500, color: '#1a1a18' }}>
          {mode === 'choose' ? 'What can I help with?' :
           mode === 'image_processing' ? 'Reading image...' :
           mode === 'image_confirm' ? 'Review capture' : 'AI Assistant'}
        </p>
      </div>

      {/* Choose */}
      {mode === 'choose' && (
        <div style={{ padding: '0 24px', flex: 1 }} className="animate-fade-in-up">
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
                <p style={{ margin: 0, fontSize: '15px', fontWeight: 500, color: 'white' }}>Capture image or screenshot</p>
                <p style={{ margin: '3px 0 0', fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>Business card, WhatsApp, email, notes</p>
              </div>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M6 4l4 4-4 4" stroke="rgba(255,255,255,0.4)" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </button>

            <button onClick={startVoiceFromChoose} style={{
              background: 'white', borderRadius: '18px', border: '0.5px solid rgba(0,0,0,0.07)', padding: '20px',
              display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer', textAlign: 'left', width: '100%',
            }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: '#f5f4f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <rect x="9" y="2" width="6" height="12" rx="3" stroke="#1a1a18" strokeWidth="1.5" />
                  <path d="M5 10a7 7 0 0 0 14 0" stroke="#1a1a18" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M12 17v4M9 21h6" stroke="#1a1a18" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: '15px', fontWeight: 500, color: '#1a1a18' }}>Speak to assistant</p>
                <p style={{ margin: '3px 0 0', fontSize: '13px', color: '#9b9890' }}>Add contacts, search, update deals</p>
              </div>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M6 4l4 4-4 4" stroke="#9b9890" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </button>

            <button onClick={() => setMode('assistant')} style={{
              background: 'white', borderRadius: '18px', border: '0.5px solid rgba(0,0,0,0.07)', padding: '20px',
              display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer', textAlign: 'left', width: '100%',
            }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: '#f5f4f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="#1a1a18" strokeWidth="1.5" strokeLinejoin="round" />
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: '15px', fontWeight: 500, color: '#1a1a18' }}>Type a message</p>
                <p style={{ margin: '3px 0 0', fontSize: '13px', color: '#9b9890' }}>Chat with your AI sales assistant</p>
              </div>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M6 4l4 4-4 4" stroke="#9b9890" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <p style={{ margin: '0 0 10px', fontSize: '12px', fontWeight: 500, color: '#9b9890', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Try saying</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              'Add Tom from UC Architecture to my contacts',
              'What\'s the status of the TechCorp deal?',
              'Pull out Tracy\'s email from Loo Consulting',
              'Schedule a follow-up with Maria for Friday',
              'Show me my pipeline summary',
            ].map((example, i) => (
              <button key={i} onClick={() => { setMode('assistant'); setTimeout(() => sendMessage(example), 100) }} style={{
                background: 'white', borderRadius: '12px', border: '0.5px solid rgba(0,0,0,0.07)',
                padding: '11px 14px', textAlign: 'left', cursor: 'pointer', width: '100%',
                fontSize: '13px', color: '#6b6960', fontFamily: 'inherit',
              }}>
                "{example}"
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Image processing */}
      {mode === 'image_processing' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '28px', padding: '24px' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#1a1a18', display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="capture-btn">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', maxWidth: '280px' }}>
            {[
              'Analysing image...',
              'Identifying people and companies...',
              'Extracting contact details...',
              'Building your CRM update...',
              'Almost done...',
            ].map((step, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                opacity: processingStep >= i ? 1 : 0.2,
                transition: 'opacity 0.4s ease',
              }}>
                <div style={{
                  width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0,
                  background: processingStep > i ? '#1D9E75' : processingStep === i ? '#1a1a18' : 'rgba(0,0,0,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.3s ease',
                }}>
                  {processingStep > i ? (
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : processingStep === i ? (
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'white', animation: 'breathe 1s ease-in-out infinite' }} />
                  ) : null}
                </div>
                <p style={{
                  margin: 0, fontSize: '14px',
                  color: processingStep > i ? '#1D9E75' : processingStep === i ? '#1a1a18' : '#9b9890',
                  fontWeight: processingStep === i ? 500 : 400,
                  transition: 'color 0.3s ease',
                }}>
                  {step}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Image confirm */}
      {mode === 'image_confirm' && aiResult && (
        <div style={{ padding: '0 24px', flex: 1 }} className="animate-slide-up">
          <div style={{
            background: 'white', borderRadius: '18px',
            border: '0.5px solid rgba(0,0,0,0.07)',
            padding: '16px 18px', marginBottom: '16px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#1D9E75' }} />
              <span style={{ fontSize: '12px', fontWeight: 500, color: '#1D9E75' }}>AI processed</span>
            </div>
            <p style={{ margin: 0, fontSize: '15px', color: '#1a1a18', lineHeight: 1.6, minHeight: '24px' }}>
              {displayedSummary}
              {displayedSummary.length < (aiResult.summary?.length || 0) && (
                <span style={{ display: 'inline-block', width: '2px', height: '16px', background: '#1a1a18', marginLeft: '2px', verticalAlign: 'middle', animation: 'breathe 0.8s ease-in-out infinite' }} />
              )}
            </p>
          </div>

          {aiResult.creates.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <p style={{ margin: '0 0 10px', fontSize: '12px', fontWeight: 500, color: '#9b9890', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                I'll create or update
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {aiResult.creates.map((item, i) => {
                  const selected = selectedCreates.includes(i)
                  const visible = i < visibleCreates
                  return (
                    <div key={i} style={{
                      opacity: visible ? 1 : 0,
                      transform: visible ? 'translateY(0)' : 'translateY(12px)',
                      transition: 'opacity 0.3s ease, transform 0.3s ease',
                    }}>
                      <button onClick={() => {
                        setSelectedCreates(prev =>
                          prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]
                        )
                      }} style={{
                        display: 'flex', alignItems: 'center', gap: '12px',
                        background: selected ? pillColors[item.type].bg : '#f5f4f0',
                        border: selected ? `1px solid ${pillColors[item.type].color}20` : '1px solid rgba(0,0,0,0.08)',
                        borderRadius: '14px', padding: '11px 14px',
                        cursor: 'pointer', textAlign: 'left', width: '100%',
                        transition: 'all 0.15s ease',
                      }}>
                        <div style={{
                          width: '20px', height: '20px', borderRadius: '6px', flexShrink: 0,
                          background: selected ? pillColors[item.type].color : 'white',
                          border: selected ? 'none' : '1.5px solid rgba(0,0,0,0.15)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.15s ease',
                        }}>
                          {selected && (
                            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                              <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </div>
                        <span style={{
                          fontSize: '14px', fontWeight: 500,
                          color: selected ? pillColors[item.type].color : '#9b9890',
                          transition: 'color 0.15s ease',
                        }}>
                          {item.label}
                        </span>
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
            <button onClick={() => setMode('choose')} style={{
              flex: 1, background: 'white', border: '0.5px solid rgba(0,0,0,0.1)',
              borderRadius: '22px', padding: '15px', fontSize: '15px',
              color: '#6b6960', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
            }}>
              Discard
            </button>
            <button onClick={handleImageSave} disabled={saving} style={{
              flex: 2, background: saving ? '#6b6960' : '#1a1a18', border: 'none',
              borderRadius: '22px', padding: '15px', fontSize: '15px',
              color: 'white', fontWeight: 500,
              cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
            }}>
              {saving ? 'Saving...' : 'Looks good, save it'}
            </button>
          </div>
        </div>
      )}

      {/* Assistant chat */}
      {mode === 'assistant' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 16px' }} className="no-scrollbar">
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <p style={{ margin: 0, fontSize: '15px', color: '#9b9890' }}>Ask me anything about your CRM</p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: '10px' }}>
                <div style={{
                  maxWidth: '85%', padding: '11px 14px',
                  borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  background: msg.role === 'user' ? '#1a1a18' : 'white',
                  border: msg.role === 'assistant' ? '0.5px solid rgba(0,0,0,0.07)' : 'none',
                  fontSize: '14px', lineHeight: 1.5,
                  color: msg.role === 'user' ? 'white' : '#1a1a18',
                }}>
                  {msg.content}
                </div>
              </div>
            ))}
            {isThinking && (
              <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '10px' }}>
                <div style={{ padding: '12px 16px', borderRadius: '18px 18px 18px 4px', background: 'white', border: '0.5px solid rgba(0,0,0,0.07)', display: 'flex', gap: '5px', alignItems: 'center' }}>
                  {[0, 1, 2].map(i => <div key={i} style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#9b9890', animation: `breathe 1.2s ease-in-out ${i * 0.2}s infinite` }} />)}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {isListening && (
            <div style={{ margin: '0 24px 8px', background: '#E1F5EE', borderRadius: '12px', padding: '10px 14px', fontSize: '14px', color: '#0F6E56' }}>
              {transcript || 'Listening...'}
            </div>
          )}

          <div style={{ padding: '8px 24px 0', display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
            <div style={{ flex: 1, background: 'white', borderRadius: '24px', border: '0.5px solid rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', padding: '10px 16px' }}>
              <input
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage(inputText)}
                placeholder="Ask anything..."
                style={{ flex: 1, border: 'none', outline: 'none', fontSize: '15px', color: '#1a1a18', background: 'transparent', fontFamily: 'inherit' }}
                autoFocus
              />
            </div>

            {/* Tap to start, tap again to stop early, silence auto-sends */}
            <button
              onClick={handleMicClick}
              style={{
                width: '44px', height: '44px', borderRadius: '50%', flexShrink: 0,
                background: isListening ? '#1D9E75' : '#1a1a18',
                border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.2s ease',
                touchAction: 'manipulation',
                WebkitUserSelect: 'none',
                userSelect: 'none',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <rect x="9" y="2" width="6" height="12" rx="3" stroke="white" strokeWidth="1.5" />
                <path d="M5 10a7 7 0 0 0 14 0" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M12 17v4" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>

            {inputText && (
              <button onClick={() => sendMessage(inputText)} style={{
                width: '44px', height: '44px', borderRadius: '50%', flexShrink: 0,
                background: '#1a1a18', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}
    </main>
  )
}