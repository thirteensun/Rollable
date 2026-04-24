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

    const { rows } = await request.json()
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'No rows provided' }, { status: 400 })
    }

    // Cap at 200 rows to keep prompt size sane
    const capped = rows.slice(0, 200)
    const rowsText = JSON.stringify(capped, null, 0)

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `You are a CRM data importer for Rollable. The user has uploaded a spreadsheet. Extract contacts and companies from these rows.

ROWS:
${rowsText}

Respond ONLY with valid JSON in this exact format, no other text:
{
  "contacts": [
    {
      "full_name": "Full name (required — skip row if missing)",
      "role": "Job title or null",
      "email": "email or null",
      "phone": "phone or null",
      "company_name": "Company name or null"
    }
  ],
  "companies": [
    {
      "name": "Company name (required — deduplicated list)",
      "website": "website or null",
      "industry": "industry or null"
    }
  ],
  "skipped": 0,
  "notes": "One sentence describing what was found, e.g. '42 contacts from 8 companies extracted. 3 rows skipped (no name).'"
}

Rules:
- Only include contacts with a full_name — skip rows with no identifiable person name
- Deduplicate companies — list each unique company once
- Infer column meaning from header names (name, email, company, title, phone, etc.)
- If no headers exist, use position heuristics
- phone: preserve as-is including country codes
- skipped: integer count of rows excluded
- Keep notes concise`,
        },
      ],
    })

    const rawText = response.content[0].type === 'text' ? response.content[0].text : ''
    const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    let parsed: any
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      console.error('Failed to parse Haiku spreadsheet response:', rawText)
      return NextResponse.json({ error: 'Failed to parse AI response', raw: rawText }, { status: 500 })
    }

    return NextResponse.json(parsed)

  } catch (error: any) {
    console.error('Spreadsheet capture error:', error)
    return NextResponse.json({ error: error.message || 'Spreadsheet capture failed' }, { status: 500 })
  }
}