// ─── Entity field registry ───────────────────────────────────────────────────
// Single source of truth for every field on contact/company/deal.
// Keys MUST match the column names used in onboarding-inference.ts ALL_*_FIELDS.
// FieldGrid reads this. Capture prompt schema reads this.
//
// IMPORTANT: enum options here MUST match DB CHECK constraints exactly.
// Run this query to verify at any time:
//   SELECT table_name, constraint_name, check_clause
//   FROM information_schema.table_constraints tc
//   JOIN information_schema.check_constraints cc USING (constraint_name)
//   WHERE tc.table_name IN ('contacts','companies','deals') AND tc.constraint_type = 'CHECK'
//   ORDER BY table_name, constraint_name;
//
// Foreign-key entity links (company_id on contacts, contact_id/company_id on
// deals) are intentionally NOT in this registry — they render as linked
// entity cards in each detail client, not as form fields.

export type FieldType =
  | 'text'
  | 'longtext'
  | 'email'
  | 'phone'
  | 'url'
  | 'date'
  | 'datetime'
  | 'currency'
  | 'number'
  | 'percent'
  | 'enum'
  | 'tags'

export type FieldSection = 'core' | 'financial' | 'meta'
export type EntityType = 'contact' | 'company' | 'deal'

export interface FieldDef {
  key:           string
  label:         string
  type:          FieldType
  section:       FieldSection
  options?:      string[]                  // for enum — MUST match DB CHECK constraint values
  optionLabels?: Record<string, string>    // pretty labels for enum values
  ordered?:      boolean                   // enum: options are in semantic order (low → high)
                                           // — coercion clamps to nearest available in narrowed set
                                           // when false/undefined, coercion returns null on miss
}

// Plural form used by onboarding-inference.ts visible_fields keys
export type EntityKey = 'contacts' | 'companies' | 'deals'

// ─── Shared lead source options ──────────────────────────────────────────────
// contacts.lead_source and deals.lead_source share the same CHECK constraint:
//   referral, inbound, cold_outreach, event, partner, other
// contacts also allows: linkedin, website
// companies: referral, inbound, cold_outreach, event, partner, other (no linkedin/website)
//
// We define the superset here and keep companies narrower.

const CONTACT_LEAD_SOURCE_OPTIONS = [
  'referral', 'inbound', 'cold_outreach', 'event', 'linkedin', 'partner', 'website', 'other',
]
const COMPANY_LEAD_SOURCE_OPTIONS = [
  'referral', 'inbound', 'cold_outreach', 'event', 'partner', 'other',
]
const LEAD_SOURCE_LABELS: Record<string, string> = {
  referral:      'Referral',
  inbound:       'Inbound',
  cold_outreach: 'Cold outreach',
  event:         'Event',
  linkedin:      'LinkedIn',
  partner:       'Partner',
  website:       'Website',
  other:         'Other',
}

// ─── Contacts ────────────────────────────────────────────────────────────────

