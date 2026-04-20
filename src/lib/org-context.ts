import { createClient } from '@supabase/supabase-js'

export interface OrgContext {
  industry?: string
  cycle_days?: number
  stage_names?: string[]
  at_risk_days?: number
  team_size?: number
  terminology?: string
  pain_points?: string[]
}

export async function getOrgContext(orgId: string): Promise<OrgContext> {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data } = await admin
    .from('organisations')
    .select('context')
    .eq('id', orgId)
    .single()

  return (data?.context as OrgContext) || {}
}

export function formatOrgContextForPrompt(ctx: OrgContext): string {
  if (!ctx || Object.keys(ctx).length === 0) return ''

  const lines = ['Business context (learned during onboarding):']
  if (ctx.industry) lines.push(`- Industry: ${ctx.industry}`)
  if (ctx.cycle_days) lines.push(`- Typical sales cycle: ~${ctx.cycle_days} days`)
  if (ctx.stage_names?.length) lines.push(`- Pipeline stages: ${ctx.stage_names.join(' → ')}`)
  if (ctx.team_size) lines.push(`- Team size: ${ctx.team_size} salespeople`)
  if (ctx.terminology) lines.push(`- They call deals: "${ctx.terminology}"`)
  if (ctx.at_risk_days) lines.push(`- A deal is considered at-risk after ${ctx.at_risk_days} days of inactivity`)
  if (ctx.pain_points?.length) lines.push(`- Key pain points: ${ctx.pain_points.join(', ')}`)

  return lines.join('\n')
}
