import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import Anthropic from '@anthropic-ai/sdk'
import { getOrgContext } from '@/lib/org-context'
import { getVisibleFields, getFieldOptions } from '@/lib/onboarding-inference'
import { buildCaptureSchema } from '@/lib/capture-schema'
import { coerceRecordToNarrowedSet, type FieldOptions } from '@/lib/entity-fields'
import { logger } from '@/lib/logger'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Tuning knobs
const ROW_CAP        = 500   // hard upper bound — anything bigger, ask user to split
const BATCH_SIZE     = 30    // rows per Haiku call (safe under the 16k output ceiling)
const BATCH_PARALLEL = 3     // concurrent batches — keeps total time down without hammering the API
const MAX_TOKENS     = 16384

interface ExtractedContact {
  full_name: string | null
  company_name?: string | null
  [k: string]: any
}
interface ExtractedCompany {
  name: string | null
  [k: string]: any
}
interface ExtractedDeal {
  name: string | null
  company_name?: string | null
  contact_name?: string | null
  [k: string]: any
}

interface SpreadsheetResponse {
  contacts:  ExtractedContact[]
  companies: ExtractedCompany[]
  deals:     ExtractedDeal[]
  skipped:   number
  notes:     string
}

interface BatchResult {
  contacts:  ExtractedContact[]
  companies: ExtractedCompany[]
  deals:     ExtractedDeal[]
  skipped:   number
  notes:     string
  truncated: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Strip ```json fences Haiku occasionally adds even when told not to. */
function stripJsonFences(s: string): string {
  return s
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()
}

/** Run an async mapper over items with bounded concurrency. */
async function mapWithConcurrency<T, R>(
  items:    T[],
  limit:    number,
  fn:       (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let cursor = 0

  async function worker() {
    while (cursor < items.length) {
      const idx = cursor++
      results[idx] = await fn(items[idx], idx)
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

/** Build the prompt for one batch of rows. Schema + rules are stable across batches. */
function buildBatchPrompt(
  rows:    any[],
  schema:  ReturnType<typeof buildCaptureSchema>,
  batchIx: number,
  total:   number,
): string {
  const rowsText = JSON.stringify(rows, null, 0)

  return `You are a CRM data importer for Rollable. The user has uploaded a spreadsheet — this is batch ${batchIx + 1} of ${total}. Extract contacts, companies, and deals from these rows.

This may be an export from Salesforce, HubSpot, SuperOffice, Pipedrive, or any other CRM. Column names will vary — use your judgment to map them:
- "Opportunity", "Opportunity Name", "Deal Name", "Subject" → deal name
- "Amount", "Value", "Deal Value", "ARR", "MRR", "Revenue" → deal value (number, no currency symbol)
- "Stage", "Sales Stage", "Pipeline Stage", "Status" → deal stage
- "Close Date", "Expected Close", "Closing Date", "Due Date" → expected_close_date
- "Account", "Account Name", "Company", "Organisation" → company name
- "Contact", "Contact Name", "Full Name", "Name" → contact name
- "Owner", "Rep", "Assigned To" → ignore (not stored)

${schema.rationale}

ROWS:
${rowsText}

Respond ONLY with valid JSON in this exact format, no other text, no markdown fences:
{
  "contacts": [
    {
${schema.contactsSchema}
      "company_name": string or null
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
      "company_name": string or null,
      "contact_name": string or null
    }
  ],
  "skipped": 0,
  "notes": "One sentence describing what was found."
}

Rules:
- Extract ALL entity types present — contacts, companies, and deals
- A row may represent a deal (with a contact and company embedded) — extract all three from that row
- Only include contacts with a full_name — skip rows where no person name is identifiable
- Deduplicate companies within this batch — list each unique company once
- Deduplicate deals within this batch — list each unique deal once (by name)
- Map incoming stage values to the closest of: lead, qualified, demo, proposal, negotiation, closed_won, closed_lost
- deal value: number only (no currency symbols), or null
- phone: preserve as-is including country codes
- skipped: integer count of rows that had no extractable data
- Keep notes concise
${schema.enumGuidance ? `\nEnum guidance:\n${schema.enumGuidance}` : ''}`
}

/** Process one batch through Haiku. Returns raw extracted records + truncation flag. */
async function processBatch(
  rows:    any[],
  schema:  ReturnType<typeof buildCaptureSchema>,
  batchIx: number,
  total:   number,
): Promise<BatchResult> {
  const prompt = buildBatchPrompt(rows, schema, batchIx, total)

  const response = await anthropic.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: MAX_TOKENS,
    messages:   [{ role: 'user', content: prompt }],
  })

  const truncated = response.stop_reason === 'max_tokens'
  const rawText   = response.content[0].type === 'text' ? response.content[0].text : ''
  const cleaned   = stripJsonFences(rawText)

  let parsed: any
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    logger.error('capture/spreadsheet', `Batch ${batchIx + 1} parse failed`, { truncated, raw: rawText.slice(0, 500) })
    throw new Error(
      truncated
        ? `Batch ${batchIx + 1} too large — Haiku ran out of tokens. Try a smaller file.`
        : `Batch ${batchIx + 1} returned invalid JSON.`
    )
  }

  return {
    contacts:  Array.isArray(parsed.contacts)  ? parsed.contacts  : [],
    companies: Array.isArray(parsed.companies) ? parsed.companies : [],
    deals:     Array.isArray(parsed.deals)     ? parsed.deals     : [],
    skipped:   typeof parsed.skipped === 'number' ? parsed.skipped : 0,
    notes:     typeof parsed.notes === 'string'   ? parsed.notes   : '',
    truncated,
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

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

    if (rows.length > ROW_CAP) {
      return NextResponse.json({
        error: `Too many rows (${rows.length}). Please split your file into chunks of ${ROW_CAP} or fewer.`,
      }, { status: 413 })
    }

    // ─── Org context ────────────────────────────────────────────────────────
    const { data: membership } = await supabase
      .from('organisation_members')
      .select('org_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle()

    const orgId = membership?.org_id
    let visibleFields: { contacts: string[]; companies: string[]; deals: string[] } = { contacts: [], companies: [], deals: [] }
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

    // ─── Split into batches ─────────────────────────────────────────────────
    const batches: any[][] = []
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      batches.push(rows.slice(i, i + BATCH_SIZE))
    }

    // ─── Run batches with bounded concurrency ───────────────────────────────
    let batchResults: BatchResult[]
    try {
      batchResults = await mapWithConcurrency(
        batches,
        BATCH_PARALLEL,
        (batch, ix) => processBatch(batch, schema, ix, batches.length),
      )
    } catch (err: any) {
      // A single batch failure (parse error / truncation) fails the whole import.
      // Better to surface clearly than to silently drop rows.
      return NextResponse.json({ error: err.message ?? 'Batch processing failed' }, { status: 500 })
    }

    // ─── Merge results ──────────────────────────────────────────────────────
    const allContacts:    ExtractedContact[] = []
    const allCompaniesRaw: ExtractedCompany[] = []
    const allDealsRaw:    ExtractedDeal[] = []
    let totalSkipped = 0
    let anyTruncated = false

    for (const r of batchResults) {
      allContacts.push(...r.contacts)
      allCompaniesRaw.push(...r.companies)
      allDealsRaw.push(...r.deals)
      totalSkipped += r.skipped
      if (r.truncated) anyTruncated = true
    }

    // Dedupe companies across batches by lowercased name
    const companyMap = new Map<string, ExtractedCompany>()
    for (const c of allCompaniesRaw) {
      if (!c?.name) continue
      const key = c.name.trim().toLowerCase()
      if (!companyMap.has(key)) companyMap.set(key, c)
    }

    // Dedupe deals across batches by lowercased name
    const dealMap = new Map<string, ExtractedDeal>()
    for (const d of allDealsRaw) {
      if (!d?.name) continue
      const key = d.name.trim().toLowerCase()
      if (!dealMap.has(key)) dealMap.set(key, d)
    }

    const contactCount = allContacts.filter(c => c?.full_name).length
    const companyCount = companyMap.size
    const dealCount    = dealMap.size

    const summary = [
      contactCount > 0 ? `${contactCount} contact${contactCount !== 1 ? 's' : ''}` : '',
      companyCount > 0 ? `${companyCount} compan${companyCount !== 1 ? 'ies' : 'y'}` : '',
      dealCount    > 0 ? `${dealCount} deal${dealCount !== 1 ? 's' : ''}` : '',
    ].filter(Boolean).join(', ')

    // ─── Coerce to narrowed field options ───────────────────────────────────
    const out: SpreadsheetResponse = {
      contacts: allContacts
        .filter(c => c?.full_name)
        .map(c => coerceRecordToNarrowedSet('contacts', c, fieldOptions)),
      companies: Array.from(companyMap.values())
        .map(c => coerceRecordToNarrowedSet('companies', c, fieldOptions)),
      deals: Array.from(dealMap.values())
        .map(d => coerceRecordToNarrowedSet('deals', d, fieldOptions)),
      skipped: totalSkipped,
      notes: anyTruncated
        ? `${summary} extracted. Some batches were truncated — results may be incomplete.`
        : `${summary} extracted.`,
    }

    return NextResponse.json(out)

  } catch (error: any) {
    logger.error('capture/spreadsheet', 'Request failed', error)
    return NextResponse.json(
      { error: error.message || 'Spreadsheet capture failed' },
      { status: 500 }
    )
  }
}