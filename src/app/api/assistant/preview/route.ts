import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import Anthropic from '@anthropic-ai/sdk'
import { logger } from '@/lib/logger'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

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

    const { message } = await request.json()

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: message }],
      system: `You are a CRM assistant. Analyze the user's message and determine what CRM records they want to create or modify.

Respond ONLY with valid JSON, no other text:
{
  "needs_confirmation": true | false,
  "action_type": "create" | "update" | "search" | "other",
  "summary": "Plain English description of what will happen e.g. 'Add Jenny Smith from ABC Tech as a contact'",
  "creates": [
    { "type": "contact" | "deal" | "task" | "company", "label": "Short label e.g. Contact — Jenny Smith" }
  ]
}

Rules:
- needs_confirmation = true ONLY for create or update actions (add contact, create deal, add task, update stage, log invoice)
- needs_confirmation = false for searches, queries, pipeline summaries, or anything read-only
- creates[] lists every record that will be created or modified
- summary should be action-oriented and specific
- If the message is a greeting or unclear, set needs_confirmation = false and creates = []`,
    })

    const rawText = response.content[0].type === 'text' ? response.content[0].text : '{}'
    const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    let parsed: any
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      return NextResponse.json({ needs_confirmation: false, creates: [] })
    }

    return NextResponse.json(parsed)

  } catch (error: any) {
    logger.error('assistant/preview', 'Request failed', error)
    return NextResponse.json({ needs_confirmation: false, creates: [] })
  }
}
