import Anthropic from '@anthropic-ai/sdk'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

const client = new Anthropic()

const SYSTEM_PROMPT = `You are a friendly onboarding assistant for Rollable, an AI-powered CRM. Your job is to learn about the user's business through a natural conversation — max 5 exchanges.

You need to discover:
1. Industry / what they sell
2. Typical sales cycle length (days)
3. What they call their pipeline stages (e.g. Lead → Demo → Proposal → Closed)
4. Team size (how many salespeople)
5. What they call their deals (deals / projects / cases / opportunities)
6. Their biggest sales challenge or pain point

Be conversational and warm. Ask one or two things at a time. After 5 exchanges, or when you have enough info, write a warm summary of what you learned, then end your message with a JSON block wrapped in <extract></extract> tags:

<extract>
{
  "industry": "string",
  "cycle_days": number,
  "stage_names": ["string"],
  "at_risk_days": number,
  "team_size": number,
  "terminology": "string",
  "pain_points": ["string"]
}
</extract>

Set at_risk_days to roughly 30% of cycle_days. Always include the extract block when done.`

export async function POST(req: Request) {
  const { message, history } = await req.json()

  const messages = [
    ...history,
    { role: 'user' as const, content: message },
  ]

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1000,
    system: SYSTEM_PROMPT,
    messages,
  })

  const reply = response.content[0].type === 'text' ? response.content[0].text : ''

  const extractMatch = reply.match(/<extract>([\s\S]*?)<\/extract>/)
  let context = null
  const displayReply = reply.replace(/<extract>[\s\S]*?<\/extract>/, '').trim()

  if (extractMatch) {
    try {
      context = JSON.parse(extractMatch[1].trim())

      // Save to organisations.context
      const supabase = await createServerSupabaseClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: membership } = await supabase
          .from('organisation_members')
          .select('org_id')
          .eq('user_id', user.id)
          .single()

        if (membership?.org_id) {
          await supabase
            .from('organisations')
            .update({ context })
            .eq('id', membership.org_id)
        }
      }
    } catch (e) {
      console.error('Failed to parse onboarding context', e)
    }
  }

  return NextResponse.json({
    reply: displayReply,
    history: [...messages, { role: 'assistant', content: reply }],
    context,
  })
}