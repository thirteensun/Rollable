export type AppMode = 'fire' | 'wood' | 'water' | 'earth' | 'gold'

export interface ModeConfig {
  key: AppMode
  // Element identity
  element: string        // Chinese character
  elementName: string    // English element name
  symbol: string         // emoji glyph
  // Display
  name: string           // mode name shown in switcher
  description: string    // one-line pitch
  // Nav labels
  nav: {
    pipeline: string     // board/pipeline/flow/portfolio/ledger
    deals: string        // deals/projects/orders/assets/positions
    contacts: string     // contacts/team/suppliers/operators/stakeholders
    companies: string    // companies/clients/vendors/organizations/entities
  }
  // Entity terminology (used in page titles, empty states, AI prompts)
  terms: {
    deal: string         // singular
    deals: string        // plural
    contact: string
    contacts: string
    company: string
    companies: string
    pipeline: string     // "pipeline", "board", "flow", etc.
    value: string        // "Deal value", "Budget", "Order value", etc.
    stage: string        // "Stage", "Status", "Phase"
    closedWon: string    // "Won", "Delivered", "Acquired"
    closedLost: string   // "Lost", "Cancelled", "Rejected"
  }
  // Stage template to use (maps to stage-templates.ts keys)
  stageTemplate: string
  // Theme
  theme: {
    sidebarBg: string        // sidebar background
    sidebarAccent: string    // active item highlight
    sidebarText: string      // nav text color
    sidebarMuted: string     // muted nav text
    accent: string           // primary accent (buttons, badges, active states)
    accentMuted: string      // light accent tint (badge bg, hover)
    pageBg: string           // app shell background
    cardBg: string           // content card background
    border: string           // card border
  }
}

