import { createServerSupabaseClient } from '@/lib/supabase-server'
import { notFound } from 'next/navigation'
import DealDetailClient from './DealDetailClient'

export default async function DealDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createServerSupabaseClient()

  const { data: deal, error } = await supabase
    .from('deals')
    .select('*')
    .eq('id', params.id)
    .single()

  console.log('deal:', deal, 'error:', error)

  if (error || !deal) notFound()

  return <DealDetailClient deal={deal} events={[]} />
}
