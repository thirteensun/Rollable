import { createServerSupabaseClient } from '@/lib/supabase-server'
import AISandboxClient from './AISandboxClient'

export default async function AISandboxPage() {
  const supabase = await createServerSupabaseClient()

  const { data: deals } = await supabase
    .from('deals')
    .select('id, name, stage, value, confirmed_revenue, updated_at, payment_status')
    .order('updated_at', { ascending: false })

  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, full_name, role, updated_at')
    .order('updated_at', { ascending: false })
    .limit(20)

  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, title, status, due_date')
    .neq('status', 'done')
    .order('due_date', { ascending: true })
    .limit(20)

  const { data: companies } = await supabase
    .from('companies')
    .select('id, name')
    .order('updated_at', { ascending: false })
    .limit(50)

  return (
    <AISandboxClient
      deals={deals ?? []}
      contacts={contacts ?? []}
      tasks={tasks ?? []}
      companies={companies ?? []}
    />
  )
}