export const MODE_CONFIGS: ModeConfig[] = [
  {
    key: 'fire',
    element: '火',
    elementName: 'Fire',
    symbol: '🔥',
    name: 'CRM',
    description: 'Contacts, deals, and pipeline. Close with heat.',
    nav: {
      pipeline: 'Pipeline',
      deals:    'Deals',
      contacts: 'Contacts',
      companies:'Companies',
    },
    terms: {
      deal: 'deal', deals: 'deals',
      contact: 'contact', contacts: 'contacts',
      company: 'company', companies: 'companies',
      pipeline: 'pipeline',
      value: 'Deal value',
      stage: 'Stage',
      closedWon: 'Won', closedLost: 'Lost',
    },
    stageTemplate: 'saas',
    theme: {
      sidebarBg:     '#1a1a18',
      sidebarAccent: 'rgba(196,75,46,0.18)',
      sidebarText:   '#f5f4f0',
      sidebarMuted:  '#9b9890',
      accent:        '#C44B2E',
      accentMuted:   'rgba(196,75,46,0.10)',
      pageBg:        '#f5f4f0',
      cardBg:        '#ffffff',
      border:        'rgba(0,0,0,0.08)',
    },
  },
  {
    key: 'wood',
    element: '木',
    elementName: 'Wood',
    symbol: '🪵',
    name: 'Projects',
    description: 'Tasks, milestones, and team. Grow with structure.',
    nav: {
      pipeline: 'Board',
      deals:    'Projects',
      contacts: 'Team',
      companies:'Clients',
    },
    terms: {
      deal: 'project', deals: 'projects',
      contact: 'member', contacts: 'team',
      company: 'client', companies: 'clients',
      pipeline: 'board',
      value: 'Budget',
      stage: 'Phase',
      closedWon: 'Delivered', closedLost: 'Cancelled',
    },
    stageTemplate: 'construction',
    theme: {
      sidebarBg:     '#1C3D2E',
      sidebarAccent: 'rgba(82,183,136,0.20)',
      sidebarText:   '#E8F5EE',
      sidebarMuted:  '#7AAF8E',
      accent:        '#2D8653',
      accentMuted:   'rgba(45,134,83,0.10)',
      pageBg:        '#EFF5F1',
      cardBg:        '#FAFCFB',
      border:        'rgba(45,106,79,0.10)',
    },
  },
  {
    key: 'water',
    element: '水',
    elementName: 'Water',
    symbol: '💧',
    name: 'Supply Chain',
    description: 'Orders, vendors, and flow. Move with precision.',
    nav: {
      pipeline: 'Flow',
      deals:    'Orders',
      contacts: 'Suppliers',
      companies:'Vendors',
    },
    terms: {
      deal: 'order', deals: 'orders',
      contact: 'supplier', contacts: 'suppliers',
      company: 'vendor', companies: 'vendors',
      pipeline: 'flow',
      value: 'Order value',
      stage: 'Status',
      closedWon: 'Fulfilled', closedLost: 'Rejected',
    },
    stageTemplate: 'retail',
    theme: {
      sidebarBg:     '#0A2540',
      sidebarAccent: 'rgba(0,119,182,0.25)',
      sidebarText:   '#E0EEF8',
      sidebarMuted:  '#6A9BBF',
      accent:        '#0077B6',
      accentMuted:   'rgba(0,119,182,0.10)',
      pageBg:        '#EFF4F9',
      cardBg:        '#F8FBFE',
      border:        'rgba(0,58,113,0.08)',
    },
  },
  {
    key: 'earth',
    element: '土',
    elementName: 'Earth',
    symbol: '🪨',
    name: 'Assets',
    description: 'Properties, portfolios, and operators. Hold what matters.',
    nav: {
      pipeline: 'Portfolio',
      deals:    'Assets',
      contacts: 'Operators',
      companies:'Organizations',
    },
    terms: {
      deal: 'asset', deals: 'assets',
      contact: 'operator', contacts: 'operators',
      company: 'organization', companies: 'organizations',
      pipeline: 'portfolio',
      value: 'Asset value',
      stage: 'Status',
      closedWon: 'Acquired', closedLost: 'Disposed',
    },
    stageTemplate: 'real_estate',
    theme: {
      sidebarBg:     '#2D1E12',
      sidebarAccent: 'rgba(194,124,78,0.22)',
      sidebarText:   '#F5EDE2',
      sidebarMuted:  '#A07856',
      accent:        '#C27C4E',
      accentMuted:   'rgba(194,124,78,0.12)',
      pageBg:        '#F5EFE6',
      cardBg:        '#FDFAF6',
      border:        'rgba(101,60,20,0.09)',
    },
  },
  {
    key: 'gold',
    element: '金',
    elementName: 'Gold',
    symbol: '🥇',
    name: 'Finance',
    description: 'Revenue, positions, and stakeholders. Compound with clarity.',
    nav: {
      pipeline: 'Ledger',
      deals:    'Positions',
      contacts: 'Stakeholders',
      companies:'Entities',
    },
    terms: {
      deal: 'position', deals: 'positions',
      contact: 'stakeholder', contacts: 'stakeholders',
      company: 'entity', companies: 'entities',
      pipeline: 'ledger',
      value: 'Position value',
      stage: 'Status',
      closedWon: 'Closed', closedLost: 'Written off',
    },
    stageTemplate: 'services',
    theme: {
      sidebarBg:     '#1C1507',
      sidebarAccent: 'rgba(201,162,39,0.22)',
      sidebarText:   '#FDF7E3',
      sidebarMuted:  '#A08840',
      accent:        '#C9A227',
      accentMuted:   'rgba(201,162,39,0.12)',
      pageBg:        '#FDFAF0',
      cardBg:        '#FFFEF8',
      border:        'rgba(120,96,10,0.09)',
    },
  },
]

export const DEFAULT_MODE: AppMode = 'fire'

export function getModeConfig(mode?: string | null): ModeConfig {
  return MODE_CONFIGS.find(m => m.key === mode) ?? MODE_CONFIGS[0]
}
