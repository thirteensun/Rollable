// ─── Onboarding inference ────────────────────────────────────────────────────
// Maps six 1-7 slider scores to visible_fields, at_risk_days, stage_template,
// and AI pain_points. Called from onboarding and settings save.
// The scores are stored in org context so sliders can be restored.
//
// IMPORTANT: every field key here must exist in FIELD_REGISTRY (entity-fields.ts).
// every value in field_options must be within the registry superset for that field.
// Run the dev-time guard in entity-fields.ts to catch drift automatically.

export interface OnboardingScores {
  deal_length:         number  // 1=days  → 7=years
  buyer_complexity:    number  // 1=solo  → 7=committee
  relationship_driven: number  // 1=product → 7=people
  pricing_complexity:  number  // 1=fixed → 7=custom
  competitiveness:     number  // 1=none  → 7=brutal RFPs
  data_maturity:       number  // 1=gut feel → 7=full analytics
}

export interface VisibleFields {
  contacts:  string[]
  companies: string[]
  deals:     string[]
}

export interface FieldOptionOverrides {
  contacts?:  Record<string, string[]>
  companies?: Record<string, string[]>
  deals?:     Record<string, string[]>
}

export interface InferredContext {
  visible_fields:    VisibleFields
  field_options:     FieldOptionOverrides
  at_risk_days:      number
  stage_template:    string
  pain_points:       string[]
  onboarding_scores: OnboardingScores
}

// ─── All possible fields per entity (superset) ───────────────────────────────
// Keys MUST match FIELD_REGISTRY keys in entity-fields.ts exactly.
// Do NOT include FK links (company_id, contact_id) — those render as entity
// cards in detail pages, not form fields.
// Export so entity-fields.ts dev guard can verify them at module load.

export const ALL_CONTACT_FIELDS = [
  'full_name', 'role', 'email', 'phone',
  'status', 'department', 'seniority_level',
  'linkedin_url', 'twitter_url', 'location',
  'preferred_channel', 'lead_source',
  'last_contacted_at', 'next_followup_date', 'notes',
]

export const ALL_COMPANY_FIELDS = [
  'name', 'type', 'industry', 'website', 'status',
  'linkedin_url', 'city', 'country',
  'employee_count', 'annual_revenue',
  'lead_source', 'tags', 'notes',
]

export const ALL_DEAL_FIELDS = [
  'name', 'value', 'currency', 'stage', 'priority',
  'deal_type', 'lead_source', 'expected_close_date',
  'probability', 'next_step', 'competitors',
  'contracted_value', 'confirmed_revenue',
  'invoice_ref', 'po_ref', 'invoice_date', 'po_date', 'payment_status',
  'loss_reason', 'tags', 'notes',
]

// ─── Core fields always shown regardless of scores ───────────────────────────
// These are the minimum viable field set for each entity.
// No FK links — company_id/contact_id render separately as linked entity cards.

const CORE_CONTACT_FIELDS  = ['full_name', 'role', 'email', 'phone', 'status', 'notes']
const CORE_COMPANY_FIELDS  = ['name', 'industry', 'website', 'type', 'status', 'notes']
const CORE_DEAL_FIELDS     = ['name', 'value', 'stage', 'expected_close_date', 'notes']

const FALLBACK_FIELDS: Record<'contacts' | 'companies' | 'deals', string[]> = {
  contacts:  CORE_CONTACT_FIELDS,
  companies: CORE_COMPANY_FIELDS,
  deals:     CORE_DEAL_FIELDS,
}

// ─── Main inference function ──────────────────────────────────────────────────

