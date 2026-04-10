import { createServerSupabaseClient } from '@/lib/supabase-server'
import { notFound } from 'next/navigation'
import ContactDetailClient from './ContactDetailClient'

export default async function ContactDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createServerSupabaseClient()

  const { data: contact, error } = await supabase
    .from('contacts')
    .select(`
      *,
      companies ( id, name )
    `)
    .eq('id', params.id)
    .single()

  if (error || !contact) notFound()

  const { data: events } = await supabase
    .from('events')
    .select('*')
    .eq('contact_id', params.id)
    .order('created_at', { ascending: false })
    .limit(50)

  const { data: dealContacts } = await supabase
    .from('deal_contacts')
    .select(`
      deals ( id, name, stage, value )
    `)
    .eq('contact_id', params.id)

  const deals = dealContacts?.map((dc: any) => dc.deals).filter(Boolean) ?? []

  return <ContactDetailClient contact={contact} events={events ?? []} deals={deals} />
}
