import type { NavIconName } from '@/lib/mode-config'

// Single source of truth for nav iconography. 15×15 viewBox, stroke = currentColor,
// consistent 1.4 weight so every module shares one visual style while differing in detail.
const PATHS: Record<NavIconName, React.ReactNode> = {
  // ── Shared workspace icons ───────────────────────────────────────────────
  home: <path d="M1.5 6.5L7.5 1.5L13.5 6.5V13H9.5V9.5H5.5V13H1.5V6.5Z" strokeLinejoin="round" />,
  capture: <><circle cx="7.5" cy="7.5" r="6" /><path d="M7.5 4.5v6M4.5 7.5h6" strokeLinecap="round" /></>,
  tasks: <><rect x="1.5" y="1.5" width="12" height="12" rx="2.5" /><path d="M4 7.5l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" /></>,
  analytics: <path d="M1.5 12L5 7.5l3 2.5 3-5 2.5 3" strokeLinecap="round" strokeLinejoin="round" />,
  sandbox: <><circle cx="7.5" cy="7.5" r="6" /><path d="M7.5 5v3.5l2 2" strokeLinecap="round" strokeLinejoin="round" /></>,
  settings: <><circle cx="7.5" cy="7.5" r="2.5" /><path d="M7.5 1.5v1M7.5 12.5v1M1.5 7.5h1M12.5 7.5h1M3.1 3.1l.7.7M11.2 11.2l.7.7M11.2 3.1l-.7.7M3.8 11.2l-.7.7" strokeLinecap="round" /></>,

  // ── Pipeline variants (one per module) ───────────────────────────────────
  pipeline: <><rect x="1" y="2" width="4" height="11" rx="1.5" /><rect x="6" y="2" width="4" height="7" rx="1.5" /><rect x="11" y="2" width="3" height="9" rx="1.5" /></>,
  board: <><rect x="1.5" y="1.5" width="12" height="12" rx="2" /><path d="M5.5 1.5v12M9.5 1.5v12" strokeWidth="1.1" /></>,
  flow: <><path d="M1.5 4.5h8M7.5 2.5l2 2-2 2" strokeLinecap="round" strokeLinejoin="round" /><path d="M13.5 10.5h-8M7.5 8.5l-2 2 2 2" strokeLinecap="round" strokeLinejoin="round" /></>,
  portfolio: <><rect x="1.5" y="1.5" width="5" height="5" rx="1" /><rect x="8.5" y="1.5" width="5" height="5" rx="1" /><rect x="1.5" y="8.5" width="5" height="5" rx="1" /><rect x="8.5" y="8.5" width="5" height="5" rx="1" /></>,
  ledger: <><rect x="1.5" y="2" width="12" height="11" rx="1.5" /><path d="M1.5 5.5h12M5 5.5v7.5" strokeWidth="1.1" /></>,

  // ── "Deals" record variants ──────────────────────────────────────────────
  deals: <path d="M1.5 7.5h12M7.5 1.5l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />,
  projects: <path d="M1.5 4a1.5 1.5 0 011.5-1.5h2.2l1.4 1.8h5A1.4 1.4 0 0113 5.7v5.3a1.5 1.5 0 01-1.5 1.5h-8A1.5 1.5 0 012 11V4z" strokeLinejoin="round" />,
  orders: <><path d="M7.5 1.7l5.3 2.8v5.5L7.5 12.8 2.2 10V4.5L7.5 1.7z" strokeLinejoin="round" /><path d="M2.2 4.5l5.3 2.8 5.3-2.8M7.5 7.3v5.5" strokeWidth="1.1" strokeLinecap="round" /></>,
  assets: <><path d="M2 13V6l5.5-4L13 6v7" strokeLinejoin="round" /><path d="M5.5 13V8.5h4V13" strokeLinejoin="round" /></>,
  positions: <><path d="M2 1.5v11.5h11.5" strokeLinecap="round" /><rect x="4" y="7" width="2" height="3.5" rx="0.5" /><rect x="7.5" y="5" width="2" height="5.5" rx="0.5" /><rect x="11" y="3" width="2" height="7.5" rx="0.5" /></>,

  // ── "Contacts" record variants ───────────────────────────────────────────
  contacts: <><circle cx="7.5" cy="5" r="3" /><path d="M1.5 13.5c0-3 2.7-5 6-5s6 2 6 5" strokeLinecap="round" /></>,
  team: <><circle cx="5.5" cy="5.5" r="2.3" /><path d="M1.2 12.8c0-2.4 1.9-3.8 4.3-3.8s4.3 1.4 4.3 3.8" strokeLinecap="round" /><path d="M10.2 3.6a2.2 2.2 0 010 4.2M11.3 12.8c0-2-.7-3.1-2.1-3.6" strokeLinecap="round" /></>,
  suppliers: <><rect x="1.5" y="4.5" width="7" height="6" rx="1" /><path d="M8.5 6.5h3l2 2v2h-5z" strokeLinejoin="round" /><circle cx="4" cy="11" r="1.2" /><circle cx="10.5" cy="11" r="1.2" /></>,
  operators: <path d="M10 2.2a3 3 0 00-3.9 3.9l-4.3 4.3 1.6 1.6 4.3-4.3A3 3 0 0011.6 3.8l-1.9 1.9-1.4-1.4 1.7-2.1z" strokeLinejoin="round" />,
  stakeholders: <><circle cx="7.5" cy="3.2" r="1.9" /><circle cx="3" cy="11" r="1.9" /><circle cx="12" cy="11" r="1.9" /><path d="M6.2 4.6L4 9.2M8.8 4.6L11 9.2" strokeWidth="1.1" /></>,

  // ── "Companies" record variants ──────────────────────────────────────────
  companies: <><rect x="1.5" y="5" width="12" height="8.5" rx="2" /><path d="M5 5V3.5a2.5 2.5 0 015 0V5" strokeLinecap="round" /></>,
  clients: <><rect x="1.5" y="4.5" width="12" height="8" rx="1.5" /><path d="M5 4.5V3.4A1.5 1.5 0 016.5 2h2A1.5 1.5 0 0110 3.4v1.1M1.5 8h12" strokeLinecap="round" /></>,
  vendors: <path d="M2 6.3V13h11V6.3M1.4 6.3l1.5-3.8h9.2l1.5 3.8a2 2 0 01-4 0 2 2 0 01-4 0 2 2 0 01-4 0z" strokeLinejoin="round" />,
  organizations: <><rect x="1.5" y="4" width="5" height="9.5" rx="1" /><rect x="8" y="1.5" width="5.5" height="12" rx="1" /><path d="M3.3 6.5h1.4M3.3 9h1.4M9.8 4h2M9.8 6.5h2M9.8 9h2" strokeWidth="1" strokeLinecap="round" /></>,
  entities: <path d="M1.5 5.5L7.5 2l6 3.5M2.5 6v5.5M5.3 6v5.5M9.7 6v5.5M12.5 6v5.5M1.5 13.5h12" strokeLinecap="round" strokeLinejoin="round" />,
}

export default function NavIcon({ name, size = 15 }: { name: NavIconName; size?: number }) {
  return (
    <svg viewBox="0 0 15 15" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.4">
      {PATHS[name]}
    </svg>
  )
}
