import { createServerSupabaseClient } from '@/lib/supabase-server'
import { notFound } from 'next/navigation'
import DealDetailClient from './DealDetailClient'

export default async function DealDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createServerSupabaseClient()

  const { data: deal, error } = await supabase
    .from('deals')
    .select(`
      *,
      companies ( id, name ),
      deal_contacts (
        contacts ( id, full_name, email, phone, role )
      )
    `)
    .eq('id', params.id)
    .single()

  if (error || !deal) notFound()

  const { data: events } = await supabase
    .from('events')
    .select('*')
    .eq('deal_id', params.id)
    .order('created_at', { ascending: false })
    .limit(50)

  return <DealDetailClient deal={deal} events={events ?? []} />
}
