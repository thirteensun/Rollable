import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

async function getLatestSonnetModel(): Promise<string> {
  try {
    const res = await fetch('https://api.anthropic.com/v1/models', {
      headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01' }
    })
    const data = await res.json()
    const sonnet = data.data
      ?.filter((m: any) => m.id.includes('sonnet'))
      .sort((a: any, b: any) => b.id.localeCompare(a.id))[0]
    return sonnet?.id ?? 'claude-sonnet-4-6'
  } catch {
    return 'claude-sonnet-4-6'
  }
}

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'add_contact',
    description: 'Add a new contact to the CRM',
    input_schema: {
      type: 'object' as const,
      properties: {
        first_name: { type: 'string' },
        last_name: { type: 'string' },
        email: { type: 'string' },
        phone: { type: 'string' },
        title: { type: 'string' },
        company_name: { type: 'string' },
      },
      required: ['first_name'],
    },
  },
  {
    name: 'find_contact',
    description: 'Search for an existing contact by name or email',
    input_schema: {
      type: 'object' as const,
      properties: { query: { type: 'string', description: 'Name or email to search for' } },
      required: ['query'],
    },
  },
  {
    name: 'add_company',
    description: 'Add a new company/account to the CRM',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string' },
        industry: { type: 'string' },
        website: { type: 'string' },
      },
      required: ['name'],
    },
  },
  {
    name: 'add_deal',
    description: 'Create a new deal in the pipeline',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string' },
        value: { type: 'number' },
        stage: { type: 'string', enum: ['lead', 'qualified', 'demo', 'proposal', 'negotiation', 'closed_won', 'closed_lost'] },
        company_name: { type: 'string' },
      },
      required: ['name'],
    },
  },
  {
    name: 'add_task',
    description: 'Create a task or follow-up action',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string' },
        due_date: { type: 'string', description: 'ISO date string' },
        priority: { type: 'string', enum: ['low', 'medium', 'high'] },
      },
      required: ['title'],
    },
  },
  {
    name: 'search_crm',
    description: 'Search across contacts, companies, and deals',
    input_schema: {
      type: 'object' as const,
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
  },
  {
    name: 'get_pipeline_summary',
    description: 'Get a summary of the current sales pipeline',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'update_deal_stage',
    description: 'Update the stage of an existing deal',
    input_schema: {
      type: 'object' as const,
      properties: {
        deal_name: { type: 'string' },
        new_stage: { type: 'string', enum: ['lead', 'qualified', 'demo', 'proposal', 'negotiation', 'closed_won', 'closed_lost'] },
      },
      required: ['deal_name', 'new_stage'],
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
]

export async function POST(req: NextRequest) {
  try {
    await cookies()
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: membership } = await supabase
      .from('organisation_members')
      .select('organisation_id')
      .eq('user_id', user.id)
      .single()

    const orgId = membership?.organisation_id
    const body = await req.json()
    const { messages } = body

    const model = await getLatestSonnetModel()

    // Agentic loop
    let currentMessages = [...messages]
    let finalText = ''

    while (true) {
      const response = await anthropic.messages.create({
        model,
        max_tokens: 1024,
        system: `You are an AI sales assistant for SDM CRM. You help salespeople log contacts, deals, tasks, and track financial progress effortlessly.

When users mention invoices, POs, or payments, always use update_deal_financials to record them.
Be concise and action-oriented. Confirm what you did in 1-2 sentences.
Today's date: ${new Date().toISOString().split('T')[0]}`,
        tools: TOOLS,
        messages: currentMessages,
      })

      if (response.stop_reason !== 'tool_use') {
        finalText = response.content
          .filter((b: any) => b.type === 'text')
          .map((b: any) => b.text)
          .join('')
        break
      }

      // Process tool calls
      const toolResults: Anthropic.ToolResultBlockParam[] = []

      for (const block of (response.content ?? [])) {
        if (block.type !== 'tool_use') continue
        const input = block.input as any
        let result = ''

        try {
          switch (block.name) {

            case 'add_contact': {
              let companyId: string | null = null
              if (input.company_name) {
                const { data: existing } = await supabase
                  .from('companies').select('id').ilike('name', input.company_name).limit(1).single()
                if (existing) {
                  companyId = existing.id
                } else {
                  const { data: newCo } = await supabase
                    .from('companies').insert({ name: input.company_name, organisation_id: orgId, created_by: user.id }).select('id').single()
                  companyId = newCo?.id ?? null
                }
              }
              const { data } = await supabase.from('contacts').insert({
                first_name: input.first_name, last_name: input.last_name,
                email: input.email, phone: input.phone, title: input.title,
                company_id: companyId, organisation_id: orgId, created_by: user.id,
              }).select('id').single()
              result = `Contact ${input.first_name} ${input.last_name ?? ''} added (id: ${data?.id})`
              break
            }

            case 'find_contact': {
              const { data } = await supabase.from('contacts')
                .select('id, first_name, last_name, email, title, companies(name)')
                .eq('organisation_id', orgId)
                .or(`first_name.ilike.%${input.query}%,last_name.ilike.%${input.query}%,email.ilike.%${input.query}%`)
                .limit(5)
              result = JSON.stringify(data ?? [])
              break
            }

            case 'add_company': {
              const { data } = await supabase.from('companies').insert({
                name: input.name, industry: input.industry, website: input.website,
                organisation_id: orgId, created_by: user.id,
              }).select('id').single()
              result = `Company ${input.name} added (id: ${data?.id})`
              break
            }

            case 'add_deal': {
              let companyId: string | null = null
              if (input.company_name) {
                const { data: co } = await supabase
                  .from('companies').select('id').ilike('name', input.company_name).limit(1).single()
                companyId = co?.id ?? null
              }
              const { data } = await supabase.from('deals').insert({
                name: input.name, value: input.value ?? null,
                stage: input.stage ?? 'lead', company_id: companyId,
                organisation_id: orgId, created_by: user.id,
              }).select('id').single()
              result = `Deal "${input.name}" created (id: ${data?.id})`
              break
            }

            case 'add_task': {
              const { data } = await supabase.from('tasks').insert({
                title: input.title, due_date: input.due_date ?? null,
                priority: input.priority ?? 'medium',
                organisation_id: orgId, created_by: user.id, assigned_to: user.id,
              }).select('id').single()
              result = `Task "${input.title}" created (id: ${data?.id})`
              break
            }

            case 'search_crm': {
              const q = input.query
              const [contacts, companies, deals] = await Promise.all([
                supabase.from('contacts').select('id, first_name, last_name, email').eq('organisation_id', orgId)
                  .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`).limit(3),
                supabase.from('companies').select('id, name').eq('organisation_id', orgId).ilike('name', `%${q}%`).limit(3),
                supabase.from('deals').select('id, name, value, stage').eq('organisation_id', orgId).ilike('name', `%${q}%`).limit(3),
              ])
              result = JSON.stringify({ contacts: contacts.data, companies: companies.data, deals: deals.data })
              break
            }

            case 'get_pipeline_summary': {
              const { data } = await supabase.from('deals')
                .select('stage, value').eq('organisation_id', orgId).not('stage', 'in', '(closed_lost)')
              const summary = (data ?? []).reduce((acc: any, d: any) => {
                acc[d.stage] = (acc[d.stage] ?? 0) + (d.value ?? 0)
                return acc
              }, {})
              result = JSON.stringify(summary)
              break
            }

            case 'update_deal_stage': {
              const { data: deals } = await supabase.from('deals')
                .select('id, name').eq('organisation_id', orgId).ilike('name', `%${input.deal_name}%`).limit(1)
              if (!deals?.length) { result = `Deal "${input.deal_name}" not found`; break }
              await supabase.from('deals').update({ stage: input.new_stage }).eq('id', deals[0].id)
              result = `Deal "${deals[0].name}" moved to ${input.new_stage}`
              break
            }

            case 'update_deal_financials': {
              const { data: deals } = await supabase.from('deals')
                .select('id, name').eq('organisation_id', orgId).ilike('name', `%${input.deal_name}%`).limit(1)
              if (!deals?.length) { result = `Deal "${input.deal_name}" not found`; break }

              const updates: any = {}
              if (input.payment_status) updates.payment_status = input.payment_status
              if (input.invoice_ref) updates.invoice_ref = input.invoice_ref
              if (input.po_ref) updates.po_ref = input.po_ref
              if (input.invoice_date) updates.invoice_date = input.invoice_date
              if (input.po_date) updates.po_date = input.po_date
              if (input.confirmed_revenue != null) updates.confirmed_revenue = input.confirmed_revenue

              await supabase.from('deals').update(updates).eq('id', deals[0].id)
              result = `Deal "${deals[0].name}" financials updated: ${JSON.stringify(updates)}`
              break
            }

            default:
              result = 'Unknown tool'
          }
        } catch (err) {
          result = `Error: ${err}`
        }

        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result })
      }

      currentMessages = [
        ...currentMessages,
        { role: 'assistant' as const, content: response.content },
        { role: 'user' as const, content: toolResults },
      ]
    }

    return NextResponse.json({ message: finalText })

  } catch (err) {
    console.error('Assistant route error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