export function inferFromScores(scores: OnboardingScores): InferredContext {
  const {
    deal_length,
    buyer_complexity,
    relationship_driven,
    pricing_complexity,
    competitiveness,
    data_maturity,
  } = scores

  // ── at_risk_days ──
  const at_risk_days =
    deal_length <= 2 ? 3  :
    deal_length <= 3 ? 7  :
    deal_length <= 5 ? 14 :
    deal_length <= 6 ? 21 : 30

  // ── stage_template ──
  const stage_template =
    deal_length <= 2                                     ? 'transactional' :
    deal_length <= 4 && buyer_complexity <= 3            ? 'smb'           :
    deal_length <= 4 && buyer_complexity >= 4            ? 'saas'          :
    pricing_complexity >= 5 && buyer_complexity >= 5     ? 'enterprise'    :
    buyer_complexity >= 5                                ? 'enterprise'    :
    'other'

  // ── contact fields ──
  const contactFields = new Set(CORE_CONTACT_FIELDS)

  if (relationship_driven >= 4) contactFields.add('preferred_channel')
  if (relationship_driven >= 5) contactFields.add('next_followup_date')
  if (relationship_driven >= 5) contactFields.add('last_contacted_at')
  if (relationship_driven >= 6) contactFields.add('twitter_url')
  if (relationship_driven >= 6) contactFields.add('linkedin_url')
  if (buyer_complexity >= 4)    contactFields.add('department')
  if (buyer_complexity >= 4)    contactFields.add('seniority_level')
  if (buyer_complexity >= 5)    contactFields.add('location')
  if (data_maturity >= 4)       contactFields.add('lead_source')

  // ── company fields ──
  const companyFields = new Set(CORE_COMPANY_FIELDS)

  companyFields.add('country')
  if (relationship_driven >= 3) companyFields.add('employee_count')
  if (buyer_complexity >= 4)    companyFields.add('employee_count')
  if (pricing_complexity >= 4)  companyFields.add('annual_revenue')
  if (data_maturity >= 4)       companyFields.add('lead_source')
  if (data_maturity >= 5)       companyFields.add('tags')
  if (buyer_complexity >= 5)    companyFields.add('city')
  if (relationship_driven >= 5) companyFields.add('linkedin_url')

  // ── deal fields ──
  const dealFields = new Set(CORE_DEAL_FIELDS)

  dealFields.add('priority')
  dealFields.add('deal_type')
  dealFields.add('next_step')

  if (data_maturity >= 3)      dealFields.add('lead_source')
  if (data_maturity >= 4)      dealFields.add('probability')
  if (data_maturity >= 5)      dealFields.add('tags')
  if (competitiveness >= 4)    dealFields.add('competitors')
  if (competitiveness >= 5)    dealFields.add('loss_reason')
  if (pricing_complexity >= 4) dealFields.add('contracted_value')
  if (pricing_complexity >= 5) dealFields.add('confirmed_revenue')
  if (pricing_complexity >= 5) dealFields.add('invoice_ref')
  if (pricing_complexity >= 5) dealFields.add('po_ref')
  if (pricing_complexity >= 6) dealFields.add('invoice_date')
  if (pricing_complexity >= 6) dealFields.add('po_date')
  if (pricing_complexity >= 6) dealFields.add('payment_status')
  if (deal_length >= 4)        dealFields.add('expected_close_date')

  // ── pain_points for AI ──
  const pain_points: string[] = []

  if (deal_length >= 5)         pain_points.push('deals take a long time to close — watch for stalls')
  if (buyer_complexity >= 5)    pain_points.push('multiple stakeholders involved — stakeholder mapping is critical')
  if (relationship_driven >= 5) pain_points.push('relationship quality drives outcomes — flag relationship decay early')
  if (pricing_complexity >= 5)  pain_points.push('pricing is complex and custom — track contracted vs invoiced value')
  if (competitiveness >= 5)     pain_points.push('highly competitive deals — win/loss analysis is important')
  if (data_maturity <= 2)       pain_points.push('team is early on data habits — keep prompts simple and actionable')
  if (data_maturity >= 6)       pain_points.push('team is analytically mature — surface detailed pipeline metrics')

  // ── preserve field order from ALL_* arrays ──
  const orderedContacts  = ALL_CONTACT_FIELDS .filter(f => contactFields.has(f))
  const orderedCompanies = ALL_COMPANY_FIELDS .filter(f => companyFields.has(f))
  const orderedDeals     = ALL_DEAL_FIELDS    .filter(f => dealFields.has(f))

  // ── field_options ──────────────────────────────────────────────────────────
  // Score-driven enum subsets consumed by FieldGrid + Haiku prompt.
  // ALL values here must exist in entity-fields.ts registry superset for
  // that field — the dev guard will warn if they drift.

  // deals.payment_status — DB: none, invoiced, partial, paid, overdue
  const paymentStatus: string[] =
    pricing_complexity <= 2 ? ['none', 'paid'] :
    pricing_complexity <= 4 ? ['none', 'invoiced', 'paid'] :
    pricing_complexity <= 6 ? ['none', 'invoiced', 'paid', 'overdue'] :
                              ['none', 'invoiced', 'partial', 'paid', 'overdue']

  // deals.priority — DB: low, medium, high, critical, p0, p1, p2, p3
  const priority: string[] =
    data_maturity <= 2 ? ['high', 'low'] :
    data_maturity <= 4 ? ['low', 'medium', 'high'] :
    data_maturity <= 6 ? ['low', 'medium', 'high', 'critical'] :
                         ['p0', 'p1', 'p2', 'p3']

  // deals.deal_type — DB: new_business, expansion, renewal, upsell, cross_sell, win_back
  const dealType: string[] =
    buyer_complexity <= 2 && relationship_driven <= 3 ? ['new_business'] :
    buyer_complexity <= 3 ? ['new_business', 'renewal'] :
    buyer_complexity <= 5 ? ['new_business', 'expansion', 'renewal', 'upsell'] :
                            ['new_business', 'expansion', 'renewal', 'upsell', 'cross_sell', 'win_back']

  // contacts.seniority_level — DB: intern, junior, mid, senior, lead, exec, c_level
  const seniorityLevel: string[] =
    buyer_complexity <= 2 ? ['junior', 'senior'] :
    buyer_complexity <= 4 ? ['junior', 'mid', 'senior', 'exec'] :
    buyer_complexity <= 6 ? ['junior', 'mid', 'senior', 'lead', 'exec', 'c_level'] :
                            ['intern', 'junior', 'mid', 'senior', 'lead', 'exec', 'c_level']

  // contacts.lead_source — DB: referral, inbound, cold_outreach, event, linkedin, partner, website, other
  // companies.lead_source — DB: referral, inbound, cold_outreach, event, partner, other
  // deals.lead_source    — DB: referral, inbound, cold_outreach, event, partner, other
  // Not narrowed by score — all orgs see the full allowed set. Could be
  // score-driven in future (e.g. data_maturity drives granularity).
  // No entry here = FieldGrid falls back to registry superset (correct behaviour).

  const field_options: FieldOptionOverrides = {
    contacts: {
      seniority_level: seniorityLevel,
    },
    deals: {
      payment_status: paymentStatus,
      priority,
      deal_type:      dealType,
    },
    // companies: no narrowing currently — all fields use registry superset
  }

  return {
    at_risk_days,
    stage_template,
    pain_points,
    onboarding_scores: scores,
    visible_fields: {
      contacts:  orderedContacts,
      companies: orderedCompanies,
      deals:     orderedDeals,
    },
    field_options,
  }
}

