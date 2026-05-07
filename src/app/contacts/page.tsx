import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ContactsList from './ContactsList'

export default async function ContactsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, full_name, role, email, companies(name), last_contacted_at, status, seniority_level')
    .eq('user_id', user.id)
    .order('last_contacted_at', { ascending: false, nullsFirst: false })

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 500, color: '#1a1a18', margin: 0 }}>Contacts</h1>
        <Link href="/capture" style={{ background: '#1a1a18', color: 'white', borderRadius: 10, padding: '7px 14px', fontSize: 12, fontWeight: 500, textDecoration: 'none' }}>
          + Capture
        </Link>
      </div>
      <ContactsList contacts={contacts ?? []} />
    </div>
  )
}
