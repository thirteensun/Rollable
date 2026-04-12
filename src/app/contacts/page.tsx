import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function ContactsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, full_name, role, email, companies(name), last_contacted_at')
    .eq('user_id', user.id)
    .order('last_contacted_at', { ascending: false, nullsFirst: false })
    .limit(100)

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const d = Math.floor(diff / 86400000)
    if (d === 0) return 'Today'
    if (d === 1) return 'Yesterday'
    return `${d}d ago`
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 500, color: '#1a1a18', margin: 0 }}>Contacts</h1>
        <Link href="/capture" style={{ background: '#1a1a18', color: 'white', borderRadius: 10, padding: '7px 14px', fontSize: 12, fontWeight: 500, textDecoration: 'none' }}>
          + Capture
        </Link>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(contacts ?? []).map(c => (
          <Link key={c.id} href={`/contacts/${c.id}`} style={{ textDecoration: 'none' }}>
            <div style={{ background: 'white', border: '0.5px solid rgba(0,0,0,0.07)', borderRadius: 16, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#1a1a18', color: 'white', fontSize: 12, fontWeight: 600, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {c.full_name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#1a1a18', marginBottom: 2 }}>{c.full_name}</div>
                <div style={{ fontSize: 12, color: '#9b9890' }}>{[c.role, (c.companies as any)?.name].filter(Boolean).join(' · ')}</div>
              </div>
              {c.last_contacted_at && <div style={{ fontSize: 11, color: '#9b9890', flexShrink: 0 }}>{timeAgo(c.last_contacted_at)}</div>}
            </div>
          </Link>
        ))}
        {(contacts ?? []).length === 0 && (
          <div style={{ background: 'white', borderRadius: 16, border: '0.5px solid rgba(0,0,0,0.07)', padding: 32, textAlign: 'center' }}>
            <p style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 500, color: '#1a1a18' }}>No contacts yet</p>
            <p style={{ margin: 0, fontSize: 13, color: '#9b9890' }}>Use Capture to add your first contact</p>
          </div>
        )}
      </div>
    </div>
  )
}
