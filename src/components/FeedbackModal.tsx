'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'

interface Props {
  open: boolean
  onClose: () => void
}

type Category = 'bug' | 'idea' | 'other'

export default function FeedbackModal({ open, onClose }: Props) {
  const pathname = usePathname()
  const [category, setCategory] = useState<Category | null>(null)
  const [rating, setRating] = useState<number | null>(null)
  const [text, setText] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent'>('idle')

  if (!open) return null

  async function handleSubmit() {
    if (!text.trim() && !rating) return
    setStatus('loading')
    await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, rating, text, page: pathname }),
    })
    setStatus('sent')
    setTimeout(() => {
      onClose()
      setStatus('idle')
      setText('')
      setCategory(null)
      setRating(null)
    }, 1600)
  }

  const cats: { val: Category; label: string }[] = [
    { val: 'bug', label: 'Bug' },
    { val: 'idea', label: 'Idea' },
    { val: 'other', label: 'Other' },
  ]

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.2)',
          zIndex: 200,
        }}
      />
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        background: 'white', borderRadius: 18,
        border: '0.5px solid rgba(0,0,0,0.07)',
        padding: 28, width: 360,
        zIndex: 201, boxSizing: 'border-box',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 15, fontWeight: 500, color: '#1a1a18' }}>Share feedback</span>
          <button onClick={onClose} style={closeBtn}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 2l6 6M8 2l-6 6" stroke="#6b6960" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <p style={{ fontSize: 13, color: '#6b6960', margin: '0 0 14px' }}>
          How's rollable working for you?
        </p>

        {/* Category */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
          {cats.map(c => (
            <button key={c.val} onClick={() => setCategory(c.val)} style={pill(category === c.val)}>
              {c.label}
            </button>
          ))}
        </div>

        {/* Stars */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <span style={{ fontSize: 12, color: '#6b6960', minWidth: 44 }}>Rating</span>
          {[1, 2, 3, 4, 5].map(n => (
            <button key={n} onClick={() => setRating(n)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 20, lineHeight: 1, padding: '2px 1px',
              color: rating && n <= rating ? '#EF9F27' : '#D3D1C7',
            }}>★</button>
          ))}
        </div>

        {/* Text */}
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Tell us what's on your mind…"
          rows={4}
          style={{
            width: '100%', boxSizing: 'border-box', fontFamily: 'inherit',
            fontSize: 13, border: '0.5px solid rgba(0,0,0,0.09)',
            borderRadius: 14, padding: '11px 14px', resize: 'none',
            color: '#1a1a18', outline: 'none', display: 'block',
          }}
        />

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={status !== 'idle' || (!text.trim() && !rating)}
          style={{
            marginTop: 12, width: '100%',
            background: status === 'sent' ? '#1D9E75' : '#1a1a18',
            color: 'white', border: 'none', borderRadius: 22,
            padding: 11, fontSize: 13, fontWeight: 500,
            cursor: 'pointer', fontFamily: 'inherit',
            opacity: status === 'loading' ? 0.6 : 1,
            transition: 'background 0.2s',
          }}
        >
          {status === 'sent' ? 'Sent — thanks!' : status === 'loading' ? 'Sending…' : 'Send feedback'}
        </button>
      </div>
    </>
  )
}

const pill = (active: boolean): React.CSSProperties => ({
  fontSize: 12, padding: '6px 14px', borderRadius: 20, fontFamily: 'inherit',
  border: `0.5px solid ${active ? '#1a1a18' : 'rgba(0,0,0,0.09)'}`,
  background: active ? '#1a1a18' : 'transparent',
  color: active ? 'white' : '#6b6960',
  cursor: 'pointer',
})

const closeBtn: React.CSSProperties = {
  background: 'transparent', border: '0.5px solid rgba(0,0,0,0.07)',
  borderRadius: '50%', width: 28, height: 28, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}