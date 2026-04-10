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
    const { data: membership } = await admin.from('organisation_members').select('org_id').eq('user_id', user.id).eq('status', 'active').limit(1).maybeSingle()
    const org_id = membership?.org_id

    const { query } = await request.json()
    if (!query?.trim()) return NextResponse.json({ contacts: [], deals: [], companies: [] })

    // Simple keyword search — fast, no Claude
    if (isSimpleQuery(query)) {
      const q = query.trim()
      const [contactsRes, dealsRes, companiesRes] = await Promise.all([
        admin.from('contacts').select('id, full_name, role, companies(name)').eq('user_id', user.id).ilike('full_name', `%${q}%`).limit(5),
        admin.from('deals').select('id, name, stage, value').eq('user_id', user.id).ilike('name', `%${q}%`).limit(5),
        admin.from('companies').select('id, name, industry').eq('user_id', user.id).ilike('name', `%${q}%`).limit(5),
      ])
      return NextResponse.json({
        contacts: contactsRes.data ?? [],
        deals: dealsRes.data ?? [],
        companies: companiesRes.data ?? [],
        mode: 'keyword',
      })
    }

    // Natural language search — Claude interprets
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: `You are a CRM search assistant. Convert natural language queries into structured search parameters.
Respond ONLY with valid JSON:
{
  "contact_query": "name or keyword to search contacts, or null",
  "deal_query": "name or keyword to search deals, or null",
  "company_query": "name or keyword to search companies, or null",
  "deal_stage": "lead|qualified|demo|proposal|negotiation|closed_won|closed_lost or null",
  "at_risk_only": true | false
}`,
      messages: [{ role: 'user', content: query }],
    })

    const rawText = response.content[0].type === 'text' ? response.content[0].text : '{}'
    const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    let params: any = {}
    try { params = JSON.parse(cleaned) } catch { params = {} }

    const results = await Promise.all([
      // Contacts
      params.contact_query
        ? admin.from('contacts').select('id, full_name, role, companies(name)').eq('user_id', user.id).ilike('full_name', `%${params.contact_query}%`).limit(5)
        : Promise.resolve({ data: [] }),

      // Deals
      (() => {
        let q = admin.from('deals').select('id, name, stage, value').eq('user_id', user.id)
        if (params.deal_query) q = q.ilike('name', `%${params.deal_query}%`)
        if (params.deal_stage) q = q.eq('stage', params.deal_stage)
        return params.deal_query || params.deal_stage ? q.limit(5) : Promise.resolve({ data: [] })
      })(),

      // Companies
      params.company_query
        ? admin.from('companies').select('id, name, industry').eq('user_id', user.id).ilike('name', `%${params.company_query}%`).limit(5)
        : Promise.resolve({ data: [] }),
    ])

    // If at_risk_only, also fetch at-risk deals
    let atRiskDeals: any[] = []
    if (params.at_risk_only) {
      const { data } = await admin.from('deals').select('id, name, stage, value, last_activity_at, created_at')
        .eq('user_id', user.id).not('stage', 'in', '(closed_won,closed_lost)')
      atRiskDeals = (data ?? []).filter((d: any) => {
        const ref = d.last_activity_at ?? d.created_at
        return (Date.now() - new Date(ref).getTime()) / 86400000 > 14
      })
    }

    return NextResponse.json({
      contacts: results[0].data ?? [],
      deals: [...(results[1].data ?? []), ...atRiskDeals],
      companies: results[2].data ?? [],
      mode: 'ai',
    })

  } catch (error: any) {
    console.error('Search error:', error)
    return NextResponse.json({ contacts: [], deals: [], companies: [] })
  }
}
