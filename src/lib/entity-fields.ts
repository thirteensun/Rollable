// ─── Entity field registry ───────────────────────────────────────────────────
// Single source of truth for every field on contact/company/deal.
// Keys MUST match the column names used in onboarding-inference.ts ALL_*_FIELDS.
// FieldGrid reads this. Capture prompt schema (tomorrow) reads this.
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
  options?:      string[]                  // for enum
  optionLabels?: Record<string, string>    // pretty labels for enum values
}

// Plural form used by onboarding-inference.ts visible_fields keys
export type EntityKey = 'contacts' | 'companies' | 'deals'

// ─── Contacts ────────────────────────────────────────────────────────────────

export const CONTACT_FIELDS: FieldDef[] = [
  // core
  { key: 'full_name',          label: 'Full name',         type: 'text',     section: 'core' },
  { key: 'role',               label: 'Role',              type: 'text',     section: 'core' },
  { key: 'email',              label: 'Email',             type: 'email',    section: 'core' },
  { key: 'phone',              label: 'Phone',             type: 'phone',    section: 'core' },
  { key: 'status',             label: 'Status',            type: 'enum',     section: 'core',
    options: ['active', 'inactive', 'do_not_contact'] },
  { key: 'department',         label: 'Department',        type: 'text',     section: 'core' },
  { key: 'seniority_level',    label: 'Seniority',         type: 'enum',     section: 'core',
    options: ['intern', 'junior', 'mid', 'senior', 'lead', 'exec', 'c_level'],
    optionLabels: { mid: 'Mid-level', c_level: 'C-level' } },

  // meta
  { key: 'linkedin_url',       label: 'LinkedIn',          type: 'url',      section: 'meta' },
  { key: 'twitter_url',        label: 'Twitter / X',       type: 'url',      section: 'meta' },
  { key: 'location',           label: 'Location',          type: 'text',     section: 'meta' },
  { key: 'preferred_channel',  label: 'Preferred channel', type: 'enum',     section: 'meta',
    options: ['email', 'phone', 'whatsapp', 'linkedin', 'in_person'] },
  { key: 'lead_source',        label: 'Lead source',       type: 'text',     section: 'meta' },
  { key: 'last_contacted_at',  label: 'Last contacted',    type: 'datetime', section: 'meta' },
  { key: 'next_followup_date', label: 'Next follow-up',    type: 'date',     section: 'meta' },
  { key: 'notes',              label: 'Notes',             type: 'longtext', section: 'meta' },
]

// ─── Companies ───────────────────────────────────────────────────────────────

export const COMPANY_FIELDS: FieldDef[] = [
  // core
  { key: 'name',           label: 'Name',           type: 'text',     section: 'core' },
  { key: 'type',           label: 'Type',           type: 'enum',     section: 'core',
    options: ['prospect', 'customer', 'partner', 'vendor'] },
  { key: 'industry',       label: 'Industry',       type: 'text',     section: 'core' },
  { key: 'website',        label: 'Website',        type: 'url',      section: 'core' },
  { key: 'status',         label: 'Status',         type: 'enum',     section: 'core',
    options: ['active', 'inactive', 'churned'] },

  // financial
  { key: 'employee_count', label: 'Employees',      type: 'number',   section: 'financial' },
  { key: 'annual_revenue', label: 'Annual revenue', type: 'currency', section: 'financial' },

  // meta
  { key: 'linkedin_url',   label: 'LinkedIn',       type: 'url',      section: 'meta' },
  { key: 'city',           label: 'City',           type: 'text',     section: 'meta' },
  { key: 'country',        label: 'Country',        type: 'text',     section: 'meta' },
  { key: 'lead_source',    label: 'Lead source',    type: 'text',     section: 'meta' },
  { key: 'tags',           label: 'Tags',           type: 'tags',     section: 'meta' },
  { key: 'notes',          label: 'Notes',          type: 'longtext', section: 'meta' },
]

// ─── Deals ───────────────────────────────────────────────────────────────────

export const DEAL_FIELDS: FieldDef[] = [
  // core
  { key: 'name',                label: 'Name',                type: 'text',    section: 'core' },
  { key: 'stage',               label: 'Stage',               type: 'enum',    section: 'core',
    options: ['lead', 'qualified', 'demo', 'proposal', 'negotiation', 'closed_won', 'closed_lost'],
    optionLabels: { closed_won: 'Won', closed_lost: 'Lost' } },
  { key: 'priority',            label: 'Priority',            type: 'enum',    section: 'core',
    options: ['low', 'medium', 'high', 'critical', 'p0', 'p1', 'p2', 'p3'],
    optionLabels: { p0: 'P0', p1: 'P1', p2: 'P2', p3: 'P3' } },
  { key: 'deal_type',           label: 'Deal type',           type: 'enum',    section: 'core',
    options: ['new_business', 'expansion', 'renewal', 'upsell', 'cross_sell', 'win_back'] },
  { key: 'expected_close_date', label: 'Expected close',      type: 'date',    section: 'core' },
  { key: 'next_step',           label: 'Next step',           type: 'text',    section: 'core' },
  { key: 'probability',         label: 'Probability',         type: 'percent', section: 'core' },

  // financial
  { key: 'value',               label: 'Value',               type: 'currency', section: 'financial' },
  { key: 'currency',             label: 'Currency',            type: 'text',     section: 'financial' },
  { key: 'contracted_value',     label: 'Contracted value',    type: 'currency', section: 'financial' },
  { key: 'confirmed_revenue',    label: 'Confirmed revenue',   type: 'currency', section: 'financial' },
  { key: 'invoice_ref',          label: 'Invoice ref',         type: 'text',     section: 'financial' },
  { key: 'po_ref',               label: 'PO ref',              type: 'text',     section: 'financial' },
  { key: 'invoice_date',         label: 'Invoice date',        type: 'date',     section: 'financial' },
  { key: 'po_date',              label: 'PO date',             type: 'date',     section: 'financial' },
  { key: 'payment_status',       label: 'Payment status',      type: 'enum',     section: 'financial',
    options: ['none', 'invoiced', 'partial', 'paid', 'overdue'] },

  // meta
  { key: 'lead_source',         label: 'Lead source',         type: 'text',     section: 'meta' },
  { key: 'competitors',         label: 'Competitors',         type: 'text',     section: 'meta' },
  { key: 'loss_reason',         label: 'Loss reason',         type: 'text',     section: 'meta' },
  { key: 'tags',                label: 'Tags',                type: 'tags',     section: 'meta' },
  { key: 'notes',               label: 'Notes',               type: 'longtext', section: 'meta' },
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
  // Filter and preserve registry order, not visibleKeys order
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
    // Preserve registry order, filter to override set
    // (this also drops any garbage values that aren't in the registry superset)
    const supersetSet = new Set(field.options ?? [])
    return (field.options ?? []).filter(o => override.includes(o) && supersetSet.has(o))
  }
  return field.options ?? []
}