export const CONTACT_FIELDS: FieldDef[] = [
  // core
  { key: 'full_name', label: 'Full name', type: 'text', section: 'core' },
  { key: 'role',      label: 'Role',      type: 'text', section: 'core' },
  { key: 'email',     label: 'Email',     type: 'email', section: 'core' },
  { key: 'phone',     label: 'Phone',     type: 'phone', section: 'core' },

  // DB: status = ANY ('active','inactive','churned','do_not_contact')
  { key: 'status', label: 'Status', type: 'enum', section: 'core',
    options: ['active', 'inactive', 'churned', 'do_not_contact'],
    optionLabels: { do_not_contact: 'Do not contact' } },

  // DB: department = ANY ('sales','marketing','engineering','finance','legal',
  //                       'operations','hr','procurement','it','other')
  { key: 'department', label: 'Department', type: 'enum', section: 'core',
    options: ['sales', 'marketing', 'engineering', 'finance', 'legal',
              'operations', 'hr', 'procurement', 'it', 'other'],
    optionLabels: { hr: 'HR', it: 'IT' } },

  // DB: seniority_level IS NULL OR seniority_level = ANY ('intern','junior','mid',
  //                                                        'senior','lead','exec','c_level')
  // Note: contacts_seniority_check is a migration artifact — drop it if present.
  { key: 'seniority_level', label: 'Seniority', type: 'enum', section: 'core',
    options: ['intern', 'junior', 'mid', 'senior', 'lead', 'exec', 'c_level'],
    optionLabels: { mid: 'Mid-level', c_level: 'C-level' },
    ordered: true },

  // meta
  { key: 'linkedin_url',      label: 'LinkedIn',          type: 'url',      section: 'meta' },
  { key: 'twitter_url',       label: 'Twitter / X',       type: 'url',      section: 'meta' },
  { key: 'location',          label: 'Location',          type: 'text',     section: 'meta' },

  // DB: preferred_channel = ANY ('email','phone','whatsapp','linkedin','in_person','video_call')
  { key: 'preferred_channel', label: 'Preferred channel', type: 'enum', section: 'meta',
    options: ['email', 'phone', 'whatsapp', 'linkedin', 'in_person', 'video_call'],
    optionLabels: {
      whatsapp:   'WhatsApp',
      linkedin:   'LinkedIn',
      in_person:  'In person',
      video_call: 'Video call',
    } },

  // DB: lead_source = ANY ('referral','inbound','cold_outreach','event','linkedin','partner','website','other')
  // Previously type: 'text' — changed to enum so Haiku gets guidance and dropdowns render correctly.
  { key: 'lead_source', label: 'Lead source', type: 'enum', section: 'meta',
    options: CONTACT_LEAD_SOURCE_OPTIONS,
    optionLabels: LEAD_SOURCE_LABELS },

  { key: 'last_contacted_at',  label: 'Last contacted', type: 'datetime', section: 'meta' },
  { key: 'next_followup_date', label: 'Next follow-up', type: 'date',     section: 'meta' },
  { key: 'notes',              label: 'Notes',          type: 'longtext', section: 'meta' },
]

// ─── Companies ───────────────────────────────────────────────────────────────

export const COMPANY_FIELDS: FieldDef[] = [
  // core
  { key: 'name',     label: 'Name',     type: 'text', section: 'core' },

  // DB: type = ANY ('prospect','customer','partner','competitor','investor','other')
  // 'vendor' was in registry but is NOT in the DB constraint — removed.
  { key: 'type', label: 'Type', type: 'enum', section: 'core',
    options: ['prospect', 'customer', 'partner', 'competitor', 'investor', 'other'] },

  { key: 'industry', label: 'Industry', type: 'text', section: 'core' },
  { key: 'website',  label: 'Website',  type: 'url',  section: 'core' },

  // DB: status = ANY ('active','at_risk','churned','dormant')
  // 'inactive' was in registry but is NOT in the DB constraint — removed.
  { key: 'status', label: 'Status', type: 'enum', section: 'core',
    options: ['active', 'at_risk', 'churned', 'dormant'],
    optionLabels: { at_risk: 'At risk' } },

  // financial
  // DB: employee_count > 0 (check constraint — just a positive integer rule)
  { key: 'employee_count', label: 'Employees',      type: 'number',   section: 'financial' },
  { key: 'annual_revenue', label: 'Annual revenue', type: 'currency', section: 'financial' },

  // meta
  { key: 'linkedin_url', label: 'LinkedIn', type: 'url',  section: 'meta' },
  { key: 'city',         label: 'City',     type: 'text', section: 'meta' },
  { key: 'country',      label: 'Country',  type: 'text', section: 'meta' },

  // DB: lead_source = ANY ('referral','inbound','cold_outreach','event','partner','other')
  // Previously type: 'text' — changed to enum.
  // Note: companies constraint doesn't include 'linkedin' or 'website' (contacts-only).
  { key: 'lead_source', label: 'Lead source', type: 'enum', section: 'meta',
    options: COMPANY_LEAD_SOURCE_OPTIONS,
    optionLabels: LEAD_SOURCE_LABELS },

  { key: 'tags',  label: 'Tags',  type: 'tags',     section: 'meta' },
  { key: 'notes', label: 'Notes', type: 'longtext', section: 'meta' },
]

// ─── Deals ───────────────────────────────────────────────────────────────────

