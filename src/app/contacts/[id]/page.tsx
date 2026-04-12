import { createServerSupabaseClient } from '@/lib/supabase-server'
import { notFound } from 'next/navigation'
import ContactDetailClient from './ContactDetailClient'

export default async function ContactDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createServerSupabaseClient()

  const { data: contact, error } = await supabase
    .from('contacts')
    .select('*, companies(id, name)')
    .eq('id', params.id)
    .single()

  if (error || !contact) notFound()

  const { data: dealContacts } = await supabase
    .from('deal_contacts')
    .select('deals(id, name, stage, value)')
    .eq('contact_id', params.id)

  const deals = dealContacts?.map((dc: any) => dc.deals).filter(Boolean) ?? []
  const dealIds = deals.map((d: any) => d.id)

  const [{ data: events }, { data: contactTasks }, { data: dealTasks }] = await Promise.all([
    supabase.from('events').select('id, type, summary, created_at, metadata').eq('contact_id', params.id).order('created_at', { ascending: false }).limit(30),
    supabase.from('tasks').select('id, title, done, status, priority, due_date, created_at, deal_id').eq('contact_id', params.id).order('created_at', { ascending: false }),
    dealIds.length > 0
      ? supabase.from('tasks').select('id, title, done, status, priority, due_date, created_at, deal_id').in('deal_id', dealIds).is('contact_id', null).order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
  ])

  const allTasks = [...(contactTasks ?? []), ...(dealTasks ?? [])]

  return <ContactDetailClient contact={contact} events={events ?? []} deals={deals} tasks={allTasks} />
}
