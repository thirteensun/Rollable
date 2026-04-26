// ─── Onboarding inference ────────────────────────────────────────────────────
// Maps six 1-7 slider scores to visible_fields, at_risk_days, stage_template,
// and AI pain_points. Called from onboarding and settings save.
// The scores are stored in org context so sliders can be restored.

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

export interface InferredContext {
  visible_fields:    VisibleFields
  at_risk_days:      number
  stage_template:    string
  pain_points:       string[]
  onboarding_scores: OnboardingScores
}

// ─── All possible fields per entity (superset) ───────────────────────────────

const ALL_CONTACT_FIELDS = [
  'full_name', 'role', 'email', 'phone', 'linkedin_url', 'twitter_url',
  'company', 'location', 'department', 'seniority_level',
  'preferred_channel', 'lead_source', 'status',
  'last_contacted_at', 'next_followup_date', 'notes',
]

const ALL_COMPANY_FIELDS = [
  'name', 'type', 'industry', 'website', 'linkedin_url',
  'city', 'country', 'employee_count', 'annual_revenue',
  'lead_source', 'status', 'tags', 'notes',
]

const ALL_DEAL_FIELDS = [
  'name', 'value', 'currency', 'stage', 'priority',
  'deal_type', 'lead_source', 'expected_close_date',
  'probability', 'next_step', 'competitors',
  'contracted_value', 'confirmed_revenue',
  'invoice_ref', 'po_ref', 'invoice_date', 'po_date', 'payment_status',
  'loss_reason', 'tags', 'notes',
]

// ─── Core fields always shown regardless of scores ───────────────────────────

const CORE_CONTACT_FIELDS  = ['full_name', 'role', 'email', 'phone', 'company', 'status', 'notes']
const CORE_COMPANY_FIELDS  = ['name', 'industry', 'website', 'type', 'status', 'notes']
const CORE_DEAL_FIELDS     = ['name', 'value', 'stage', 'expected_close_date', 'notes']

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
  // Short deals → risk triggers fast; long deals → more patience
  const at_risk_days =
    deal_length <= 2 ? 3 :
    deal_length <= 3 ? 7 :
    deal_length <= 5 ? 14 :
    deal_length <= 6 ? 21 : 30

  // ── stage_template ──
  const stage_template =
    deal_length <= 2 ? 'transactional' :
    deal_length <= 4 && buyer_complexity <= 3 ? 'smb' :
    deal_length <= 4 && buyer_complexity >= 4 ? 'saas' :
    pricing_complexity >= 5 && buyer_complexity >= 5 ? 'enterprise' :
    buyer_complexity >= 5 ? 'enterprise' :
    'other'

  // ── contact fields ──
  const contactFields = new Set(CORE_CONTACT_FIELDS)

  // Relationship-driven → communication preference matters
  if (relationship_driven >= 4) contactFields.add('preferred_channel')
  if (relationship_driven >= 5) contactFields.add('next_followup_date')
  if (relationship_driven >= 5) contactFields.add('last_contacted_at')
  if (relationship_driven >= 6) contactFields.add('twitter_url')
  if (relationship_driven >= 6) contactFields.add('linkedin_url')

  // Complex buyers → org structure matters
  if (buyer_complexity >= 4) contactFields.add('department')
  if (buyer_complexity >= 4) contactFields.add('seniority_level')
  if (buyer_complexity >= 5) contactFields.add('location')

  // Data maturity → source tracking matters
  if (data_maturity >= 4) contactFields.add('lead_source')

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

  // Data maturity → tracking and source
  if (data_maturity >= 3) dealFields.add('lead_source')
  if (data_maturity >= 4) dealFields.add('probability')
  if (data_maturity >= 5) dealFields.add('tags')

  // Competitive → track competitors
  if (competitiveness >= 4) dealFields.add('competitors')
  if (competitiveness >= 5) dealFields.add('loss_reason')

  // Complex pricing → financial fields
  if (pricing_complexity >= 4) dealFields.add('contracted_value')
  if (pricing_complexity >= 5) dealFields.add('confirmed_revenue')
  if (pricing_complexity >= 5) dealFields.add('invoice_ref')
  if (pricing_complexity >= 5) dealFields.add('po_ref')
  if (pricing_complexity >= 6) dealFields.add('invoice_date')
  if (pricing_complexity >= 6) dealFields.add('po_date')
  if (pricing_complexity >= 6) dealFields.add('payment_status')

  // Long complex deals → close date tracking more important
  if (deal_length >= 4) dealFields.add('expected_close_date')

  // ── pain_points for AI ──
  const pain_points: string[] = []

  if (deal_length >= 5)          pain_points.push('deals take a long time to close — watch for stalls')
  if (buyer_complexity >= 5)     pain_points.push('multiple stakeholders involved — stakeholder mapping is critical')
  if (relationship_driven >= 5)  pain_points.push('relationship quality drives outcomes — flag relationship decay early')
  if (pricing_complexity >= 5)   pain_points.push('pricing is complex and custom — track contracted vs invoiced value')
  if (competitiveness >= 5)      pain_points.push('highly competitive deals — win/loss analysis is important')
  if (data_maturity <= 2)        pain_points.push('team is early on data habits — keep prompts simple and actionable')
  if (data_maturity >= 6)        pain_points.push('team is analytically mature — surface detailed pipeline metrics')

  // ── preserve field order from ALL_* arrays ──
  const orderedContacts  = ALL_CONTACT_FIELDS.filter(f => contactFields.has(f))
  const orderedCompanies = ALL_COMPANY_FIELDS.filter(f => companyFields.has(f))
  const orderedDeals     = ALL_DEAL_FIELDS.filter(f => dealFields.has(f))

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
  }
}