export const DEAL_FIELDS: FieldDef[] = [
  // core
  { key: 'name',  label: 'Name',  type: 'text', section: 'core' },

  { key: 'stage', label: 'Stage', type: 'enum', section: 'core',
    options: ['lead', 'qualified', 'demo', 'proposal', 'negotiation', 'closed_won', 'closed_lost'],
    optionLabels: { closed_won: 'Won', closed_lost: 'Lost' } },

  // DB: priority IS NULL OR priority = ANY ('low','medium','high','critical','p0','p1','p2','p3')
  { key: 'priority', label: 'Priority', type: 'enum', section: 'core',
    options: ['low', 'medium', 'high', 'critical', 'p0', 'p1', 'p2', 'p3'],
    optionLabels: { p0: 'P0', p1: 'P1', p2: 'P2', p3: 'P3' },
    ordered: true },

  // DB: deal_type IS NULL OR deal_type = ANY ('new_business','expansion','renewal','upsell','cross_sell','win_back')
  { key: 'deal_type', label: 'Deal type', type: 'enum', section: 'core',
    options: ['new_business', 'expansion', 'renewal', 'upsell', 'cross_sell', 'win_back'],
    optionLabels: {
      new_business: 'New business',
      cross_sell:   'Cross-sell',
      win_back:     'Win back',
    } },

  { key: 'expected_close_date', label: 'Expected close', type: 'date',    section: 'core' },
  { key: 'next_step',           label: 'Next step',      type: 'text',    section: 'core' },
  { key: 'probability',         label: 'Probability',    type: 'percent', section: 'core' },

  // financial
  { key: 'value',             label: 'Value',             type: 'currency', section: 'financial' },
  { key: 'currency',          label: 'Currency',          type: 'text',     section: 'financial' },
  { key: 'contracted_value',  label: 'Contracted value',  type: 'currency', section: 'financial' },
  { key: 'confirmed_revenue', label: 'Confirmed revenue', type: 'currency', section: 'financial' },
  { key: 'invoice_ref',       label: 'Invoice ref',       type: 'text',     section: 'financial' },
  { key: 'po_ref',            label: 'PO ref',            type: 'text',     section: 'financial' },
  { key: 'invoice_date',      label: 'Invoice date',      type: 'date',     section: 'financial' },
  { key: 'po_date',           label: 'PO date',           type: 'date',     section: 'financial' },

  // DB: payment_status IS NULL OR payment_status = ANY ('none','invoiced','partial','paid','overdue')
  { key: 'payment_status', label: 'Payment status', type: 'enum', section: 'financial',
    options: ['none', 'invoiced', 'partial', 'paid', 'overdue'],
    ordered: true },

  // meta
  // DB: lead_source = ANY ('referral','inbound','cold_outreach','event','partner','other')
  { key: 'lead_source', label: 'Lead source', type: 'enum', section: 'meta',
    options: COMPANY_LEAD_SOURCE_OPTIONS,  // same constraint as companies
    optionLabels: LEAD_SOURCE_LABELS },

  { key: 'competitors', label: 'Competitors', type: 'text',     section: 'meta' },
  { key: 'loss_reason', label: 'Loss reason', type: 'text',     section: 'meta' },
  { key: 'tags',        label: 'Tags',        type: 'tags',     section: 'meta' },
  { key: 'notes',       label: 'Notes',       type: 'longtext', section: 'meta' },
]

// ─── Lookup helpers ──────────────────────────────────────────────────────────

export const FIELD_REGISTRY: Record<EntityKey, FieldDef[]> = {
  contacts:  CONTACT_FIELDS,
  companies: COMPANY_FIELDS,
  deals:     DEAL_FIELDS,
}

export function getField(entity: EntityKey, key: string): FieldDef | undefined {
  return FIELD_REGISTRY[entity].find(f => f.key === key)
}

export function getVisibleFieldDefs(
  entity: EntityKey,
  visibleKeys: string[],
): FieldDef[] {
  return FIELD_REGISTRY[entity].filter(f => visibleKeys.includes(f.key))
}

export function groupBySection(fields: FieldDef[]): Record<FieldSection, FieldDef[]> {
  return {
    core:      fields.filter(f => f.section === 'core'),
    financial: fields.filter(f => f.section === 'financial'),
    meta:      fields.filter(f => f.section === 'meta'),
  }
}

export const SECTION_LABELS: Record<FieldSection, string> = {
  core:      'Details',
  financial: 'Financial',
  meta:      'More',
}

