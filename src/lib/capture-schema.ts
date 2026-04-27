// ─── Capture prompt schema builder ──────────────────────────────────────────
// Builds the JSON-schema-shaped instructions injected into Haiku's prompt for
// /api/capture and /api/capture/spreadsheet. The schema reflects:
//   - the org's visible_fields (which fields exist in the response)
//   - the org's field_options (narrowed enum sets, with rationale)
//   - the org's onboarding_scores (so Haiku understands *why* the set is narrow)
//
// Output is plain text — Haiku is told to return JSON shaped like the schema.
// We don't use tool-use / function calling here; the existing capture flow
// parses raw JSON from a text response and we keep that contract.

import {
  FIELD_REGISTRY,
  type EntityKey,
  type FieldDef,
  getEffectiveOptions,
  type FieldOptions,
} from './entity-fields'

export type CaptureEntityType = 'contacts' | 'companies' | 'deals'

export interface CaptureSchemaInput {
  visibleFields: Partial<Record<CaptureEntityType, string[]>>
  fieldOptions?: FieldOptions
  scores?: {
    deal_length?: number
    buyer_complexity?: number
    relationship_driven?: number
    pricing_complexity?: number
    competitiveness?: number
    data_maturity?: number
  }
}

// ─── Field type → JSON-ish hint for the prompt ──────────────────────────────

function fieldHint(f: FieldDef, narrowed: string[]): string {
  switch (f.type) {
    case 'text':     return 'string or null'
    case 'longtext': return 'string or null (free text, multiple sentences ok)'
    case 'email':    return 'email string or null'
    case 'phone':    return 'phone string with country code if visible, or null'
    case 'url':      return 'full URL or null'
    case 'date':     return 'ISO date YYYY-MM-DD or null'
    case 'datetime': return 'ISO datetime YYYY-MM-DDTHH:mm:ssZ or null'
    case 'currency': return 'number (no symbol) or null'
    case 'number':   return 'integer or null'
    case 'percent':  return 'number 0-100 or null'
    case 'tags':     return 'array of short string tags, or empty array'
    case 'enum': {
      const opts = narrowed.length > 0 ? narrowed : (f.options ?? [])
      return `one of [${opts.map(o => `"${o}"`).join(', ')}] or null`
    }
  }
}

function buildEntitySchema(
  entity: CaptureEntityType,
  visibleKeys: string[],
  fieldOptions?: FieldOptions,
): { schema: string; enumGuidance: string[] } {
  const fields = FIELD_REGISTRY[entity].filter(f => visibleKeys.includes(f.key))
  const lines: string[] = []
  const enumGuidance: string[] = []

  for (const f of fields) {
    const narrowed = f.type === 'enum'
      ? getEffectiveOptions(entity, f, fieldOptions)
      : []
    const hint = fieldHint(f, narrowed)
    lines.push(`    "${f.key}": ${hint}${f.label !== f.key ? `,  // ${f.label}` : ','}`)

    // Generate per-enum guidance for narrowed sets
    if (f.type === 'enum' && narrowed.length > 0 && f.options && narrowed.length < f.options.length) {
      const droppedRanks = f.options.filter(o => !narrowed.includes(o))
      enumGuidance.push(
        `- ${entity}.${f.key}: only [${narrowed.join(', ')}] are tracked. ` +
        `If the source mentions ${droppedRanks.slice(0, 3).join('/')}` +
        `${droppedRanks.length > 3 ? '/etc' : ''}, ` +
        (f.ordered
          ? `pick the closest tracked value (e.g. higher rank → highest tracked rank).`
          : `pick the best fit, or return null if none fits.`)
      )
    }
  }

  return {
    schema: lines.join('\n'),
    enumGuidance,
  }
}

// ─── Score → human rationale ────────────────────────────────────────────────
// Helps Haiku understand *why* the set is narrow.

function scoresRationale(scores?: CaptureSchemaInput['scores']): string {
  if (!scores) return ''
  const parts: string[] = []
  const s = scores
  if (s.buyer_complexity !== undefined) {
    if (s.buyer_complexity <= 2) parts.push('solo buyers (no committee), so seniority/role detail is light')
    else if (s.buyer_complexity >= 5) parts.push('buying committees, so seniority and department matter')
  }
  if (s.deal_length !== undefined) {
    if (s.deal_length <= 2) parts.push('transactional deals (days, not months)')
    else if (s.deal_length >= 5) parts.push('long sales cycles (months/years), expected close dates matter')
  }
  if (s.pricing_complexity !== undefined) {
    if (s.pricing_complexity >= 5) parts.push('custom pricing — invoice/PO refs and payment status tracked')
  }
  if (s.relationship_driven !== undefined) {
    if (s.relationship_driven >= 5) parts.push('relationship-driven sales — channels and follow-up cadence tracked')
  }
  if (s.data_maturity !== undefined) {
    if (s.data_maturity <= 2) parts.push('low data maturity — keep priority/source simple')
    else if (s.data_maturity >= 6) parts.push('analytics-driven — granular priorities (P0–P3) and lead sources used')
  }
  if (parts.length === 0) return ''
  return `Org context: ${parts.join('; ')}.`
}

// ─── Public API ─────────────────────────────────────────────────────────────

export interface BuiltSchema {
  /** Schema block for contacts[] entries */
  contactsSchema:  string
  /** Schema block for companies[] entries */
  companiesSchema: string
  /** Schema block for deals[] entries */
  dealsSchema:     string
  /** All per-field guidance for narrowed enums, joined */
  enumGuidance:    string
  /** Free-text rationale derived from slider scores */
  rationale:       string
}

export function buildCaptureSchema(input: CaptureSchemaInput): BuiltSchema {
  const visible = input.visibleFields ?? {}

  // Defaults — make sure key identity fields are always extractable even if
  // org config drops them, so the existing save path always has something to
  // anchor on (full_name, company.name, deal.name).
  const contactKeys  = ensureIncludes(visible.contacts  ?? [], ['full_name'])
  const companyKeys  = ensureIncludes(visible.companies ?? [], ['name'])
  const dealKeys     = ensureIncludes(visible.deals     ?? [], ['name'])

  const c = buildEntitySchema('contacts',  contactKeys,  input.fieldOptions)
  const co = buildEntitySchema('companies', companyKeys, input.fieldOptions)
  const d = buildEntitySchema('deals',      dealKeys,    input.fieldOptions)

  const enumGuidance = [...c.enumGuidance, ...co.enumGuidance, ...d.enumGuidance]

  return {
    contactsSchema:  c.schema,
    companiesSchema: co.schema,
    dealsSchema:     d.schema,
    enumGuidance:    enumGuidance.join('\n'),
    rationale:       scoresRationale(input.scores),
  }
}

function ensureIncludes(arr: string[], required: string[]): string[] {
  const set = new Set(arr)
  for (const r of required) set.add(r)
  return Array.from(set)
}