// ─── Helper: merge inferred context into existing org context ─────────────────
// Preserves fields the user may have manually overridden in settings
// (analytics_layout, terminology, home_priority)

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
  }
}

// ─── Helper: get visible fields for an entity with fallback ──────────────────

export function getVisibleFields(
  orgContext: Record<string, any>,
  entity: 'contacts' | 'companies' | 'deals',
): string[] {
  return orgContext?.visible_fields?.[entity] ?? CORE_DEAL_FIELDS
}

// ─── Slider question definitions (used by onboarding + settings UI) ──────────

export const ONBOARDING_QUESTIONS = [
  {
    key: 'deal_length' as keyof OnboardingScores,
    question: 'How long does a typical deal take to close?',
    low:  'Days',
    high: 'Years',
    lowHint:  'Quick transactions, little back-and-forth',
    highHint: 'Long procurement cycles, multi-year contracts',
  },
  {
    key: 'buyer_complexity' as keyof OnboardingScores,
    question: 'How many people are involved in a buying decision?',
    low:  'One person',
    high: 'Full committee',
    lowHint:  'Single decision-maker, fast approval',
    highHint: 'Large buying group, board sign-off required',
  },
  {
    key: 'relationship_driven' as keyof OnboardingScores,
    question: 'How relationship-driven is your sales?',
    low:  'Pure product',
    high: 'All people',
    lowHint:  'Customers buy on features and price alone',
    highHint: 'Trust and relationship quality drive every deal',
  },
  {
    key: 'pricing_complexity' as keyof OnboardingScores,
    question: 'How complex or custom is your pricing?',
    low:  'Fixed price',
    high: 'Fully custom',
    lowHint:  'Standard list price, no negotiation',
    highHint: 'Custom quotes, MSAs, POs, and invoicing',
  },
  {
    key: 'competitiveness' as keyof OnboardingScores,
    question: 'How competitive are your deals?',
    low:  'No competition',
    high: 'Brutal RFPs',
    lowHint:  'You rarely compete head-to-head',
    highHint: 'Every deal involves multiple vendors and formal bids',
  },
  {
    key: 'data_maturity' as keyof OnboardingScores,
    question: 'How data-driven is your sales team today?',
    low:  'Gut feel',
    high: 'Full analytics',
    lowHint:  'Tracking is new — keep it simple',
    highHint: 'Team lives in dashboards and pipeline reports',
  },
] as const