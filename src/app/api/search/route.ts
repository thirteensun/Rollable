import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const isSimpleQuery = (q: string) => q.trim().split(/\s+/).length <= 2 && !/[?]/.test(q)

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get(name: string) { return cookieStore.get(name)?.value }, set() {}, remove() {} } }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { data: membership } = await admin
      .from('organisation_members')
      .select('org_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle()
    const org_id = membership?.org_id

    const { query } = await request.json()
    if (!query?.trim()) return NextResponse.json({ intent: 'empty', contacts: [], deals: [], companies: [] })

    // Simple keyword lookup — fast, no Claude
    if (isSimpleQuery(query)) {
      const q = query.trim()
      const [contactsRes, dealsRes, companiesRes] = await Promise.all([
        admin.from('contacts').select('id, full_name, role, companies(name)').eq('user_id', user.id).ilike('full_name', `%${q}%`).limit(5),
        admin.from('deals').select('id, name, stage, value, last_activity_at, created_at').eq('user_id', user.id).ilike('name', `%${q}%`).limit(5),
        admin.from('companies').select('id, name, industry').eq('user_id', user.id).ilike('name', `%${q}%`).limit(5),
      ])
      return NextResponse.json({
        intent: 'lookup',
        contacts: contactsRes.data ?? [],
        deals: dealsRes.data ?? [],
        companies: companiesRes.data ?? [],
        mode: 'keyword',
      })
    }

    // Claude classifies intent + extracts search params
    const intentResponse = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: `You are a CRM search assistant. Classify the user's query into one of three intents and extract parameters.

Respond ONLY with valid JSON:
{
  "intent": "lookup" | "analytics" | "action",
  "contact_query": "name or null",
  "deal_query": "name or null",
  "company_query": "name or null",
  "deal_stage": "lead|qualified|demo|proposal|negotiation|closed_won|closed_lost or null",
  "at_risk_only": true | false,
  "analytics_type": "pipeline" | "revenue" | "activity" | "tasks" | null,
  "action_type": "add_task" | "add_contact" | "update_deal" | null,
  "action_summary": "brief plain-English summary of the action, or null"
}

Intent rules:
- "lookup": searching for a specific person, deal, or company
- "analytics": asking about pipeline health, revenue, performance, at-risk deals, activity trends
- "action": wants to do something — add a task, log a contact, update a deal`,
      messages: [{ role: 'user', content: query }],
    })

    const rawText = intentResponse.content[0].type === 'text' ? intentResponse.content[0].text : '{}'
    const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    let params: any = {}
    try { params = JSON.parse(cleaned) } catch { params = { intent: 'lookup' } }

    const intent = params.intent ?? 'lookup'

    // ── LOOKUP ──────────────────────────────────────────────────────────────
    if (intent === 'lookup') {
      const [contactsRes, dealsRes, companiesRes] = await Promise.all([
        params.contact_query
          ? admin.from('contacts').select('id, full_name, role, companies(name), created_at').eq('user_id', user.id).ilike('full_name', `%${params.contact_query}%`).limit(5)
          : Promise.resolve({ data: [] }),
        (() => {
          let q = admin.from('deals').select('id, name, stage, value, last_activity_at, created_at').eq('user_id', user.id)
          if (params.deal_query) q = q.ilike('name', `%${params.deal_query}%`)
          if (params.deal_stage) q = q.eq('stage', params.deal_stage)
          return (params.deal_query || params.deal_stage) ? q.limit(5) : Promise.resolve({ data: [] })
        })(),
        params.company_query
          ? admin.from('companies').select('id, name, industry').eq('user_id', user.id).ilike('name', `%${params.company_query}%`).limit(5)
          : Promise.resolve({ data: [] }),
      ])

      return NextResponse.json({
        intent: 'lookup',
        contacts: contactsRes.data ?? [],
        deals: dealsRes.data ?? [],
        companies: companiesRes.data ?? [],
        mode: 'ai',
      })
    }

    // ── ANALYTICS ───────────────────────────────────────────────────────────
    if (intent === 'analytics') {
      const now = Date.now()

      const { data: allDeals } = await admin
        .from('deals')
        .select('id, name, stage, value, last_activity_at, created_at, payment_status, confirmed_revenue')
        .eq('user_id', user.id)

      const deals = allDeals ?? []

      // Pipeline breakdown by stage
      const stages = ['lead', 'qualified', 'demo', 'proposal', 'negotiation', 'closed_won', 'closed_lost']
      const pipelineByStage = stages.map(stage => ({
        stage,
        count: deals.filter((d: any) => d.stage === stage).length,
        value: deals.filter((d: any) => d.stage === stage).reduce((sum: number, d: any) => sum + (d.value ?? 0), 0),
      }))

      // At-risk deals (active, no activity 14+ days)
      const atRisk = deals.filter((d: any) => {
        if (['closed_won', 'closed_lost'].includes(d.stage)) return false
        const ref = d.last_activity_at ?? d.created_at
        return (now - new Date(ref).getTime()) / 86400000 > 14
      })

      // Revenue metrics
      const totalPipeline = deals
        .filter((d: any) => !['closed_won', 'closed_lost'].includes(d.stage))
        .reduce((sum: number, d: any) => sum + (d.value ?? 0), 0)
      const confirmedRevenue = deals
        .filter((d: any) => d.stage === 'closed_won')
        .reduce((sum: number, d: any) => sum + (d.confirmed_revenue ?? d.value ?? 0), 0)
      const activeDeals = deals.filter((d: any) => !['closed_won', 'closed_lost'].includes(d.stage)).length

      return NextResponse.json({
        intent: 'analytics',
        analytics_type: params.analytics_type ?? 'pipeline',
        metrics: {
          total_pipeline: totalPipeline,
          confirmed_revenue: confirmedRevenue,
          active_deals: activeDeals,
          at_risk_count: atRisk.length,
          won_count: deals.filter((d: any) => d.stage === 'closed_won').length,
          lost_count: deals.filter((d: any) => d.stage === 'closed_lost').length,
        },
        pipeline_by_stage: pipelineByStage,
        at_risk_deals: atRisk.slice(0, 3).map((d: any) => ({
          id: d.id,
          name: d.name,
          stage: d.stage,
          value: d.value,
          days_inactive: Math.floor((now - new Date(d.last_activity_at ?? d.created_at).getTime()) / 86400000),
        })),
      })
    }

    // ── ACTION ───────────────────────────────────────────────────────────────
    if (intent === 'action') {
      return NextResponse.json({
        intent: 'action',
        action_type: params.action_type,
        action_summary: params.action_summary ?? query,
        original_query: query,
      })
    }

    // Fallback
    return NextResponse.json({ intent: 'lookup', contacts: [], deals: [], companies: [], mode: 'ai' })

  } catch (error: any) {
    console.error('Search error:', error)
    return NextResponse.json({ intent: 'lookup', contacts: [], deals: [], companies: [] })
  }
}
