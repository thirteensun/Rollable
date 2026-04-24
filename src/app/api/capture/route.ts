import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import Anthropic from '@anthropic-ai/sdk'

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

    const { image, mimeType = 'image/jpeg' } = await request.json()
    if (!image) return NextResponse.json({ error: 'No image provided' }, { status: 400 })

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType as any,
                data: image,
              },
            },
            {
              type: 'text',
              text: `You are an AI assistant for a CRM called Rollable. Analyze this image and extract CRM-relevant information.

Respond ONLY with valid JSON in this exact format, no other text:
{
  "event_type": "meeting" | "call" | "email" | "card_scan" | "note" | "other",
  "summary": "One action-oriented CRM sentence describing what was captured and what should happen next. Be specific about names, companies, and amounts.",
  "contact_name": "Primary contact full name if present, otherwise null",
  "contacts": [
    {
      "full_name": "Full name",
      "role": "Job title or null",
      "company_name": "Company or null",
      "email": "email@example.com or null",
      "phone": "+1234567890 or null"
    }
  ],
  "company_name": "Primary company name if present, otherwise null",
  "deal_name": "Deal name if a deal is mentioned, otherwise null",
  "deal_value": 0,
  "follow_up_date": "YYYY-MM-DD if a follow-up date is mentioned, otherwise null",
  "creates": [
    { "type": "contact" | "deal" | "task" | "note", "label": "Short description e.g. Contact — John Smith" }
  ]
}

Rules:
- summary must be action-oriented (e.g. "Met John Smith from Acme Corp — add to contacts and schedule follow-up")
- contacts[] should list every person found in the image
- creates[] should list every CRM record that should be created
- deal_value should be a number with no currency symbols, 0 if not found
- If this is a business card, set event_type to "card_scan"
- If no CRM-relevant info found, return empty contacts[] and creates[]`,
            },
          ],
        },
      ],
    })

    const rawText = response.content[0].type === 'text' ? response.content[0].text : ''
    const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    let parsed: any
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      console.error('Failed to parse Claude response:', rawText)
      return NextResponse.json({ error: 'Failed to parse AI response', raw: rawText }, { status: 500 })
    }

    return NextResponse.json(parsed)

  } catch (error: any) {
    console.error('Capture error:', error)
    return NextResponse.json({ error: error.message || 'Capture failed' }, { status: 500 })
  }
}