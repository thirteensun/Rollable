import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import Anthropic from '@anthropic-ai/sdk'
import { getOrgContext, formatOrgContextForPrompt } from '@/lib/org-context'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

async function getLatestSonnetModel(): Promise<string> {
  try {
    const response = await fetch('https://api.anthropic.com/v1/models', {
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
    })
    const data = await response.json()
    const sonnetModels = data.data
      .map((m: any) => m.id)
      .filter((id: string) => id.includes('claude-sonnet'))
      .sort()
      .reverse()
    return sonnetModels[0] || 'claude-sonnet-4-6'
  } catch {
    return 'claude-sonnet-4-6'
  }
}

const tools: Anthropic.Tool[] = [
  {
    name: 'get_pipeline_summary',
    description: 'Get a summary of active deals in the pipeline — total value, count, at-risk deals, breakdown by stage. For managers/admins returns full org pipeline.',
    input_schema: {
      type: 'object' as const,
      properties: {
        filter: {
          type: 'string',
          enum: ['all', 'at_risk', 'closing_soon', 'by_stage', 'by_rep'],
          description: 'Filter or group deals. by_rep only available for managers and admins.',
        },
      },
    },
  },
  {
    name: 'get_deal_velocity',
    description: 'Get average time deals spend at each pipeline stage. Reveals bottlenecks — which stages slow deals down most.',
    input_schema: {
      type: 'object' as const,
      properties: {
        scope: {
          type: 'string',
          enum: ['mine', 'org'],
          description: 'mine = current user only, org = full org (managers/admins only)',
        },
      },
    },
  },
  {
    name: 'get_stage_conversion',
    description: 'Get conversion rates at each pipeline stage — how many deals advance vs stall or get lost.',
    input_schema: {
      type: 'object' as const,
      properties: {
        scope: {
          type: 'string',
          enum: ['mine', 'org'],
          description: 'mine = current user only, org = full org (managers/admins only)',
        },
      },
    },
  },
  {
    name: 'get_revenue_forecast',
    description: 'Get revenue forecast — confirmed revenue, weighted pipeline by stage probability, gap to quota, and expected close dates.',
    input_schema: {
      type: 'object' as const,
      properties: {
        scope: {
          type: 'string',
          enum: ['mine', 'org'],
          description: 'mine = current user only, org = full org (managers/admins only)',
        },
      },
    },
  },
  {
    name: 'get_rep_performance',
    description: 'Compare performance across reps — deal count, pipeline value, confirmed revenue, quota attainment. Managers and admins only.',
    input_schema: {
      type: 'object' as const,
      properties: {
        metric: {
          type: 'string',
          enum: ['quota_attainment', 'pipeline_value', 'deal_count', 'at_risk'],
          description: 'Which metric to rank reps by',
        },
      },
    },
  },
]

const STAGE_PROBABILITY: Record<string, number> = {
  lead: 0.10,
  qualified: 0.25,
  demo: 0.40,
  proposal: 0.60,
  negotiation: 0.80,
}

