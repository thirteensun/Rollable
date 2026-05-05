import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import Anthropic from '@anthropic-ai/sdk'
import { logUsage } from '@/lib/log-usage'
import { getOrgContext, formatOrgContextForPrompt } from '@/lib/org-context'
import { logger } from '@/lib/logger'

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
    name: 'add_contact',
    description: 'Add a new contact to the CRM or update an existing one',
    input_schema: {
      type: 'object' as const,
      properties: {
        full_name: { type: 'string', description: 'Full name of the contact' },
        company_name: { type: 'string', description: 'Company they work for' },
        role: { type: 'string', description: 'Job title or role' },
        email: { type: 'string', description: 'Email address' },
        phone: { type: 'string', description: 'Phone number' },
      },
      required: ['full_name'],
    },
  },
  {
    name: 'find_contact',
    description: 'Search for a contact by name or company and return their details',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Name to search for' },
        company: { type: 'string', description: 'Company to search in' },
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
        industry: { type: 'string', description: 'Industry sector' },
        website: { type: 'string', description: 'Website URL' },
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
        name: { type: 'string', description: 'Deal name' },
        company_name: { type: 'string', description: 'Company this deal is with' },
        value: { type: 'number', description: 'Deal value in euros' },
        stage: { type: 'string', enum: ['lead', 'qualified', 'demo', 'proposal', 'negotiation'], description: 'Deal stage' },
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
        title: { type: 'string', description: 'Task description' },
        contact_name: { type: 'string', description: 'Contact this task is for' },
        due_date: { type: 'string', description: 'Due date in ISO format e.g. 2026-04-10' },
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
        query: { type: 'string', description: 'Search term' },
        type: { type: 'string', enum: ['contacts', 'companies', 'deals', 'all'], description: 'What to search' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_pipeline_summary',
    description: 'Get a summary of the current sales pipeline and deals',
    input_schema: {
      type: 'object' as const,
      properties: {
        filter: { type: 'string', enum: ['all', 'at_risk', 'closing_soon'], description: 'Filter deals' },
      },
    },
  },
  {
    name: 'update_deal_stage',
    description: 'Update the stage of an existing deal',
    input_schema: {
      type: 'object' as const,
      properties: {
        deal_name: { type: 'string', description: 'Name of the deal to update' },
        stage: { type: 'string', enum: ['lead', 'qualified', 'demo', 'proposal', 'negotiation', 'closed_won', 'closed_lost'] },
      },
      required: ['deal_name', 'stage'],
    },
  },
  {
    name: 'update_deal_financials',
    description: 'Update invoice/PO details and payment status on a deal. Use when user mentions sending an invoice, receiving a PO, or confirming payment.',
    input_schema: {
      type: 'object' as const,
      properties: {
        deal_name: { type: 'string', description: 'Name or partial name of the deal' },
        payment_status: { type: 'string', enum: ['none', 'invoiced', 'paid'] },
        invoice_ref: { type: 'string', description: 'Invoice reference number' },
        po_ref: { type: 'string', description: 'Purchase order reference number' },
        invoice_date: { type: 'string', description: 'Invoice date as YYYY-MM-DD' },
        po_date: { type: 'string', description: 'PO date as YYYY-MM-DD' },
        confirmed_revenue: { type: 'number', description: 'Actual confirmed revenue amount' },
      },
      required: ['deal_name'],
    },
  },
  {
    name: 'log_note',
    description: 'Log a meeting note, call summary, or any activity against a contact, deal, or company. Use when the user describes something that happened — a call, meeting, email, demo, etc.',
    input_schema: {
      type: 'object' as const,
      properties: {
        summary: { type: 'string', description: 'What happened — write in past tense, e.g. "Called Sarah, she loved the demo and wants a proposal by Friday"' },
        event_type: { type: 'string', enum: ['call', 'meeting', 'email', 'demo', 'other'], description: 'Type of activity' },
        contact_name: { type: 'string', description: 'Name of the contact involved' },
        deal_name: { type: 'string', description: 'Name of the deal this relates to' },
        company_name: { type: 'string', description: 'Name of the company this relates to' },
      },
      required: ['summary'],
    },
  },
  {
    name: 'set_followup',
    description: 'Set or update the follow-up date on a contact. Use when the user says things like "remind me to follow up with X", "follow up with X next Tuesday", or "check in with X in 2 weeks". Also updates last_contacted_at.',
    input_schema: {
      type: 'object' as const,
      properties: {
        contact_name: { type: 'string', description: 'Name of the contact' },
        follow_up_date: { type: 'string', description: 'Date to follow up in ISO format e.g. 2026-05-12' },
      },
      required: ['contact_name', 'follow_up_date'],
    },
  },
]

