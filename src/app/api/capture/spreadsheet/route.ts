import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import Anthropic from '@anthropic-ai/sdk'
import { getOrgContext } from '@/lib/org-context'
import { getVisibleFields, getFieldOptions } from '@/lib/onboarding-inference'
import { buildCaptureSchema } from '@/lib/capture-schema'
import { coerceRecordToNarrowedSet, type FieldOptions } from '@/lib/entity-fields'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface ExtractedContact {
  full_name: string | null
  company_name?: string | null
  [k: string]: any
}
interface ExtractedCompany {
  name: string | null
  [k: string]: any
}

interface SpreadsheetResponse {
  contacts: ExtractedContact[]
  companies: ExtractedCompany[]
  skipped: number
  notes: string
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

    const { rows } = await request.json()
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'No rows provided' }, { status: 400 })
    }

    const capped = rows.slice(0, 200)
    const rowsText = JSON.stringify(capped, null, 0)

    // ─── Org context ────────────────────────────────────────────────────────
    const { data: membership } = await supabase
      .from('organisation_members')
      .select('org_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle()

    const orgId = membership?.org_id
    let visibleFields: { contacts: string[]; companies: string[] } = { contacts: [], companies: [] }
    let fieldOptions: FieldOptions = {}
    let scores: any = undefined

    if (orgId) {
      const orgCtx = await getOrgContext(orgId)
      visibleFields = {
        contacts:  getVisibleFields(orgCtx, 'contacts'),
        companies: getVisibleFields(orgCtx, 'companies'),
      }
      fieldOptions = {
        contacts:  getFieldOptions(orgCtx, 'contacts'),
        companies: getFieldOptions(orgCtx, 'companies'),
      }
      scores = orgCtx.onboarding_scores
    }

    // Pass through buildCaptureSchema with empty deals (no deals from sheets)
    const schema = buildCaptureSchema({
      visibleFields: { contacts: visibleFields.contacts, companies: visibleFields.companies, deals: [] },
      fieldOptions,
      scores,
    })

    const promptText = `You are a CRM data importer for Rollable. The user has uploaded a spreadsheet. Extract contacts and companies from these rows.

${schema.rationale}

ROWS:
${rowsText}

Respond ONLY with valid JSON in this exact format, no other text:
{
  "contacts": [
    {
${schema.contactsSchema}
      "company_name": string or null  // helper to link contact to a company
    }
  ],
  "companies": [
    {
${schema.companiesSchema}
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
- Keep notes concise
${schema.enumGuidance ? `\nEnum guidance:\n${schema.enumGuidance}` : ''}`

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{ role: 'user', content: promptText }],
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

    // ─── Coerce ─────────────────────────────────────────────────────────────
    const out: SpreadsheetResponse = {
      contacts:  (parsed.contacts  ?? [])
        .filter((c: any) => c?.full_name)
        .map((c: any) => coerceRecordToNarrowedSet('contacts',  c, fieldOptions)),
      companies: (parsed.companies ?? [])
        .filter((c: any) => c?.name)
        .map((c: any) => coerceRecordToNarrowedSet('companies', c, fieldOptions)),
      skipped:   typeof parsed.skipped === 'number' ? parsed.skipped : 0,
      notes:     typeof parsed.notes === 'string' ? parsed.notes : '',
    }

    return NextResponse.json(out)

  } catch (error: any) {
    console.error('Spreadsheet capture error:', error)
    return NextResponse.json({ error: error.message || 'Spreadsheet capture failed' }, { status: 500 })
  }
}