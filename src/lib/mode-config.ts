export type AppMode = 'fire' | 'wood' | 'water' | 'earth' | 'gold'

// Keys into the shared icon registry (see components/layout/NavIcons.tsx)
export type NavIconName =
  | 'home' | 'capture' | 'tasks' | 'analytics' | 'sandbox' | 'settings'
  | 'pipeline' | 'board' | 'flow' | 'portfolio' | 'ledger'
  | 'deals' | 'projects' | 'orders' | 'assets' | 'positions'
  | 'contacts' | 'team' | 'suppliers' | 'operators' | 'stakeholders'
  | 'companies' | 'clients' | 'vendors' | 'organizations' | 'entities'

export interface NavSection {
  key: string
  label: string
  href: string
  icon: NavIconName
  group: 'workspace' | 'records'
  pro?: boolean
}

export interface ModeConfig {
  key: AppMode
  // Element identity
  element: string        // Chinese character
  elementName: string    // English element name
  symbol: string         // emoji glyph
  // Display
  name: string           // mode name shown in the rail / switcher
  description: string    // one-line pitch
  // Subtle accent (no bold chrome — see plan)
  accent: string         // solid accent for active rail icon + small affordances
  accentMuted: string    // tint for active sidebar item background
  // Terminology — drives page titles, list headers, breadcrumbs, AI prompts
  terms: {
    deal: string;  deals: string
    contact: string; contacts: string
    company: string; companies: string
    pipeline: string
    value: string        // list "Value" column header
    stage: string
    closedWon: string; closedLost: string
  }
  // Level-2 navigation — sections differ per module in label + icon, shared routes
  sections: NavSection[]
  // Stage template (maps to stage-templates.ts keys)
  stageTemplate: string
}

// Sections share these routes across every module — only label + icon change.
function buildSections(opts: {
  pipeline: { label: string; icon: NavIconName }
  deals:    { label: string; icon: NavIconName }
  contacts: { label: string; icon: NavIconName }
  companies:{ label: string; icon: NavIconName }
}): NavSection[] {
  return [
    { key: 'home',      label: 'Home',       href: '/',               icon: 'home',      group: 'workspace' },
    { key: 'capture',   label: 'Capture',    href: '/capture',        icon: 'capture',   group: 'workspace' },
    { key: 'pipeline',  label: opts.pipeline.label, href: '/deals/pipeline', icon: opts.pipeline.icon, group: 'workspace' },
    { key: 'tasks',     label: 'Tasks',      href: '/tasks',          icon: 'tasks',     group: 'workspace' },
    { key: 'analytics', label: 'Analytics',  href: '/analytics',      icon: 'analytics', group: 'workspace' },
    { key: 'sandbox',   label: 'AI Sandbox', href: '/ai-sandbox',     icon: 'sandbox',   group: 'workspace', pro: true },
    { key: 'deals',     label: opts.deals.label,     href: '/deals',     icon: opts.deals.icon,     group: 'records' },
    { key: 'contacts',  label: opts.contacts.label,  href: '/contacts',  icon: opts.contacts.icon,  group: 'records' },
    { key: 'companies', label: opts.companies.label, href: '/companies', icon: opts.companies.icon, group: 'records' },
    { key: 'settings',  label: 'Settings',   href: '/settings',       icon: 'settings',  group: 'records' },
  ]
}

