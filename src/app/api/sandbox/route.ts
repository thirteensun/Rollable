import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ─── Model helpers ────────────────────────────────────────────────────────────
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

// ─── Intent classifier ────────────────────────────────────────────────────────
// Returns 'action' | 'analytics'
async function classifyIntent(message: string): Promise<'action' | 'analytics'> {
  try {
    const res = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 10,
      system: `Classify this CRM message as either "action" or "analytics".

"action" = the user wants to CREATE, UPDATE, ADD, DELETE, or MODIFY data.
Examples: add a contact, create a deal, update stage, log invoice, add task, schedule follow-up, mark as done

"analytics" = the user wants to READ, ANALYSE, SUMMARISE, or UNDERSTAND data.
Examples: summarise pipeline, win rate, forecast, which deals need attention, show me contacts, search for X

Respond with ONLY the single word: action OR analytics`,
      messages: [{ role: 'user', content: message }],
    })
    const text = res.content[0].type === 'text' ? res.content[0].text.trim().toLowerCase() : 'analytics'
    return text === 'action' ? 'action' : 'analytics'
  } catch {
    return 'analytics' // safe fallback
  }
}

// ─── Action Agent tools ───────────────────────────────────────────────────────
const actionTools: Anthropic.Tool[] = [
  {
    name: 'add_contact',
    description: 'Add a new contact to the CRM or update an existing one',
    input_schema: {
      type: 'object' as const,
      properties: {
        full_name: { type: 'string' },
        company_name: { type: 'string' },
        role: { type: 'string' },
        email: { type: 'string' },
        phone: { type: 'string' },
      },
      required: ['full_name'],
    },
  },
  {
    name: 'find_contact',
    description: 'Search for a contact by name or company',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string' },
        company: { type: 'string' },
      },
    },
  },
  {
    name: 'add_company',
    description: 'Add a new company to the CRM',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Company name' },
        industry: { type: 'string' },
        website: { type: 'string' },
      },
      required: ['name'],
    },
  },
  {
    name: 'add_deal',
    description: 'Create a new deal or sales opportunity',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string' },
        company_name: { type: 'string' },
        value: { type: 'number' },
        stage: { type: 'string', enum: ['lead', 'qualified', 'demo', 'proposal', 'negotiation'] },
      },
      required: ['name'],
    },
  },
  {
    name: 'add_task',
    description: 'Create a follow-up task or reminder',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string' },
        contact_name: { type: 'string' },
        due_date: { type: 'string', description: 'ISO date e.g. 2026-04-20' },
      },
      required: ['title'],
    },
  },
  {
    name: 'search_crm',
    description: 'Search across contacts, companies and deals',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string' },
        type: { type: 'string', enum: ['contacts', 'companies', 'deals', 'all'] },
      },
      required: ['query'],
    },
  },
  {
    name: 'update_deal_stage',
    description: 'Update the stage of an existing deal',
    input_schema: {
      type: 'object' as const,
      properties: {
        deal_name: { type: 'string' },
        stage: { type: 'string', enum: ['lead', 'qualified', 'demo', 'proposal', 'negotiation', 'closed_won', 'closed_lost'] },
      },
      required: ['deal_name', 'stage'],
    },
  },
  {
    name: 'update_deal_financials',
    description: 'Update invoice/PO details and payment status on a deal',
    input_schema: {
      type: 'object' as const,
      properties: {
        deal_name: { type: 'string' },
        payment_status: { type: 'string', enum: ['none', 'invoiced', 'paid'] },
        invoice_ref: { type: 'string' },
        po_ref: { type: 'string' },
        invoice_date: { type: 'string' },
        po_date: { type: 'string' },
        confirmed_revenue: { type: 'number' },
      },
      required: ['deal_name'],
    },
  },
]

// ─── Analytics Agent tools ────────────────────────────────────────────────────
const analyticsTools: Anthropic.Tool[] = [
  {
    name: 'get_pipeline_summary',
    description: 'Get a summary of the sales pipeline — total value, count, at-risk deals, by stage, by rep',
    input_schema: {
      type: 'object' as const,
      properties: {
        filter: { type: 'string', enum: ['all', 'at_risk', 'closing_soon', 'by_stage', 'by_rep'] },
      },
    },
  },
  {
    name: 'search_crm',
    description: 'Search across contacts, companies and deals for analysis',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string' },
        type: { type: 'string', enum: ['contacts', 'companies', 'deals', 'all'] },
      },
      required: ['query'],
    },
  },
]