async function executeTool(
  toolName: string,
  toolInput: any,
  userId: string,
  orgId: string | null,
  role: string,
  admin: any,
  atRiskDays: number
): Promise<string> {
  const isElevated = role === 'manager' || role === 'admin'

  switch (toolName) {

    case 'get_pipeline_summary': {
      const filter = toolInput.filter || 'all'

      let query = admin
        .from('deals')
        .select('id, name, stage, value, last_activity_at, stage_entered_at, expected_close_date, user_id')
        .not('stage', 'in', '("closed_won","closed_lost")')

      query = isElevated && orgId ? query.eq('org_id', orgId) : query.eq('user_id', userId)

      const { data: deals } = await query
      if (!deals?.length) return 'No active deals in the pipeline.'

      const total = deals.reduce((s: number, d: any) => s + (d.value || 0), 0)
      const now = Date.now()

      const atRisk = deals.filter((d: any) => {
        const days = (now - new Date(d.last_activity_at || 0).getTime()) / 86400000
        return days > atRiskDays
      })

      const closingSoon = deals.filter((d: any) => {
        if (!d.expected_close_date) return false
        const days = (new Date(d.expected_close_date).getTime() - now) / 86400000
        return days <= 14 && days >= 0
      })

      const byStage = deals.reduce((acc: any, d: any) => {
        if (!acc[d.stage]) acc[d.stage] = { count: 0, value: 0 }
        acc[d.stage].count++
        acc[d.stage].value += d.value || 0
        return acc
      }, {})

      let summary = `${isElevated ? 'Org pipeline' : 'Your pipeline'}: ${deals.length} active deals worth €${total.toLocaleString()} total.\n\n`

      if (filter === 'by_stage' || filter === 'all') {
        summary += `By stage:\n${Object.entries(byStage).map(([stage, s]: any) =>
          `  ${stage}: ${s.count} deal${s.count > 1 ? 's' : ''}, €${s.value.toLocaleString()}`
        ).join('\n')}\n\n`
      }

      if (filter === 'at_risk' || filter === 'all') {
        summary += atRisk.length > 0
          ? `At risk (no activity >${atRiskDays} days): ${atRisk.map((d: any) => d.name).join(', ')}\n`
          : `No deals at risk.\n`
      }

      if (filter === 'closing_soon' || filter === 'all') {
        summary += closingSoon.length > 0
          ? `Closing within 14 days: ${closingSoon.map((d: any) => `${d.name} (${d.expected_close_date})`).join(', ')}\n`
          : `No deals expected to close in the next 14 days.\n`
      }

      if (filter === 'by_rep' && isElevated) {
        const { data: members } = await admin
          .from('organisation_members')
          .select('user_id, users(email)')
          .eq('org_id', orgId)
          .eq('status', 'active')

        const repMap: Record<string, string> = {}
        members?.forEach((m: any) => { repMap[m.user_id] = m.users?.email || m.user_id })

        const byRep = deals.reduce((acc: any, d: any) => {
          const rep = repMap[d.user_id] || d.user_id
          if (!acc[rep]) acc[rep] = { count: 0, value: 0, atRisk: 0 }
          acc[rep].count++
          acc[rep].value += d.value || 0
          const daysSince = (now - new Date(d.last_activity_at || 0).getTime()) / 86400000
          if (daysSince > atRiskDays) acc[rep].atRisk++
          return acc
        }, {})

        summary += `\nBy rep:\n${Object.entries(byRep).map(([rep, s]: any) =>
          `  ${rep}: ${s.count} deals, €${s.value.toLocaleString()}${s.atRisk > 0 ? `, ${s.atRisk} at risk` : ''}`
        ).join('\n')}`
      }

      return summary
    }

    case 'get_deal_velocity': {
      const scope = toolInput.scope || 'mine'
      const useOrg = scope === 'org' && isElevated && orgId

      let query = admin
        .from('deal_stage_velocity')
        .select('stage, transitions, avg_days, min_days, max_days')
        .order('avg_days', { ascending: false })

      query = useOrg ? query.eq('org_id', orgId) : query.eq('user_id', userId)

      const { data } = await query
      if (!data?.length) return 'Not enough closed deal history yet to calculate velocity.'

      const agg: Record<string, { total: number, count: number, min: number, max: number }> = {}
      data.forEach((row: any) => {
        if (!agg[row.stage]) agg[row.stage] = { total: 0, count: 0, min: Infinity, max: 0 }
        agg[row.stage].total += row.avg_days * row.transitions
        agg[row.stage].count += row.transitions
        agg[row.stage].min = Math.min(agg[row.stage].min, row.min_days)
        agg[row.stage].max = Math.max(agg[row.stage].max, row.max_days)
      })

      const stageOrder = ['lead', 'qualified', 'demo', 'proposal', 'negotiation']
      const lines = stageOrder
        .filter(s => agg[s])
        .map(s => {
          const avg = (agg[s].total / agg[s].count).toFixed(1)
          return `  ${s}: avg ${avg} days (min ${agg[s].min}, max ${agg[s].max}) — ${agg[s].count} transitions`
        })

      const totalAvg = stageOrder
        .filter(s => agg[s])
        .reduce((sum, s) => sum + agg[s].total / agg[s].count, 0)
        .toFixed(0)

      const bottleneck = stageOrder
        .filter(s => agg[s])
        .sort((a, b) => (agg[b].total / agg[b].count) - (agg[a].total / agg[a].count))[0]

      return `Deal velocity — avg ${totalAvg} days lead to close:\n\n${lines.join('\n')}\n\nBottleneck: ${bottleneck} stage takes longest.`
    }

    case 'get_stage_conversion': {
      const scope = toolInput.scope || 'mine'
      const useOrg = scope === 'org' && isElevated && orgId

      let query = admin
        .from('deal_stage_conversion')
        .select('stage, deals_entered, deals_advanced, deals_lost_here, advance_rate_pct')

      query = useOrg ? query.eq('org_id', orgId) : query.eq('user_id', userId)

      const { data } = await query
      if (!data?.length) return 'Not enough deal history yet to calculate conversion rates.'

      const agg: Record<string, { entered: number, advanced: number, lost: number }> = {}
      data.forEach((row: any) => {
        if (!agg[row.stage]) agg[row.stage] = { entered: 0, advanced: 0, lost: 0 }
        agg[row.stage].entered += row.deals_entered
        agg[row.stage].advanced += row.deals_advanced
        agg[row.stage].lost += row.deals_lost_here
      })

      const stageOrder = ['lead', 'qualified', 'demo', 'proposal', 'negotiation']
      const lines = stageOrder
        .filter(s => agg[s] && agg[s].entered > 0)
        .map(s => {
          const rate = ((agg[s].advanced / agg[s].entered) * 100).toFixed(0)
          const lostNote = agg[s].lost > 0 ? `, ${agg[s].lost} lost here` : ''
          return `  ${s}: ${rate}% advance rate (${agg[s].advanced}/${agg[s].entered})${lostNote}`
        })

      const worstStage = stageOrder
        .filter(s => agg[s] && agg[s].entered > 0)
        .sort((a, b) => (agg[a].advanced / agg[a].entered) - (agg[b].advanced / agg[b].entered))[0]

      return `Stage conversion rates:\n\n${lines.join('\n')}\n\nBiggest drop-off: ${worstStage}.`
    }

    case 'get_revenue_forecast': {
      const scope = toolInput.scope || 'mine'
      const useOrg = scope === 'org' && isElevated && orgId

      let dealsQuery = admin
        .from('deals')
        .select('name, stage, value, confirmed_revenue, expected_close_date')
        .not('stage', 'in', '("closed_won","closed_lost")')

      let quotaQuery = admin
        .from('rep_quota_attainment')
        .select('quota, quota_period, confirmed_revenue, pipeline_value, attainment_pct, gap_to_quota')

      if (useOrg) {
        dealsQuery = dealsQuery.eq('org_id', orgId)
        quotaQuery = quotaQuery.eq('org_id', orgId)
      } else {
        dealsQuery = dealsQuery.eq('user_id', userId)
        quotaQuery = quotaQuery.eq('user_id', userId)
      }

      const [{ data: deals }, { data: quotaRows }] = await Promise.all([dealsQuery, quotaQuery])

      const weighted = (deals || []).reduce((sum: number, d: any) => {
        return sum + (d.value || 0) * (STAGE_PROBABILITY[d.stage] || 0)
      }, 0)

      const totalPipeline = (deals || []).reduce((s: number, d: any) => s + (d.value || 0), 0)
      const quota = (quotaRows || []).reduce((s: number, r: any) => s + (r.quota || 0), 0)
      const confirmed = (quotaRows || []).reduce((s: number, r: any) => s + (r.confirmed_revenue || 0), 0)
      const gap = Math.max(quota - confirmed, 0)
      const quotaPeriod = quotaRows?.[0]?.quota_period || 'quarterly'
      const attainment = quota > 0 ? ((confirmed / quota) * 100).toFixed(1) : null

      const now = Date.now()
      const closingSoon = (deals || []).filter((d: any) => {
        if (!d.expected_close_date) return false
        const days = (new Date(d.expected_close_date).getTime() - now) / 86400000
        return days <= 30 && days >= 0
      })

      let summary = `Revenue forecast (${useOrg ? 'org-wide' : 'your deals'}):\n\n`
      if (quota > 0) {
        summary += `Quota: €${quota.toLocaleString()} ${quotaPeriod}\n`
        summary += `Confirmed: €${confirmed.toLocaleString()}${attainment ? ` (${attainment}% attainment)` : ''}\n`
        summary += `Gap: €${gap.toLocaleString()}\n\n`
      }
      summary += `Pipeline: €${totalPipeline.toLocaleString()} across ${deals?.length || 0} deals\n`
      summary += `Weighted forecast: €${Math.round(weighted).toLocaleString()}\n`

      if (closingSoon.length > 0) {
        summary += `\nExpected to close in 30 days:\n${closingSoon.map((d: any) =>
          `  ${d.name} — €${(d.value || 0).toLocaleString()} (${d.expected_close_date})`
        ).join('\n')}`
      }

      return summary
    }

    case 'get_rep_performance': {
      if (!isElevated) return 'Rep performance comparison is only available to managers and admins.'
      if (!orgId) return 'No org found.'

      const metric = toolInput.metric || 'quota_attainment'

      const [{ data: repData }, { data: members }, { data: atRiskDeals }] = await Promise.all([
        admin.from('rep_quota_attainment').select('user_id, role, quota, quota_period, confirmed_revenue, pipeline_value, attainment_pct, gap_to_quota').eq('org_id', orgId),
        admin.from('organisation_members').select('user_id, users(email)').eq('org_id', orgId).eq('status', 'active'),
        admin.from('deals').select('user_id, last_activity_at').eq('org_id', orgId).not('stage', 'in', '("closed_won","closed_lost")'),
      ])

      if (!repData?.length) return 'No rep data found.'

      const emailMap: Record<string, string> = {}
      members?.forEach((m: any) => { emailMap[m.user_id] = m.users?.email || m.user_id })

      const now = Date.now()
      const atRiskByRep: Record<string, number> = {}
      atRiskDeals?.forEach((d: any) => {
        const days = (now - new Date(d.last_activity_at || 0).getTime()) / 86400000
        if (days > atRiskDays) atRiskByRep[d.user_id] = (atRiskByRep[d.user_id] || 0) + 1
      })

      const sorted = [...repData].sort((a: any, b: any) => {
        if (metric === 'quota_attainment') return (b.attainment_pct || 0) - (a.attainment_pct || 0)
        if (metric === 'pipeline_value') return (b.pipeline_value || 0) - (a.pipeline_value || 0)
        if (metric === 'at_risk') return (atRiskByRep[b.user_id] || 0) - (atRiskByRep[a.user_id] || 0)
        return (b.confirmed_revenue || 0) - (a.confirmed_revenue || 0)
      })

      const lines = sorted.map((r: any, i: number) => {
        const email = emailMap[r.user_id] || r.user_id
        const attain = r.attainment_pct != null ? `${r.attainment_pct}% quota` : 'no quota set'
        const atRisk = atRiskByRep[r.user_id] || 0
        return `  ${i + 1}. ${email} (${r.role})\n     Confirmed: €${(r.confirmed_revenue || 0).toLocaleString()} | Pipeline: €${(r.pipeline_value || 0).toLocaleString()} | ${attain}${atRisk > 0 ? ` | ⚠️ ${atRisk} at risk` : ''}`
      })

      return `Rep performance ranked by ${metric.replace('_', ' ')}:\n\n${lines.join('\n\n')}`
    }

    default:
      return 'Unknown tool.'
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) { return cookieStore.get(name)?.value },
          set() {}, remove() {},
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: membership } = await admin
      .from('organisation_members')
      .select('org_id, role')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle()

    const org_id = membership?.org_id || null
    const role = membership?.role || 'member'
    const isElevated = role === 'manager' || role === 'admin'

    // Fetch org context
    const orgContext = org_id ? await getOrgContext(org_id) : {}
    const orgContextBlock = formatOrgContextForPrompt(orgContext)
    const atRiskDays = orgContext.at_risk_days || 14

    const { message, history } = await request.json()

    const messages: Anthropic.MessageParam[] = [
      ...(history || []),
      { role: 'user', content: message },
    ]

    const systemPrompt = `You are the Analytics Agent — a strategic sales intelligence assistant. Your job is to help sales teams understand their pipeline, spot risks, and make better decisions using real data.

You have access to ${isElevated ? 'the full organisation pipeline' : 'your own deals and pipeline'}.
User role: ${role}
Today's date: ${new Date().toISOString().split('T')[0]}

${orgContextBlock ? `${orgContextBlock}\n\nUse this context when interpreting results — reference their stage names, use their terminology, and apply their at-risk threshold (${atRiskDays} days) when flagging deals.` : ''}

Your capabilities:
- Pipeline health and deal breakdown → get_pipeline_summary
- Stage velocity — where deals slow down → get_deal_velocity
- Conversion rates — where deals drop off → get_stage_conversion
- Revenue forecast vs quota → get_revenue_forecast
${isElevated ? '- Rep performance comparison → get_rep_performance' : ''}

How to respond:
- Always fetch real data before giving analysis
- Lead with the insight, not the data dump
- Be specific — back every claim with a number
- If something looks bad, say so and suggest what to do
- 3–5 focused points beats a wall of text`

    const model = await getLatestSonnetModel()

    let response = await anthropic.messages.create({
      model,
      max_tokens: 1536,
      system: systemPrompt,
      tools,
      messages,
    })

    const assistantMessages: Anthropic.MessageParam[] = []

    while (response.stop_reason === 'tool_use') {
      const toolUseBlocks = response.content.filter(b => b.type === 'tool_use') as Anthropic.ToolUseBlock[]
      const toolResults: Anthropic.ToolResultBlockParam[] = []

      for (const toolUse of toolUseBlocks) {
        const result = await executeTool(toolUse.name, toolUse.input, user.id, org_id, role, admin, atRiskDays)
        toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: result })
      }

      assistantMessages.push({ role: 'assistant', content: response.content })
      assistantMessages.push({ role: 'user', content: toolResults })

      response = await anthropic.messages.create({
        model,
        max_tokens: 1536,
        system: systemPrompt,
        tools,
        messages: [...messages, ...assistantMessages],
      })
    }

    const textBlock = response.content.find(b => b.type === 'text') as Anthropic.TextBlock | undefined
    const reply = textBlock?.text || 'Done.'

    return NextResponse.json({
      reply,
      history: [...messages, { role: 'assistant', content: reply }],
    })

  } catch (error: any) {
    console.error('Analytics agent error:', error)
    return NextResponse.json({ error: error.message || 'Analytics agent failed' }, { status: 500 })
  }
}
