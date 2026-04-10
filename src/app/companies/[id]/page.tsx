import { createServerSupabaseClient } from '@/lib/supabase-server'
import { notFound } from 'next/navigation'
import CompanyDetailClient from './CompanyDetailClient'

export default async function CompanyDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createServerSupabaseClient()

  const { data: company, error } = await supabase
    .from('companies')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !company) notFound()

  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, full_name, role, email, phone')
    .eq('company_id', params.id)
    .order('full_name')

  const { data: deals } = await supabase
    .from('deals')
    .select('id, name, stage, value')
    .eq('company_id', params.id)
    .order('created_at', { ascending: false })

  const { data: events } = await supabase
    .from('events')
    .select('*')
    .eq('company_id', params.id)
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <CompanyDetailClient
      company={company}
      contacts={contacts ?? []}
      deals={deals ?? []}
      events={events ?? []}
    />
  )
}