export const MODE_CONFIGS: ModeConfig[] = [
  {
    key: 'fire',
    element: '火', elementName: 'Fire', symbol: '🔥',
    name: 'CRM',
    description: 'Contacts, deals, and pipeline.',
    accent: '#C44B2E', accentMuted: 'rgba(196,75,46,0.10)',
    terms: {
      deal: 'deal', deals: 'deals', contact: 'contact', contacts: 'contacts',
      company: 'company', companies: 'companies', pipeline: 'pipeline',
      value: 'Value', stage: 'Stage', closedWon: 'Won', closedLost: 'Lost',
    },
    sections: buildSections({
      pipeline:  { label: 'Pipeline',  icon: 'pipeline' },
      deals:     { label: 'Deals',     icon: 'deals' },
      contacts:  { label: 'Contacts',  icon: 'contacts' },
      companies: { label: 'Companies', icon: 'companies' },
    }),
    stageTemplate: 'saas',
  },
  {
    key: 'wood',
    element: '木', elementName: 'Wood', symbol: '🪵',
    name: 'Projects',
    description: 'Tasks, milestones, and team.',
    accent: '#2D8653', accentMuted: 'rgba(45,134,83,0.10)',
    terms: {
      deal: 'project', deals: 'projects', contact: 'member', contacts: 'team',
      company: 'client', companies: 'clients', pipeline: 'board',
      value: 'Budget', stage: 'Phase', closedWon: 'Delivered', closedLost: 'Cancelled',
    },
    sections: buildSections({
      pipeline:  { label: 'Board',    icon: 'board' },
      deals:     { label: 'Projects', icon: 'projects' },
      contacts:  { label: 'Team',     icon: 'team' },
      companies: { label: 'Clients',  icon: 'clients' },
    }),
    stageTemplate: 'construction',
  },
  {
    key: 'water',
    element: '水', elementName: 'Water', symbol: '💧',
    name: 'Supply Chain',
    description: 'Orders, vendors, and flow.',
    accent: '#0077B6', accentMuted: 'rgba(0,119,182,0.10)',
    terms: {
      deal: 'order', deals: 'orders', contact: 'supplier', contacts: 'suppliers',
      company: 'vendor', companies: 'vendors', pipeline: 'flow',
      value: 'Order value', stage: 'Status', closedWon: 'Fulfilled', closedLost: 'Rejected',
    },
    sections: buildSections({
      pipeline:  { label: 'Flow',      icon: 'flow' },
      deals:     { label: 'Orders',    icon: 'orders' },
      contacts:  { label: 'Suppliers', icon: 'suppliers' },
      companies: { label: 'Vendors',   icon: 'vendors' },
    }),
    stageTemplate: 'retail',
  },
  {
    key: 'earth',
    element: '土', elementName: 'Earth', symbol: '🪨',
    name: 'Assets',
    description: 'Properties, portfolios, and operators.',
    accent: '#C27C4E', accentMuted: 'rgba(194,124,78,0.12)',
    terms: {
      deal: 'asset', deals: 'assets', contact: 'operator', contacts: 'operators',
      company: 'organization', companies: 'organizations', pipeline: 'portfolio',
      value: 'Asset value', stage: 'Status', closedWon: 'Acquired', closedLost: 'Disposed',
    },
    sections: buildSections({
      pipeline:  { label: 'Portfolio',     icon: 'portfolio' },
      deals:     { label: 'Assets',        icon: 'assets' },
      contacts:  { label: 'Operators',     icon: 'operators' },
      companies: { label: 'Organizations', icon: 'organizations' },
    }),
    stageTemplate: 'real_estate',
  },
  {
    key: 'gold',
    element: '金', elementName: 'Gold', symbol: '🥇',
    name: 'Finance',
    description: 'Revenue, positions, and stakeholders.',
    accent: '#C9A227', accentMuted: 'rgba(201,162,39,0.12)',
    terms: {
      deal: 'position', deals: 'positions', contact: 'stakeholder', contacts: 'stakeholders',
      company: 'entity', companies: 'entities', pipeline: 'ledger',
      value: 'Position value', stage: 'Status', closedWon: 'Closed', closedLost: 'Written off',
    },
    sections: buildSections({
      pipeline:  { label: 'Ledger',       icon: 'ledger' },
      deals:     { label: 'Positions',    icon: 'positions' },
      contacts:  { label: 'Stakeholders', icon: 'stakeholders' },
      companies: { label: 'Entities',     icon: 'entities' },
    }),
    stageTemplate: 'services',
  },
]

export const DEFAULT_MODE: AppMode = 'fire'

export function getModeConfig(mode?: string | null): ModeConfig {
  return MODE_CONFIGS.find(m => m.key === mode) ?? MODE_CONFIGS[0]
}

export function getModeSections(mode?: string | null): NavSection[] {
  return getModeConfig(mode).sections
}

// Resolve a route path → its label in the active mode (for breadcrumbs).
export function getModeRouteLabel(mode: string | null | undefined, segment: string): string | null {
  const cfg = getModeConfig(mode)
  const map: Record<string, string> = {
    deals: cfg.terms.deals,
    contacts: cfg.terms.contacts,
    companies: cfg.terms.companies,
    pipeline: cfg.terms.pipeline,
  }
  const label = map[segment]
  return label ? label.charAt(0).toUpperCase() + label.slice(1) : null
}
