import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import AnalyticsClient from './AnalyticsClient'
import { getOrgContext } from '@/lib/org-context'

export default async function AnalyticsPage() {
  const supabase = await createServerSupabaseClient()
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Get current user
  const cookieStore = await cookies()
  const authClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get(name: string) { return cookieStore.get(name)?.value }, set() {}, remove() {} } }
  )
  const { data: { user } } = await authClient.auth.getUser()

  // Get org membership + role
  const { data: membership } = user
    ? await admin
        .from('organisation_members')
        .select('org_id, role')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle()
    : { data: null }

  const orgId = membership?.org_id || null
  const role = membership?.role || 'member'
  const isElevated = role === 'manager' || role === 'admin'

  // Fetch org context (stage_template, at_risk_days, industry, etc.)
  const orgContext = orgId ? await getOrgContext(orgId) : {}

  const [
    { data: deals },
    { data: contacts },
    { data: companies },
    { data: tasks },
    { data: stageVelocity },
    { data: quotaRow },
    { data: stageConversion },
    repPerformanceResult,
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

    // Rep performance rows — managers/admins only
    isElevated && orgId
      ? admin
          .from('rep_quota_attainment')
          .select('user_id, role, quota, quota_period, confirmed_revenue, pipeline_value, attainment_pct, gap_to_quota')
          .eq('org_id', orgId)
      : Promise.resolve({ data: null }),
  ])

  // Enrich rep rows with email + at-risk count
  let repPerformance: any[] | null = null
  if (isElevated && orgId && (repPerformanceResult as any)?.data?.length) {
    const atRiskDays = (orgContext as any).at_risk_days || 14
    const now = Date.now()

    const [{ data: members }, { data: atRiskDeals }, { data: { users: authUsers } }] = await Promise.all([
      admin
        .from('organisation_members')
        .select('user_id')
        .eq('org_id', orgId)
        .eq('status', 'active'),
      admin
        .from('deals')
        .select('user_id, last_activity_at')
        .eq('org_id', orgId)
        .not('stage', 'in', '("closed_won","closed_lost")'),
      admin.auth.admin.listUsers({ perPage: 1000 }),
    ])

    const emailMap: Record<string, string> = {}
    authUsers?.forEach((u: any) => { emailMap[u.id] = u.email || u.id })

    const atRiskByRep: Record<string, number> = {}
    atRiskDeals?.forEach((d: any) => {
      const days = (now - new Date(d.last_activity_at || 0).getTime()) / 86400000
      if (days > atRiskDays) atRiskByRep[d.user_id] = (atRiskByRep[d.user_id] || 0) + 1
    })

    repPerformance = (repPerformanceResult as any).data.map((r: any) => ({
      ...r,
      email: emailMap[r.user_id] || r.user_id,
      at_risk_count: atRiskByRep[r.user_id] || 0,
    }))
  }

  return (
    <AnalyticsClient
      deals={deals ?? []}
      contacts={(contacts ?? []).map((c: any) => ({ ...c, company_name: c.companies?.name }))}
      companies={companies ?? []}
      tasks={tasks ?? []}
      stageVelocity={stageVelocity ?? []}
      quota={quotaRow ?? null}
      stageConversion={stageConversion ?? []}
      orgContext={orgContext as any}
      isElevated={isElevated}
      repPerformance={repPerformance}
    />
  )
}