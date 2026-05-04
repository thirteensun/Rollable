'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'

const PRO_FEATURES = [
  {
    color: '#185FA5',
    title: 'AI Sandbox',
    desc: 'Ask anything about your pipeline, contacts, and deals — instant answers from your own data.',
    icon: (
      <svg width="18" height="18" viewBox="0 0 22 22" fill="none">
        <path d="M7.5 1.5a6 6 0 100 12 6 6 0 000-12z" stroke="currentColor" strokeWidth="1.6"/>
        <path d="M7.5 5v3.5l2 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    color: '#4a7a8a',
    title: 'AI Signals',
    desc: 'Automated nudges for stalled deals, overdue follow-ups, and at-risk relationships.',
    icon: (
      <svg width="18" height="18" viewBox="0 0 22 22" fill="none">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    color: '#8a5040',
    title: 'Advanced Analytics',
    desc: 'Full pipeline velocity, activity trends, and revenue forecasting across your team.',
    icon: (
      <svg width="18" height="18" viewBox="0 0 22 22" fill="none">
        <path d="M2 17L7 10l4.5 3.5L16 6l4 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    color: '#6a5aaa',
    title: 'Unlimited seats',
    desc: 'Invite your whole team without hitting seat limits.',
    icon: (
      <svg width="18" height="18" viewBox="0 0 22 22" fill="none">
        <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.6"/>
        <path d="M1 20c0-4 3.6-6 8-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
        <path d="M16 14v6M13 17h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      </svg>
    ),
  },
]

export default function UpgradePage() {
  return (
    <div style={{ maxWidth: 480, margin: '0 auto', paddingTop: 16 }}>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
        style={{ marginBottom: 24, textAlign: 'center' }}
      >
        <div style={{
          width: 48, height: 48, borderRadius: 14,
          background: 'rgba(24,95,165,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 14px',
          color: '#185FA5',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        </div>
        <h1 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 600, color: '#1a1a18' }}>
          Upgrade to Pro
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: '#6b6960', lineHeight: 1.5 }}>
          Unlock AI-powered features and get more out of your sales workflow.
        </p>
      </motion.div>

      {/* Features list */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, delay: 0.06 }}
        style={{
          background: 'white',
          border: '0.5px solid rgba(0,0,0,0.07)',
          borderRadius: 16,
          overflow: 'hidden',
          marginBottom: 16,
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        {PRO_FEATURES.map((f, idx) => (
          <div
            key={f.title}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 12,
              padding: '14px 16px',
              borderBottom: idx < PRO_FEATURES.length - 1 ? '0.5px solid rgba(0,0,0,0.05)' : 'none',
            }}
          >
            <div style={{
              width: 34, height: 34, borderRadius: 10, flexShrink: 0,
              background: `${f.color}14`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: f.color,
            }}>
              {f.icon}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#1a1a18', marginBottom: 2 }}>{f.title}</div>
              <div style={{ fontSize: 11, color: '#9b9890', lineHeight: 1.5 }}>{f.desc}</div>
            </div>
          </div>
        ))}
      </motion.div>

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, delay: 0.1 }}
      >
        <a
          href="mailto:hello@rollable.app?subject=Upgrade to Pro"
          style={{
            display: 'block', width: '100%', boxSizing: 'border-box',
            padding: '13px 20px', borderRadius: 12, textAlign: 'center',
            background: '#1a1a18', color: 'white',
            fontSize: 14, fontWeight: 500, textDecoration: 'none',
            marginBottom: 10,
          }}
        >
          Contact us to upgrade
        </a>

        <Link href="/" style={{
          display: 'block', textAlign: 'center',
          fontSize: 13, color: '#9b9890', textDecoration: 'none', padding: '6px 0',
        }}>
          ← Back to home
        </Link>
      </motion.div>

    </div>
  )
}
