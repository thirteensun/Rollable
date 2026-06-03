# Rollable

> Liberate sales and marketing through effortless AI.

An AI-powered CRM for SMB sales teams. Capture contacts, deals, and tasks from photos, voice memos, and conversations — AI extracts and organises everything automatically.

Live demo: [rollable.app](https://rollable.app)

---

## Stack

- **Framework:** Next.js 14 (App Router)
- **Database:** Supabase (Postgres + RLS)
- **Auth:** Supabase Auth
- **AI:** Anthropic Claude (Sonnet / Haiku)
- **Styling:** Tailwind CSS
- **Hosting:** Vercel

---

## Getting started

```bash
git clone https://github.com/thirteensun/rollable
cd rollable
npm install
cp .env.local.example .env.local
```

Fill in `.env.local` with your credentials (see `.env.local.example` for all required keys):

- **Supabase** — create a project at [supabase.com](https://supabase.com), grab the URL, anon key, and service role key from Project Settings → API
- **Anthropic** — get an API key at [console.anthropic.com](https://console.anthropic.com)

```bash
npm run dev
# → http://localhost:3000
```

---

## Project structure

```
src/
  app/
    page.tsx          # Dashboard home
    contacts/         # Contact list and detail
    companies/        # Company list and detail
    deals/            # Pipeline view
    tasks/            # Task management
    capture/          # AI capture flow (image → extract → confirm)
    ai-sandbox/       # Freeform AI assistant
    analytics/        # Usage analytics
    settings/         # User and org settings
    admin/            # Admin panel (restricted by ADMIN_EMAILS)
    api/              # API routes (AI, Supabase, org management)
  components/         # Shared UI components
  lib/                # Supabase clients, org context, utilities
```

---

## Key features

| Feature | Description |
|---------|-------------|
| **AI Capture** | Snap a photo or paste text — Claude extracts contacts, deals, and tasks |
| **Pipeline** | Kanban-style deal tracking with stages and values |
| **Tasks** | AI-generated and manual tasks linked to contacts and deals |
| **AI Sandbox** | Freeform assistant with full CRM context |
| **Analytics** | Token usage and AI activity tracking per org |
| **Multi-org** | Organisation-scoped data with Supabase RLS |

---

## Deployment

Push to `main` → Vercel auto-deploys.

Add all env vars from `.env.local.example` in Vercel dashboard → Settings → Environment Variables.

---

## License

MIT — see [LICENSE](LICENSE).
