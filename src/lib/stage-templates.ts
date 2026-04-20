// Shared stage templates — single source of truth
// Internal keys are stable and map to DB stage values
// Display labels are what users see in the UI

export interface StageTemplate {
  key: string           // internal key stored in org context
  label: string         // display name shown in UI
  industry: string      // human-readable industry name
  stages: {
    key: string         // stored in deals.stage
    label: string       // shown in Kanban, lists, analytics
  }[]
}

export const STAGE_TEMPLATES: StageTemplate[] = [
  {
    key: 'saas',
    label: 'SaaS / Software',
    industry: 'SaaS / Software',
    stages: [
      { key: 'lead',        label: 'Lead' },
      { key: 'qualified',   label: 'Qualified' },
      { key: 'demo',        label: 'Demo' },
      { key: 'proposal',    label: 'Proposal' },
      { key: 'negotiation', label: 'Negotiation' },
    ],
  },
  {
    key: 'services',
    label: 'Professional Services',
    industry: 'Professional Services',
    stages: [
      { key: 'lead',        label: 'Lead' },
      { key: 'qualified',   label: 'Discovery' },
      { key: 'demo',        label: 'Scoping' },
      { key: 'proposal',    label: 'Proposal' },
      { key: 'negotiation', label: 'Negotiation' },
    ],
  },
  {
    key: 'construction',
    label: 'Construction / Project',
    industry: 'Construction / Project',
    stages: [
      { key: 'lead',        label: 'Enquiry' },
      { key: 'qualified',   label: 'Site Visit' },
      { key: 'demo',        label: 'Bid Submitted' },
      { key: 'proposal',    label: 'Negotiation' },
      { key: 'negotiation', label: 'Contract Signed' },
    ],
  },
  {
    key: 'real_estate',
    label: 'Real Estate',
    industry: 'Real Estate',
    stages: [
      { key: 'lead',        label: 'Enquiry' },
      { key: 'qualified',   label: 'Viewing' },
      { key: 'demo',        label: 'Offer' },
      { key: 'proposal',    label: 'Due Diligence' },
      { key: 'negotiation', label: 'Exchange' },
    ],
  },
  {
    key: 'recruitment',
    label: 'Recruitment',
    industry: 'Recruitment',
    stages: [
      { key: 'lead',        label: 'Lead' },
      { key: 'qualified',   label: 'Briefing' },
      { key: 'demo',        label: 'Shortlist' },
      { key: 'proposal',    label: 'Interview' },
      { key: 'negotiation', label: 'Offer' },
    ],
  },
  {
    key: 'legal',
    label: 'Legal',
    industry: 'Legal',
    stages: [
      { key: 'lead',        label: 'Enquiry' },
      { key: 'qualified',   label: 'Conflict Check' },
      { key: 'demo',        label: 'Engagement' },
      { key: 'proposal',    label: 'Matter Open' },
      { key: 'negotiation', label: 'In Progress' },
    ],
  },
  {
    key: 'retail',
    label: 'Retail / E-commerce',
    industry: 'Retail / E-commerce',
    stages: [
      { key: 'lead',        label: 'Lead' },
      { key: 'qualified',   label: 'Quote' },
      { key: 'demo',        label: 'Order' },
      { key: 'proposal',    label: 'Fulfillment' },
      { key: 'negotiation', label: 'Delivered' },
    ],
  },
  {
    key: 'other',
    label: 'Other / General',
    industry: 'Other',
    stages: [
      { key: 'lead',        label: 'Lead' },
      { key: 'qualified',   label: 'Qualified' },
      { key: 'demo',        label: 'Meeting' },
      { key: 'proposal',    label: 'Proposal' },
      { key: 'negotiation', label: 'Negotiation' },
    ],
  },
]

// Always appended — never part of the template
export const CLOSED_STAGES = [
  { key: 'closed_won',  label: 'Won' },
  { key: 'closed_lost', label: 'Lost' },
]

// Get full stage list for a template key (including closed)
export function getStagesForTemplate(templateKey: string): StageTemplate['stages'] {
  const template = STAGE_TEMPLATES.find(t => t.key === templateKey)
  const stages = template?.stages || STAGE_TEMPLATES.find(t => t.key === 'other')!.stages
  return [...stages, ...CLOSED_STAGES]
}

// Get display label for a stage key given a template
export function getStageLabel(stageKey: string, templateKey?: string): string {
  if (stageKey === 'closed_won') return 'Won'
  if (stageKey === 'closed_lost') return 'Lost'
  if (!templateKey) return stageKey
  const template = STAGE_TEMPLATES.find(t => t.key === templateKey)
  return template?.stages.find(s => s.key === stageKey)?.label || stageKey
}

// Build a label map { stageKey → displayLabel } for a template
export function buildStageLabelMap(templateKey?: string): Record<string, string> {
  const stages = getStagesForTemplate(templateKey || 'other')
  return Object.fromEntries(stages.map(s => [s.key, s.label]))
}

// Suggest a template key from an industry string (used by Haiku onboarding)
export function suggestTemplate(industry: string): string {
  const lower = industry.toLowerCase()
  if (lower.includes('saas') || lower.includes('software') || lower.includes('tech')) return 'saas'
  if (lower.includes('construction') || lower.includes('build') || lower.includes('project')) return 'construction'
  if (lower.includes('real estate') || lower.includes('property') || lower.includes('housing')) return 'real_estate'
  if (lower.includes('recruit') || lower.includes('staffing') || lower.includes('talent')) return 'recruitment'
  if (lower.includes('legal') || lower.includes('law') || lower.includes('solicitor')) return 'legal'
  if (lower.includes('retail') || lower.includes('ecommerce') || lower.includes('shop')) return 'retail'
  if (lower.includes('consult') || lower.includes('agency') || lower.includes('service')) return 'services'
  return 'other'
}

// Industry options for the onboarding picker (shown to user)
export const INDUSTRY_OPTIONS = STAGE_TEMPLATES.map(t => ({
  key: t.key,
  label: t.label,
}))

// Home priority options
export type HomePriority = 'tasks' | 'pipeline' | 'at_risk' | 'revenue'

export const HOME_PRIORITY_OPTIONS: { key: HomePriority; label: string; description: string }[] = [
  { key: 'tasks',    label: 'Tasks',           description: 'See what needs doing today first' },
  { key: 'pipeline', label: 'Pipeline',         description: 'Jump straight to deal activity' },
  { key: 'at_risk',  label: 'At-risk deals',    description: 'Focus on deals that need attention' },
  { key: 'revenue',  label: 'Revenue vs quota', description: 'Track progress against targets' },
]