// ─── Tool executor ────────────────────────────────────────────────────────────
async function executeTool(
  toolName: string,
  toolInput: any,
  userId: string,
  orgId: string | null,
  role: string,
  admin: any
): Promise<string> {
  const isElevated = role === 'manager' || role === 'admin'

  switch (toolName) {
    case 'add_contact': {
      let company_id = null
      if (toolInput.company_name) {
        const { data: existingCo } = await admin.from('companies').select('id').eq('user_id', userId).ilike('name', toolInput.company_name).maybeSingle()
        if (existingCo) {
          company_id = existingCo.id
        } else {
          const { data: newCo } = await admin.from('companies').insert({ user_id: userId, name: toolInput.company_name, org_id: orgId }).select('id').maybeSingle()
          company_id = newCo?.id
        }
      }
      const { data: existing } = await admin.from('contacts').select('id').eq('user_id', userId).ilike('full_name', toolInput.full_name).maybeSingle()
      if (existing) {
        await admin.from('contacts').update({
          company_id: company_id || undefined,
          role: toolInput.role || undefined,
          email: toolInput.email || undefined,
          phone: toolInput.phone || undefined,
          last_contacted_at: new Date().toISOString(),
        }).eq('id', existing.id)
        return `Updated existing contact ${toolInput.full_name}.`
      }
      await admin.from('contacts').insert({
        user_id: userId, org_id: orgId, full_name: toolInput.full_name,
        company_id, role: toolInput.role || null, email: toolInput.email || null,
        phone: toolInput.phone || null, last_contacted_at: new Date().toISOString(),
      })
      return `Added ${toolInput.full_name}${toolInput.company_name ? ` from ${toolInput.company_name}` : ''} to your contacts.`
    }

    case 'find_contact': {
      let query = admin.from('contacts').select('full_name, role, email, phone, companies(name)').eq('user_id', userId)
      if (toolInput.name) query = query.ilike('full_name', `%${toolInput.name}%`)
      const { data } = await query.limit(5)
      if (!data?.length) return `No contacts found.`
      return data.map((c: any) => `${c.full_name}${c.role ? ` (${c.role})` : ''}${c.companies?.name ? ` at ${c.companies.name}` : ''} — ${c.email || 'no email'}`).join('\n')
    }

    case 'add_company': {
      const { data: existing } = await admin.from('companies').select('id').eq('user_id', userId).ilike('name', toolInput.name).maybeSingle()
      if (existing) return `${toolInput.name} already exists.`
      await admin.from('companies').insert({ user_id: userId, org_id: orgId, name: toolInput.name, industry: toolInput.industry || null, website: toolInput.website || null })
      return `Added ${toolInput.name} to your companies.`
    }

    case 'add_deal': {
      let company_id = null
      if (toolInput.company_name) {
        const { data: co } = await admin.from('companies').select('id').eq('user_id', userId).ilike('name', toolInput.company_name).maybeSingle()
        company_id = co?.id || null
      }
      await admin.from('deals').insert({
        user_id: userId, org_id: orgId, company_id,
        name: toolInput.name, value: toolInput.value || null,
        stage: toolInput.stage || 'lead', last_activity_at: new Date().toISOString(),
      })
      return `Created deal "${toolInput.name}"${toolInput.value ? ` worth €${toolInput.value.toLocaleString()}` : ''} at ${toolInput.stage || 'lead'} stage.`
    }

    case 'add_task': {
      let contact_id = null
      if (toolInput.contact_name) {
        const { data: contact } = await admin.from('contacts').select('id').eq('user_id', userId).ilike('full_name', `%${toolInput.contact_name}%`).maybeSingle()
        contact_id = contact?.id || null
      }
      await admin.from('tasks').insert({
        user_id: userId, org_id: orgId, contact_id,
        title: toolInput.title, due_date: toolInput.due_date || null, ai_generated: true,
      })
      return `Created task: "${toolInput.title}"${toolInput.due_date ? ` due ${new Date(toolInput.due_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}` : ''}.`
    }

    case 'search_crm': {
      const results: string[] = []
      const searchType = toolInput.type || 'all'
      const scopeFilter = (q: any) => isElevated && orgId ? q.eq('org_id', orgId) : q.eq('user_id', userId)
      if (searchType === 'all' || searchType === 'contacts') {
        const { data } = await scopeFilter(admin.from('contacts').select('full_name, role, companies(name)')).ilike('full_name', `%${toolInput.query}%`).limit(4)
        if (data?.length) results.push(`Contacts: ${data.map((c: any) => `${c.full_name}${c.companies?.name ? ` at ${c.companies.name}` : ''}`).join(', ')}`)
      }
      if (searchType === 'all' || searchType === 'companies') {
        const { data } = await scopeFilter(admin.from('companies').select('name, industry')).ilike('name', `%${toolInput.query}%`).limit(4)
        if (data?.length) results.push(`Companies: ${data.map((c: any) => c.name).join(', ')}`)
      }
      if (searchType === 'all' || searchType === 'deals') {
        const { data } = await scopeFilter(admin.from('deals').select('name, stage, value')).ilike('name', `%${toolInput.query}%`).limit(4)
        if (data?.length) results.push(`Deals: ${data.map((d: any) => `${d.name} (${d.stage}${d.value ? `, €${d.value.toLocaleString()}` : ''})`).join(', ')}`)
      }
      return results.length ? results.join('\n') : `No results for "${toolInput.query}".`
    }

    case 'get_pipeline_summary': {
      const filter = toolInput.filter || 'all'
      let query = admin.from('deals').select('id, name, stage, value, last_activity_at, user_id').not('stage', 'in', '("closed_won","closed_lost")')
      query = isElevated && orgId ? query.eq('org_id', orgId) : query.eq('user_id', userId)
      const { data: deals } = await query
      if (!deals?.length) return 'No active deals in the pipeline.'

      const total = deals.reduce((s: number, d: any) => s + (d.value || 0), 0)
      const now = Date.now()
      const atRisk = deals.filter((d: any) => (now - new Date(d.last_activity_at || 0).getTime()) / 86400000 > 14)
      const byStage = deals.reduce((acc: any, d: any) => {
        if (!acc[d.stage]) acc[d.stage] = { count: 0, value: 0 }
        acc[d.stage].count++; acc[d.stage].value += d.value || 0
        return acc
      }, {})

      let summary = `${isElevated ? 'Org pipeline' : 'Your pipeline'}: ${deals.length} active deals worth €${total.toLocaleString()}.\n\n`
      summary += `By stage:\n${Object.entries(byStage).map(([s, v]: any) => `  ${s}: ${v.count} deal${v.count > 1 ? 's' : ''}, €${v.value.toLocaleString()}`).join('\n')}\n\n`
      summary += atRisk.length > 0
        ? `At risk (14d+ no activity): ${atRisk.map((d: any) => d.name).join(', ')}`
        : 'No deals at risk.'
      return summary
    }

    case 'update_deal_stage': {
      const { data: deal } = await admin.from('deals').select('id, name').eq('user_id', userId).ilike('name', `%${toolInput.deal_name}%`).maybeSingle()
      if (!deal) return `Couldn't find a deal matching "${toolInput.deal_name}".`
      await admin.from('deals').update({ stage: toolInput.stage, last_activity_at: new Date().toISOString() }).eq('id', deal.id)
      return `Updated "${deal.name}" to ${toolInput.stage} stage.`
    }

    case 'update_deal_financials': {
      const { data: deal } = await admin.from('deals').select('id, name').eq('user_id', userId).ilike('name', `%${toolInput.deal_name}%`).maybeSingle()
      if (!deal) return `Couldn't find a deal matching "${toolInput.deal_name}".`
      const updates: any = {}
      if (toolInput.payment_status) updates.payment_status = toolInput.payment_status
      if (toolInput.invoice_ref) updates.invoice_ref = toolInput.invoice_ref
      if (toolInput.po_ref) updates.po_ref = toolInput.po_ref
      if (toolInput.invoice_date) updates.invoice_date = toolInput.invoice_date
      if (toolInput.po_date) updates.po_date = toolInput.po_date
      if (toolInput.confirmed_revenue != null) updates.confirmed_revenue = toolInput.confirmed_revenue
      await admin.from('deals').update(updates).eq('id', deal.id)
      return `Updated financials for "${deal.name}".`
    }

    default:
      return 'Unknown tool.'
  }
}

// ─── Agentic loop ─────────────────────────────────────────────────────────────
async function runAgentLoop(
  model: string,
  system: string,
  tools: Anthropic.Tool[],
  messages: Anthropic.MessageParam[],
  userId: string,
  orgId: string | null,
  role: string,
  admin: any
): Promise<{ reply: string; updatedMessages: Anthropic.MessageParam[] }> {
  let response = await anthropic.messages.create({ model, max_tokens: 1024, system, tools, messages })
  const extra: Anthropic.MessageParam[] = []

  while (response.stop_reason === 'tool_use') {
    const toolUseBlocks = response.content.filter(b => b.type === 'tool_use') as Anthropic.ToolUseBlock[]
    const toolResults: Anthropic.ToolResultBlockParam[] = []

    for (const toolUse of toolUseBlocks) {
      const result = await executeTool(toolUse.name, toolUse.input, userId, orgId, role, admin)
      toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: result })
    }

    extra.push({ role: 'assistant', content: response.content })
    extra.push({ role: 'user', content: toolResults })

    response = await anthropic.messages.create({ model, max_tokens: 1024, system, tools, messages: [...messages, ...extra] })
  }

  const textBlock = response.content.find(b => b.type === 'text') as Anthropic.TextBlock | undefined
  return { reply: textBlock?.text || 'Done.', updatedMessages: extra }
}