async function executeTool(
  toolName: string,
  toolInput: any,
  userId: string,
  orgId: string | null,
  admin: any,
  isElevated: boolean
): Promise<string> {
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
      const { data: existing } = await admin.from('contacts').select('id, full_name').eq('user_id', userId).ilike('full_name', toolInput.full_name).maybeSingle()
      if (existing) {
        await admin.from('contacts').update({
          company_id: company_id || undefined,
          role: toolInput.role || undefined,
          email: toolInput.email || undefined,
          phone: toolInput.phone || undefined,
          last_contacted_at: new Date().toISOString(),
        }).eq('id', existing.id)
        return `Updated existing contact ${toolInput.full_name} with the new details.`
      }
      await admin.from('contacts').insert({
        user_id: userId, org_id: orgId, full_name: toolInput.full_name,
        company_id, role: toolInput.role || null, email: toolInput.email || null, phone: toolInput.phone || null,
        last_contacted_at: new Date().toISOString(),
      })
      return `Added ${toolInput.full_name}${toolInput.company_name ? ` from ${toolInput.company_name}` : ''} to your contacts.`
    }

    case 'find_contact': {
      let query = admin.from('contacts').select('full_name, role, email, phone, companies(name)')
      query = isElevated && orgId ? query.eq('org_id', orgId) : query.eq('user_id', userId)
      if (toolInput.name) query = query.ilike('full_name', `%${toolInput.name}%`)
      if (toolInput.company) query = query.ilike('companies.name', `%${toolInput.company}%`)
      const { data } = await query.limit(5)
      if (!data || data.length === 0) return `No contacts found matching your search.`
      return data.map((c: any) => `${c.full_name}${c.role ? ` (${c.role})` : ''}${c.companies?.name ? ` at ${c.companies.name}` : ''} — Email: ${c.email || 'not recorded'}, Phone: ${c.phone || 'not recorded'}`).join('\n')
    }

    case 'add_company': {
      const { data: existing } = await admin.from('companies').select('id').eq('user_id', userId).ilike('name', toolInput.name).maybeSingle()
      if (existing) return `${toolInput.name} already exists in your companies.`
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
      if (searchType === 'all' || searchType === 'contacts') {
        let q = admin.from('contacts').select('full_name, role, email, phone, companies(name)').ilike('full_name', `%${toolInput.query}%`).limit(3)
        q = isElevated && orgId ? q.eq('org_id', orgId) : q.eq('user_id', userId)
        const { data } = await q
        if (data?.length) results.push(`Contacts: ${data.map((c: any) => `${c.full_name}${c.companies?.name ? ` at ${c.companies.name}` : ''}`).join(', ')}`)
      }
      if (searchType === 'all' || searchType === 'companies') {
        let q = admin.from('companies').select('name, industry').ilike('name', `%${toolInput.query}%`).limit(3)
        q = isElevated && orgId ? q.eq('org_id', orgId) : q.eq('user_id', userId)
        const { data } = await q
        if (data?.length) results.push(`Companies: ${data.map((c: any) => c.name).join(', ')}`)
      }
      if (searchType === 'all' || searchType === 'deals') {
        let q = admin.from('deals').select('name, stage, value').ilike('name', `%${toolInput.query}%`).limit(3)
        q = isElevated && orgId ? q.eq('org_id', orgId) : q.eq('user_id', userId)
        const { data } = await q
        if (data?.length) results.push(`Deals: ${data.map((d: any) => `${d.name} (${d.stage}${d.value ? `, €${d.value.toLocaleString()}` : ''})`).join(', ')}`)
      }
      return results.length ? results.join('\n') : `No results found for "${toolInput.query}".`
    }

    case 'get_pipeline_summary': {
      let q = admin.from('deals').select('name, stage, value, last_activity_at').not('stage', 'in', '("closed_won","closed_lost")')
      q = isElevated && orgId ? q.eq('org_id', orgId) : q.eq('user_id', userId)
      const { data: deals } = await q
      if (!deals?.length) return 'No active deals in the pipeline.'
      const total = deals.reduce((s: number, d: any) => s + (d.value || 0), 0)
      const atRisk = deals.filter((d: any) => {
        const days = (Date.now() - new Date(d.last_activity_at || d.created_at).getTime()) / 86400000
        return days > 14
      })
      return `${isElevated ? 'Org pipeline' : 'Your pipeline'}: ${deals.length} active deals worth €${total.toLocaleString()} total. ${atRisk.length > 0 ? `${atRisk.length} at risk: ${atRisk.map((d: any) => d.name).join(', ')}.` : 'No deals at risk.'}`
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
      return `Updated financials for "${deal.name}": ${Object.entries(updates).map(([k, v]) => `${k} = ${v}`).join(', ')}.`
    }

    case 'log_note': {
      let contact_id: string | null = null
      let deal_id: string | null = null
      let company_id: string | null = null

      if (toolInput.contact_name) {
        const { data: c } = await admin.from('contacts').select('id').eq('user_id', userId).ilike('full_name', `%${toolInput.contact_name}%`).maybeSingle()
        contact_id = c?.id || null
        if (contact_id) {
          await admin.from('contacts').update({ last_contacted_at: new Date().toISOString() }).eq('id', contact_id)
        }
      }
      if (toolInput.deal_name) {
        const { data: d } = await admin.from('deals').select('id').eq('user_id', userId).ilike('name', `%${toolInput.deal_name}%`).maybeSingle()
        deal_id = d?.id || null
        if (deal_id) {
          await admin.from('deals').update({ last_activity_at: new Date().toISOString() }).eq('id', deal_id)
        }
      }
      if (toolInput.company_name) {
        const { data: co } = await admin.from('companies').select('id').eq('user_id', userId).ilike('name', `%${toolInput.company_name}%`).maybeSingle()
        company_id = co?.id || null
      }

      await admin.from('events').insert({
        user_id: userId, org_id: orgId,
        contact_id, deal_id, company_id,
        type: toolInput.event_type || 'other',
        summary: toolInput.summary,
        ai_confidence: 0.95,
        metadata: { source: 'assistant' },
      })
      return `Logged note: "${toolInput.summary}"${contact_id || deal_id ? ` — linked to ${[toolInput.contact_name, toolInput.deal_name].filter(Boolean).join(' / ')}` : ''}.`
    }

    case 'set_followup': {
      const { data: contact } = await admin.from('contacts').select('id, full_name').eq('user_id', userId).ilike('full_name', `%${toolInput.contact_name}%`).maybeSingle()
      if (!contact) return `Couldn't find a contact matching "${toolInput.contact_name}".`
      await admin.from('contacts').update({
        next_followup_date: toolInput.follow_up_date,
        last_contacted_at: new Date().toISOString(),
      }).eq('id', contact.id)
      const formatted = new Date(toolInput.follow_up_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
      return `Follow-up with ${contact.full_name} set for ${formatted}. AI Signals will flag this if it passes without activity.`
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
    const isElevated = role === 'manager' || role === 'admin'

    // Fetch org context
    const orgContext = org_id ? await getOrgContext(org_id) : {}
    const orgContextBlock = formatOrgContextForPrompt(orgContext)

    const { message, history } = await request.json()

    const messages: Anthropic.MessageParam[] = [
      ...(history || []),
      { role: 'user', content: message },
    ]

    const systemPrompt = `You are an AI sales assistant built into a CRM app. You help salespeople manage their contacts, companies, deals and tasks through natural conversation.

Be concise and friendly — like a smart colleague, not a formal assistant. Always confirm what you did in plain English.

You have access to ${isElevated ? 'the full organisation pipeline and all team data' : 'your own contacts, deals, and tasks'}.
User role: ${role}
Today's date: ${new Date().toISOString().split('T')[0]}

${orgContextBlock ? `${orgContextBlock}\n\nUse this context to personalise your language — e.g. use their terminology for deals, reference their pipeline stages by name, and flag deals that exceed their at-risk threshold.` : ''}

When users ask you to:
- Add/update contacts or companies → use add_contact or add_company tools
- Find or look up info → use find_contact or search_crm tools
- Create deals → use add_deal tool
- Schedule follow-ups or tasks → use add_task tool
- Check pipeline status → use get_pipeline_summary tool
- Move deals forward → use update_deal_stage tool
- Log invoices, POs, or payments → use update_deal_financials tool
- Log a meeting, call, demo, or any activity → use log_note tool
- Set a follow-up reminder for a contact → use set_followup tool

Always use tools to take real action — never just describe what you would do.
After using a tool, summarise what you did in 1-2 sentences.`

    const model = await getLatestSonnetModel()

    let response = await anthropic.messages.create({
      model,
      max_tokens: 1024,
      system: systemPrompt,
      tools,
      messages,
    })

    const assistantMessages: Anthropic.MessageParam[] = []
    let inputTokens = response.usage.input_tokens
    let outputTokens = response.usage.output_tokens

    while (response.stop_reason === 'tool_use') {
      const toolUseBlocks = response.content.filter(b => b.type === 'tool_use') as Anthropic.ToolUseBlock[]
      const toolResults: Anthropic.ToolResultBlockParam[] = []

      for (const toolUse of toolUseBlocks) {
        const result = await executeTool(toolUse.name, toolUse.input, user.id, org_id, admin, isElevated)
        toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: result })
      }

      assistantMessages.push({ role: 'assistant', content: response.content })
      assistantMessages.push({ role: 'user', content: toolResults })

      response = await anthropic.messages.create({
        model,
        max_tokens: 1024,
        system: systemPrompt,
        tools,
        messages: [...messages, ...assistantMessages],
      })
      inputTokens += response.usage.input_tokens
      outputTokens += response.usage.output_tokens
    }

    const textBlock = response.content.find(b => b.type === 'text') as Anthropic.TextBlock | undefined
    const reply = textBlock?.text || 'Done.'
    logUsage({ orgId: org_id, userId: user.id, route: 'assistant', model, inputTokens, outputTokens })

    // Log event if any write tools were used
    const writeTools = ['add_contact', 'add_deal', 'add_task', 'add_company', 'update_deal_stage', 'update_deal_financials', 'log_note', 'set_followup']
    const usedWriteTools = assistantMessages
      .flatMap((m: any) => Array.isArray(m.content) ? m.content : [])
      .filter((b: any) => b.type === 'tool_use' && writeTools.includes(b.name))

    if (usedWriteTools.length > 0) {
      const userMessage = messages[messages.length - 1]
      const userText = typeof userMessage?.content === 'string' ? userMessage.content : ''
      await admin.from('events').insert({
        user_id: user.id,
        org_id,
        type: 'other',
        summary: reply,
        metadata: {
          source: 'assistant',
          user_message: userText,
          tools_used: usedWriteTools.map((b: any) => b.name),
        },
      })
    }

    return NextResponse.json({ reply, history: [...messages, { role: 'assistant', content: reply }] })

  } catch (error: any) {
    logger.error('assistant', 'Request failed', error)
    return NextResponse.json({ error: error.message || 'Assistant failed' }, { status: 500 })
  }
}
