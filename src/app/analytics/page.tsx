import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import AnalyticsClient from './AnalyticsClient'

export default async function AnalyticsPage() {
  const supabase = await createServerSupabaseClient()
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Get current user for quota lookup
  const cookieStore = await cookies()
  const authClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get(name: string) { return cookieStore.get(name)?.value }, set() {}, remove() {} } }
  )
  const { data: { user } } = await authClient.auth.getUser()

  const [
    { data: deals },
    { data: contacts },
    { data: companies },
    { data: tasks },
    { data: stageVelocity },
    { data: quotaRow },
    { data: stageConversion },
  ] = await Promise.all([
    supabase
      .from('deals')
      .select('id, name, stage, value, confirmed_revenue, updated_at, payment_status, expected_close_date, loss_reason, stage_entered_at, closed_at, last_activity_at, created_at')
      .order('updated_at', { ascending: false }),

    supabase
      .from('contacts')
      .select('id, full_name, role, last_contacted_at, next_followup_date, created_at, companies(name)')
      .order('created_at', { ascending: false }),

    supabase
      .from('companies')
      .select('id, name, industry, created_at')
      .order('created_at', { ascending: false }),

    supabase
      .from('tasks')
      .select('id, title, status, done, due_date, priority, deal_id, contact_id')
      .order('due_date', { ascending: true }),

    supabase
      .from('deal_stage_velocity')
      .select('stage, avg_days, transitions'),

    user ? admin
      .from('rep_quota_attainment')
      .select('quota, quota_period, confirmed_revenue, pipeline_value, attainment_pct, gap_to_quota')
      .eq('user_id', user.id)
      .maybeSingle() : Promise.resolve({ data: null }),

    supabase
      .from('deal_stage_conversion')
      .select('stage, deals_entered, deals_advanced, deals_lost_here, advance_rate_pct'),
  ])

  return (
    <AnalyticsClient
      deals={deals ?? []}
      contacts={(contacts ?? []).map((c: any) => ({ ...c, company_name: c.companies?.name }))}
      companies={companies ?? []}
      tasks={tasks ?? []}
      stageVelocity={stageVelocity ?? []}
      quota={quotaRow ?? null}
      stageConversion={stageConversion ?? []}
    />
  )
}