// ─── Rolling window — only last 6 messages sent to agent ─────────────────────
const AGENT_WINDOW = 6

function rollingWindow(messages: Anthropic.MessageParam[]): Anthropic.MessageParam[] {
  // Always keep an even number (user+assistant pairs) to avoid broken context
  const windowed = messages.slice(-AGENT_WINDOW)
  // Ensure first message is user role (agents expect user first)
  const firstUser = windowed.findIndex(m => m.role === 'user')
  return firstUser > 0 ? windowed.slice(firstUser) : windowed
}

// ─── POST handler ─────────────────────────────────────────────────────────────
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
      .select('org_id, role')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle()

    const org_id = membership?.org_id || null
    const role = membership?.role || 'member'

    const { message, agentHistory, conversationId, displayMessages } = await request.json()
    // agentHistory: rolling window of MessageParam[] for the agent (max 6)
    // displayMessages: full UI message array [{role, content, id, agent}] for saving to DB
    // conversationId: existing conversation to update, or null to create new

    // Classify intent in parallel with model fetch
    const [intent, model] = await Promise.all([
      classifyIntent(message),
      getLatestSonnetModel(),
    ])

    // Build agent messages — rolling window only, never full history
    const agentMessages: Anthropic.MessageParam[] = rollingWindow([
      ...(agentHistory || []),
      { role: 'user', content: message },
    ])

    const today = new Date().toISOString().split('T')[0]
    let reply = ''
    let updatedAgentHistory: Anthropic.MessageParam[] = []

    if (intent === 'action') {
      const system = `You are an AI sales assistant. Help the user manage their CRM — add contacts, create deals, update stages, log tasks, and search records.

Be concise and confirm every action you take in plain English.
For pipeline analysis or performance questions, let the user know those are better answered in the Analytics view.
Today's date: ${today}`

      const result = await runAgentLoop(model, system, actionTools, agentMessages, user.id, org_id, role, admin)
      reply = result.reply

      // Log write events
      const writeTools = ['add_contact', 'add_deal', 'add_task', 'add_company', 'update_deal_stage', 'update_deal_financials']
      const usedWrites = result.updatedMessages
        .flatMap((m: any) => Array.isArray(m.content) ? m.content : [])
        .filter((b: any) => b.type === 'tool_use' && writeTools.includes(b.name))

      if (usedWrites.length > 0) {
        await admin.from('events').insert({
          user_id: user.id, org_id,
          type: 'other', summary: reply,
          metadata: { source: 'sandbox_action', tools_used: usedWrites.map((b: any) => b.name) },
        })
      }

    } else {
      const isElevated = role === 'manager' || role === 'admin'
      const system = `You are a sales analytics assistant. Help the user understand their pipeline, performance, and what to focus on.

You have access to ${isElevated ? 'the full organisation pipeline' : 'your own deals'}.
Be direct and lead with the insight. Use numbers. If something looks bad, say so.
For actions like adding contacts or updating stages, tell the user they can just ask you directly.
Today's date: ${today}

CHARTS: When your answer is inherently visual (pipeline breakdown, revenue over time, win/loss ratio, stage comparison), append a JSON block after your text response using this exact format:

\`\`\`chart
{"type":"funnel","title":"Pipeline funnel","data":[{"label":"Lead","count":5,"value":50000},{"label":"Qualified","count":3,"value":30000}]}
\`\`\`

Chart types available:
- funnel: data=[{label,count,value}] — for pipeline stage breakdown
- bar: data=[{label,value,color?}] — for monthly revenue or comparisons  
- donut: segments=[{label,value,color}] — for win/loss ratio or proportions
- stages: data=[{label,value,count,color?}] — for horizontal stage value bars

Only include a chart when it genuinely adds value. Never include one for simple factual answers.
Proactively suggest a chart when the user asks about pipeline, revenue, or performance — even if they didn't ask for a chart.`

      const result = await runAgentLoop(model, system, analyticsTools, agentMessages, user.id, org_id, role, admin)
      reply = result.reply
    }

    // Parse chart JSON from reply if present
    let chartData = null
    let cleanReply = reply
    const chartMatch = reply.match(/```chart\n([\s\S]*?)\n```/)
    if (chartMatch) {
      try {
        chartData = JSON.parse(chartMatch[1].trim())
        cleanReply = reply.replace(/```chart\n[\s\S]*?\n```/, '').trim()
      } catch { /* ignore parse errors */ }
    }

    // New agent history for next turn (rolling window of what we just sent + reply)
    updatedAgentHistory = [
      ...(agentHistory || []).slice(-(AGENT_WINDOW - 2)),
      { role: 'user' as const, content: message },
      { role: 'assistant' as const, content: cleanReply },
    ]

    // Persist full display conversation to Supabase
    const assistantMsg: any = {
      role: 'assistant', content: cleanReply,
      id: `a-${Date.now()}`, agent: intent,
    }
    if (chartData) assistantMsg.chart = chartData

    const newDisplayMessages = [
      ...(displayMessages || []),
      { role: 'user', content: message, id: `u-${Date.now()}` },
      assistantMsg,
    ]

    let convId = conversationId
    const title = (displayMessages?.length === 0 || !displayMessages)
      ? message.slice(0, 60)  // first message becomes title
      : undefined

    if (convId) {
      // Update existing conversation
      await admin.from('conversations').update({
        messages: newDisplayMessages,
        ...(title ? { title } : {}),
      }).eq('id', convId).eq('user_id', user.id)
    } else {
      // Create new conversation
      const { data: newConv } = await admin.from('conversations').insert({
        user_id: user.id,
        org_id,
        source: 'sandbox',
        title: title || message.slice(0, 60),
        messages: newDisplayMessages,
      }).select('id').maybeSingle()
      convId = newConv?.id || null
    }

    return NextResponse.json({
      reply: cleanReply,
      agent: intent,
      chart: chartData,
      agentHistory: updatedAgentHistory,
      conversationId: convId,
      displayMessages: newDisplayMessages,
    })

  } catch (error: any) {
    console.error('Sandbox router error:', error)
    return NextResponse.json({ error: error.message || 'Sandbox failed' }, { status: 500 })
  }
}

// ─── GET handler — load last conversation on mount ────────────────────────────
export async function GET(request: NextRequest) {
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

    // Load most recent sandbox conversation
    const { data: conv } = await admin
      .from('conversations')
      .select('id, title, messages, updated_at')
      .eq('user_id', user.id)
      .eq('source', 'sandbox')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!conv) return NextResponse.json({ conversation: null })

    // Only restore if updated within last 24 hours
    const age = (Date.now() - new Date(conv.updated_at).getTime()) / 3600000
    if (age > 24) return NextResponse.json({ conversation: null })

    return NextResponse.json({ conversation: conv })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}