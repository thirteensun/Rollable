import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import Anthropic from '@anthropic-ai/sdk'
import { getOrgContext } from '@/lib/org-context'
import { getVisibleFields, getFieldOptions } from '@/lib/onboarding-inference'
import { buildCaptureSchema } from '@/lib/capture-schema'
import { coerceRecordToNarrowedSet, type EntityKey, type FieldOptions } from '@/lib/entity-fields'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface ExtractedContact { full_name: string | null; [k: string]: any }
interface ExtractedCompany { name: string | null; [k: string]: any }
interface ExtractedDeal    { name: string | null; [k: string]: any }

interface CaptureResponse {
  // Envelope (kept for backward compat with confirm UI)
  event_type: string
  summary: string
  contact_name: string | null
  company_name: string | null
  deal_name: string | null
  deal_value: number | null
  follow_up_date: string | null
  contacts: { full_name: string; role?: string; company_name?: string; email?: string; phone?: string }[]
  creates: { type: 'contact' | 'company' | 'deal' | 'task' | 'note'; label: string }[]

  // New: registry-keyed extracted fields, coerced to narrowed sets
  extracted: {
    contacts:  ExtractedContact[]
    companies: ExtractedCompany[]
    deals:     ExtractedDeal[]
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

    const { image, mimeType = 'image/jpeg' } = await request.json()
    if (!image) return NextResponse.json({ error: 'No image provided' }, { status: 400 })

    // ─── Resolve org context ────────────────────────────────────────────────
    const { data: membership } = await supabase
      .from('organisation_members')
      .select('org_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle()

    const orgId = membership?.org_id
    let visibleFields: { contacts: string[]; companies: string[]; deals: string[] } = {
      contacts: [], companies: [], deals: [],
    }
    let fieldOptions: FieldOptions = {}
    let scores: any = undefined

    if (orgId) {
      const orgCtx = await getOrgContext(orgId)
      visibleFields = {
        contacts:  getVisibleFields(orgCtx, 'contacts'),
        companies: getVisibleFields(orgCtx, 'companies'),
        deals:     getVisibleFields(orgCtx, 'deals'),
      }
      fieldOptions = {
        contacts:  getFieldOptions(orgCtx, 'contacts'),
        companies: getFieldOptions(orgCtx, 'companies'),
        deals:     getFieldOptions(orgCtx, 'deals'),
      }
      scores = orgCtx.onboarding_scores
    }

    const schema = buildCaptureSchema({ visibleFields, fieldOptions, scores })

    // ─── Build prompt ───────────────────────────────────────────────────────
    const promptText = `You are an AI assistant for a CRM called Rollable. Analyze this image and extract CRM-relevant information.

${schema.rationale}

Respond ONLY with valid JSON in this exact format, no other text:
{
  "event_type": "meeting" | "call" | "email" | "card_scan" | "note" | "other",
  "summary": "One action-oriented CRM sentence describing what was captured and what should happen next. Be specific about names, companies, and amounts.",
  "extracted": {
    "contacts": [
      {
${schema.contactsSchema}
      }
    ],
    "companies": [
      {
${schema.companiesSchema}
      }
    ],
    "deals": [
      {
${schema.dealsSchema}
      }
    ]
  },
  "follow_up_date": "YYYY-MM-DD if a follow-up date is mentioned, otherwise null",
  "creates": [
    { "type": "contact" | "company" | "deal" | "task" | "note", "label": "Short description e.g. Contact — John Smith" }
  ]
}

Rules:
- summary must be action-oriented (e.g. "Met John Smith from Acme Corp — add to contacts and schedule follow-up")
- extracted.contacts[] should list every person found in the image, with one object per person filling the fields shown above
- extracted.companies[] should list each company found, deduplicated
- extracted.deals[] should list each deal mentioned, with monetary amounts as numbers (no currency symbols)
- creates[] should list every CRM record that should be created — one entry per contact/company/deal/task
- If this is a business card, set event_type to "card_scan"
- If no CRM-relevant info found, return empty arrays in extracted and empty creates[]
${schema.enumGuidance ? `\nEnum guidance:\n${schema.enumGuidance}` : ''}`

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mimeType as any, data: image } },
            { type: 'text', text: promptText },
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

    // ─── Coerce extracted fields to narrowed sets ───────────────────────────
    const extracted = parsed.extracted ?? { contacts: [], companies: [], deals: [] }

    const coerced: CaptureResponse['extracted'] = {
      contacts:  (extracted.contacts  ?? []).map((c: any) => coerceRecordToNarrowedSet('contacts',  c, fieldOptions)),
      companies: (extracted.companies ?? []).map((c: any) => coerceRecordToNarrowedSet('companies', c, fieldOptions)),
      deals:     (extracted.deals     ?? []).map((d: any) => coerceRecordToNarrowedSet('deals',     d, fieldOptions)),
    }

    // ─── Backfill envelope from extracted (so existing save path & confirm UI keep working) ───
    const firstContact = coerced.contacts[0]
    const firstCompany = coerced.companies[0]
    const firstDeal    = coerced.deals[0]

    const envelope: Omit<CaptureResponse, 'extracted'> = {
      event_type:     parsed.event_type ?? 'note',
      summary:        parsed.summary ?? '',
      contact_name:   firstContact?.full_name ?? null,
      company_name:   firstCompany?.name ?? null,
      deal_name:      firstDeal?.name ?? null,
      deal_value:     typeof firstDeal?.value === 'number' ? firstDeal.value : null,
      follow_up_date: parsed.follow_up_date ?? null,
      contacts:       coerced.contacts.filter(c => c.full_name).map(c => ({
        full_name:    c.full_name as string,
        role:         c.role ?? undefined,
        company_name: c.company_name ?? firstCompany?.name ?? undefined,
        email:        c.email ?? undefined,
        phone:        c.phone ?? undefined,
      })),
      creates:        Array.isArray(parsed.creates) ? parsed.creates : [],
    }

    const out: CaptureResponse = { ...envelope, extracted: coerced }
    return NextResponse.json(out)

  } catch (error: any) {
    console.error('Capture error:', error)
    return NextResponse.json({ error: error.message || 'Capture failed' }, { status: 500 })
  }
}