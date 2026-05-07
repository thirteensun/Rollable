import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import CompaniesList from './CompaniesList'

export default async function CompaniesPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: companies } = await supabase
    .from('companies')
    .select('id, name, industry, created_at, status, type')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 500, color: '#1a1a18', margin: 0 }}>Companies</h1>
        <Link href="/capture" className="btn-chrome">
          + Capture
        </Link>
      </div>
      <CompaniesList companies={companies ?? []} />
    </div>
  )
}