// ─── Helper: merge inferred context into existing org context ─────────────────
// Preserves fields the user may have manually overridden
// (analytics_layout, terminology, home_priority).

export function mergeIntoOrgContext(
  existing: Record<string, any>,
  inferred: InferredContext,
): Record<string, any> {
  return {
    ...existing,
    at_risk_days:      inferred.at_risk_days,
    stage_template:    inferred.stage_template,
    pain_points:       inferred.pain_points,
    onboarding_scores: inferred.onboarding_scores,
    visible_fields:    inferred.visible_fields,
    field_options:     inferred.field_options,
  }
}

// ─── Helper: get visible fields for an entity with fallback ──────────────────

export function getVisibleFields(
  orgContext: Record<string, any>,
  entity: 'contacts' | 'companies' | 'deals',
): string[] {
  return orgContext?.visible_fields?.[entity] ?? FALLBACK_FIELDS[entity]
}

// ─── Helper: get field_options overrides for an entity ───────────────────────

export function getFieldOptions(
  orgContext: Record<string, any>,
  entity: 'contacts' | 'companies' | 'deals',
): Record<string, string[]> {
  return orgContext?.field_options?.[entity] ?? {}
}

// ─── Slider question definitions (used by onboarding + settings UI) ──────────

export const ONBOARDING_QUESTIONS = [
  {
    key: 'deal_length' as keyof OnboardingScores,
    question: 'How long does a typical deal take to close?',
    low:  'Very short',
    high: 'Very long',
    scaleHint: '1 = closes same week · 4 = weeks to a few months · 7 = 12+ month sales cycle',
    lowHint:  'Quick transactions, little back-and-forth',
    highHint: 'Long procurement cycles, multi-year contracts',
  },
  {
    key: 'buyer_complexity' as keyof OnboardingScores,
    question: 'How many people are involved in a buying decision?',
    low:  'One person',
    high: 'Full committee',
    scaleHint: '1 = single decision-maker · 4 = small team · 7 = board or committee sign-off',
    lowHint:  'Single decision-maker, fast approval',
    highHint: 'Large buying group, board sign-off required',
  },
  {
    key: 'relationship_driven' as keyof OnboardingScores,
    question: 'How relationship-driven is your sales?',
    low:  'Pure product',
    high: 'All people',
    scaleHint: '1 = features and price win deals · 4 = both matter · 7 = trust and rapport win deals',
    lowHint:  'Customers buy on features and price alone',
    highHint: 'Trust and relationship quality drive every deal',
  },
  {
    key: 'pricing_complexity' as keyof OnboardingScores,
    question: 'How complex or custom is your pricing?',
    low:  'Fixed price',
    high: 'Fully custom',
    scaleHint: '1 = fixed list price, no negotiation · 4 = some flexibility · 7 = custom contracts and invoicing',
    lowHint:  'Standard list price, no negotiation',
    highHint: 'Custom quotes, MSAs, POs, and invoicing',
  },
  {
    key: 'competitiveness' as keyof OnboardingScores,
    question: 'How competitive are your deals?',
    low:  'No competition',
    high: 'Brutal RFPs',
    scaleHint: '1 = mostly uncontested · 4 = occasional head-to-head · 7 = every deal is a formal tender',
    lowHint:  'You rarely compete head-to-head',
    highHint: 'Every deal involves multiple vendors and formal bids',
  },
  {
    key: 'data_maturity' as keyof OnboardingScores,
    question: 'How data-driven is your sales team today?',
    low:  'Gut feel',
    high: 'Full analytics',
    scaleHint: '1 = relying on gut feel · 4 = some tracking in place · 7 = full dashboards and forecasting',
    lowHint:  'Tracking is new — keep it simple',
    highHint: 'Team lives in dashboards and pipeline reports',
  },
] as const