// ─── Field options override system ───────────────────────────────────────────
// Org context can specify a narrowed enum subset per field.
// Shape:
//   { contacts: { seniority_level: ['junior', 'senior'] },
//     deals:    { payment_status: ['none', 'paid'] } }
// FieldGrid uses this to narrow what shows in <select>.
// Falls back to registry's full superset when no override exists.

export type FieldOptions = Partial<Record<EntityKey, Record<string, string[]>>>

export function getEffectiveOptions(
  entity: EntityKey,
  field: FieldDef,
  fieldOptions?: FieldOptions,
): string[] {
  const override = fieldOptions?.[entity]?.[field.key]
  if (override && override.length > 0) {
    const supersetSet = new Set(field.options ?? [])
    return (field.options ?? []).filter(o => override.includes(o) && supersetSet.has(o))
  }
  return field.options ?? []
}

// ─── Coercion (safety net for Haiku enum outputs) ────────────────────────────
// When a write reaches the server with an enum value outside the org's narrowed
// set, coerce to the nearest available option. Used by /api/capture after
// Haiku response — Haiku is told to stay inside the narrowed set, but coercion
// is the safety net for hallucination or genuine outliers.
//
// Behaviour by field type:
//   - Ordered enum (ordered: true): clamp to nearest neighbour in narrowed set.
//   - Categorical enum (ordered: false/undef): returns null on miss.
//   - Value already inside narrowed set: passthrough.
//   - Value outside registry superset: returns null.
//   - Field is not an enum / has no narrowing: passthrough.

const PRIORITY_SCALES: string[][] = [
  ['low', 'medium', 'high', 'critical'],
  ['p0', 'p1', 'p2', 'p3'],
]

function pickPriorityScale(narrowed: string[]): string[] {
  let best = PRIORITY_SCALES[0]
  let bestHits = -1
  for (const scale of PRIORITY_SCALES) {
    const hits = narrowed.filter(v => scale.includes(v)).length
    if (hits > bestHits) { best = scale; bestHits = hits }
  }
  return best
}

function clampOrdered(
  value: string,
  scale: string[],
  narrowed: string[],
): string | null {
  const valueIdx = scale.indexOf(value)
  if (valueIdx < 0) return null

  const narrowedOnScale = narrowed
    .map(v => ({ v, idx: scale.indexOf(v) }))
    .filter(x => x.idx >= 0)

  if (narrowedOnScale.length === 0) return null

  let best = narrowedOnScale[0]
  let bestDist = Math.abs(best.idx - valueIdx)
  for (const cand of narrowedOnScale.slice(1)) {
    const d = Math.abs(cand.idx - valueIdx)
    if (d < bestDist || (d === bestDist && cand.idx < best.idx)) {
      best = cand
      bestDist = d
    }
  }
  return best.v
}

export function coerceToNarrowedSet(
  entity: EntityKey,
  fieldKey: string,
  value: unknown,
  fieldOptions?: FieldOptions,
): string | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string') return null

  const field = getField(entity, fieldKey)
  if (!field || field.type !== 'enum' || !field.options) return value as string

  const superset = field.options

  // Case-insensitive match against superset — handles Haiku capitalizing values
  const lowerValue = value.toLowerCase()
  const caseMatched = superset.find(o => o.toLowerCase() === lowerValue)
  if (caseMatched) {
    // Check it's in narrowed set
    const narrowed = getEffectiveOptions(entity, field, fieldOptions)
    if (narrowed.includes(caseMatched)) return caseMatched
    // In superset but not narrowed — fall through to coerce
    if (!field.ordered) return null
    return clampOrdered(caseMatched, superset, narrowed)
  }

  // Not in superset at all
  return null
}

// Bulk version: runs coercion across an entity record, returns a new object.
export function coerceRecordToNarrowedSet<T extends Record<string, any>>(
  entity: EntityKey,
  record: T,
  fieldOptions?: FieldOptions,
): T {
  const out: Record<string, any> = { ...record }
  for (const field of FIELD_REGISTRY[entity]) {
    if (field.type !== 'enum') continue
    if (!(field.key in out)) continue
    out[field.key] = coerceToNarrowedSet(entity, field.key, out[field.key], fieldOptions)
  }
  return out as T
}