import { createServerSupabaseClient } from '@/lib/supabase-server'
import { notFound } from 'next/navigation'
import DealDetailClient from '../../deals/[id]/DealDetailClient'

export default async function DealDetailPage({ params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient()

  const { data: deal, error } = await supabase
    .from('deals')
    .select(`
      *,
      companies ( id, name ),
      deal_contacts (
        contacts ( id, first_name, last_name, email, phone, title )
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
