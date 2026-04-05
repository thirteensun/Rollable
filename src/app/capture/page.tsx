'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import BottomNav from '@/components/layout/BottomNav'

type Step = 'choose' | 'processing' | 'confirm'

interface AIResult {
  summary: string
  creates: { label: string; type: 'contact' | 'deal' | 'task' | 'note' }[]
}

export default function CapturePage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('choose')
  const [aiResult, setAiResult] = useState<AIResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImageSelect = async (file: File) => {
    setStep('processing')
    // TODO: Send to Gemini API
    // Simulating AI processing for now
    await new Promise(r => setTimeout(r, 2000))
    setAiResult({
      summary: "I found a meeting with Maria Kovacs at TechCorp. She's interested in the enterprise plan and mentioned a budget around €45,000. She also needs SSO integration. I've noted a follow-up for Thursday.",
      creates: [
        { label: 'Contact — Maria Kovacs', type: 'contact' },
        { label: 'Deal — TechCorp Enterprise', type: 'deal' },
        { label: 'Task — Follow-up Thursday', type: 'task' },
        { label: 'Note — SSO requirement', type: 'note' },
      ]
    })
    setStep('confirm')
  }

  const handleVoice = async () => {
    setStep('processing')
    await new Promise(r => setTimeout(r, 2000))
    setAiResult({
      summary: "I transcribed your voice note. You mentioned a call with Björn at Nordic Solutions about renewing their contract. He seemed interested but wants a 10% discount. I've created a follow-up task for tomorrow.",
      creates: [
        { label: 'Contact — Björn Eriksson', type: 'contact' },
        { label: 'Deal — Nordic Solutions Renewal', type: 'deal' },
        { label: 'Task — Send revised quote', type: 'task' },
      ]
    })
    setStep('confirm')
  }

  const handleSave = () => {
    // TODO: Save to Supabase
    router.push('/')
  }

  const pillColors: Record<string, { bg: string; color: string }> = {
    contact: { bg: '#E6F1FB', color: '#185FA5' },
    deal: { bg: '#E1F5EE', color: '#0F6E56' },
    task: { bg: '#FAEEDA', color: '#854F0B' },
    note: { bg: '#EEEDFE', color: '#534AB7' },
  }

  return (
    <main style={{ minHeight: '100dvh', background: '#f5f4f0', paddingBottom: '100px' }}>
      {/* Hidden file input */}
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

      {/* Step: Choose */}
      {step === 'choose' && (
        <div style={{ padding: '0 24px' }} className="animate-fade-in-up">

          {/* Primary options */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
            <button onClick={() => fileInputRef.current?.click()} style={{
              background: '#1a1a18', borderRadius: '18px', padding: '20px',
              display: 'flex', alignItems: 'center', gap: '16px',
              border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%',
            }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '14px',
                background: 'rgba(255,255,255,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
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

            <button onClick={handleVoice} style={{
              background: 'white', borderRadius: '18px',
              border: '0.5px solid rgba(0,0,0,0.07)', padding: '20px',
              display: 'flex', alignItems: 'center', gap: '16px',
              cursor: 'pointer', textAlign: 'left', width: '100%',
            }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '14px',
                background: '#f5f4f0',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <rect x="9" y="2" width="6" height="12" rx="3" stroke="#1a1a18" strokeWidth="1.5" />
                  <path d="M5 10a7 7 0 0 0 14 0" stroke="#1a1a18" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M12 17v4M9 21h6" stroke="#1a1a18" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: '15px', fontWeight: 500, color: '#1a1a18' }}>Voice memo</p>
                <p style={{ margin: '3px 0 0', fontSize: '13px', color: '#9b9890' }}>Speak naturally after a call or meeting</p>
              </div>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M6 4l4 4-4 4" stroke="#9b9890" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Quick picks */}
          <p style={{ margin: '0 0 12px', fontSize: '12px', fontWeight: 500, color: '#9b9890', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Or pick from library
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
            {[
              { label: 'Screenshot', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 4h16v12H4zM8 20h8M12 16v4" stroke="#6b6960" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg> },
              { label: 'Email', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 8l7.5 5L18 8" stroke="#6b6960" strokeWidth="1.4" strokeLinecap="round" /><rect x="3" y="5" width="18" height="14" rx="2" stroke="#6b6960" strokeWidth="1.4" /></svg> },
              { label: 'Chat thread', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="#6b6960" strokeWidth="1.4" strokeLinejoin="round" /></svg> },
              { label: 'Business card', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="16" rx="2" stroke="#6b6960" strokeWidth="1.4" /><path d="M3 9h18" stroke="#6b6960" strokeWidth="1.4" /></svg> },
            ].map((item, i) => (
              <button key={i} onClick={() => fileInputRef.current?.click()} style={{
                background: 'white', borderRadius: '14px',
                border: '0.5px solid rgba(0,0,0,0.07)', padding: '14px',
                display: 'flex', alignItems: 'center', gap: '10px',
                cursor: 'pointer', width: '100%',
              }}>
                {item.icon}
                <span style={{ fontSize: '13px', color: '#1a1a18' }}>{item.label}</span>
              </button>
            ))}
          </div>

          {/* Text fallback */}
          <div style={{
            background: 'white', borderRadius: '14px',
            border: '0.5px solid rgba(0,0,0,0.07)',
            padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '10px',
            cursor: 'text',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="#9b9890" strokeWidth="1.4" strokeLinecap="round" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="#9b9890" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            <span style={{ fontSize: '14px', color: '#9b9890' }}>Or type a quick note...</span>
          </div>
        </div>
      )}

      {/* Step: Processing */}
      {step === 'processing' && (
        <div style={{ padding: '40px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }} className="animate-fade-in-up">
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%',
            background: '#1a1a18', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }} className="capture-btn">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: '17px', fontWeight: 500, color: '#1a1a18' }}>AI is reading this...</p>
            <p style={{ margin: '6px 0 0', fontSize: '14px', color: '#9b9890' }}>Extracting people, companies, deals and tasks</p>
          </div>
          {/* Animated dots */}
          <div style={{ display: 'flex', gap: '6px' }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: '6px', height: '6px', borderRadius: '50%', background: '#1a1a18',
                animation: `breathe 1.2s ease-in-out ${i * 0.2}s infinite`,
              }} />
            ))}
          </div>
        </div>
      )}

      {/* Step: Confirm */}
      {step === 'confirm' && aiResult && (
        <div style={{ padding: '0 24px' }} className="animate-slide-up">

          {/* AI summary card */}
          <div style={{
            background: 'white', borderRadius: '18px',
            border: '0.5px solid rgba(0,0,0,0.07)',
            overflow: 'hidden', marginBottom: '16px',
          }}>
            <div style={{
              background: '#e8e6e0', height: '120px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderBottom: '0.5px solid rgba(0,0,0,0.07)',
            }}>
              <div style={{ textAlign: 'center' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.25, display: 'block', margin: '0 auto 6px' }}>
                  <rect x="3" y="5" width="18" height="15" rx="2" stroke="#1a1a18" strokeWidth="1.5" />
                  <circle cx="12" cy="12" r="3.5" stroke="#1a1a18" strokeWidth="1.5" />
                </svg>
                <span style={{ fontSize: '12px', color: '#9b9890' }}>Captured</span>
              </div>
            </div>
            <div style={{ padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#1D9E75' }} />
                <span style={{ fontSize: '12px', fontWeight: 500, color: '#1D9E75' }}>AI processed</span>
              </div>
              <p style={{ margin: 0, fontSize: '15px', color: '#1a1a18', lineHeight: 1.6 }}>
                {aiResult.summary}
              </p>
            </div>
          </div>

          {/* What AI will create */}
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

          {/* Add note */}
          <div style={{
            background: 'white', borderRadius: '14px',
            border: '0.5px solid rgba(0,0,0,0.07)',
            padding: '13px 16px', marginBottom: '20px',
          }}>
            <p style={{ margin: '0 0 8px', fontSize: '13px', color: '#9b9890' }}>Anything to add or correct?</p>
            <div style={{
              background: '#f5f4f0', borderRadius: '10px',
              padding: '10px 12px', fontSize: '14px', color: '#c8c5be',
            }}>
              Add a note...
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => setStep('choose')} style={{
              flex: 1, background: 'white', border: '0.5px solid rgba(0,0,0,0.1)',
              borderRadius: '22px', padding: '15px', fontSize: '15px',
              color: '#6b6960', fontWeight: 500, cursor: 'pointer',
            }}>
              Edit
            </button>
            <button onClick={handleSave} style={{
              flex: 2, background: '#1a1a18', border: 'none',
              borderRadius: '22px', padding: '15px', fontSize: '15px',
              color: 'white', fontWeight: 500, cursor: 'pointer',
            }}>
              Looks good, save it
            </button>
          </div>
        </div>
      )}

      <BottomNav />
    </main>
  )
}
