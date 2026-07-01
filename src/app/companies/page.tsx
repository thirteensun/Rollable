import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import CompaniesList from './CompaniesList'
import { getModeConfig } from '@/lib/mode-config'

export default async function CompaniesPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: membership } = await admin.from('organisation_members').select('org_id').eq('user_id', user.id).limit(1).maybeSingle()
  const { data: org } = membership
    ? await admin.from('organisations').select('context').eq('id', membership.org_id).single()
    : { data: null }

  const mode = getModeConfig(org?.context?.app_mode)

  const { data: companies } = await supabase
    .from('companies')
    .select('id, name, industry, created_at, status, type')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 500, color: '#1a1a18', margin: 0, textTransform: 'capitalize' }}>
          {mode.nav.companies}
        </h1>
        <Link href="/capture" className="btn-chrome">
          + Capture
        </Link>
      </div>
      <CompaniesList companies={companies ?? []} />
    </div>
  )
}
