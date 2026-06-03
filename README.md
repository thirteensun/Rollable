# Rollable

> Liberate sales and marketing through effortless AI.

An AI-powered CRM for SMB sales teams. Capture contacts, deals, and tasks from photos, voice memos, and conversations — Claude extracts and organises everything automatically.

Live demo: [rollable.app](https://rollable.app)

---

## Self-hosted

Rollable is fully self-hosted. You bring your own accounts — there is no shared backend or subscription:

| What | Where | Free tier? |
|------|-------|-----------|
| Database + auth | [Supabase](https://supabase.com) | Yes |
| AI (Claude) | [Anthropic](https://console.anthropic.com) | Pay-per-use |
| Hosting | [Vercel](https://vercel.com) | Yes |

You own your data. Your Anthropic API key is called only from your own server — usage costs go to your account directly.

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

### 1. Supabase

Create a free project at [supabase.com](https://supabase.com). Then in your project's **SQL Editor**, paste the contents of [`schema.sql`](schema.sql) and run it — this creates all the tables.

Grab these three values from **Project Settings → API**:
- Project URL
- `anon` public key
- `service_role` secret key

### 2. Anthropic

Get an API key at [console.anthropic.com](https://console.anthropic.com). The app uses Claude Sonnet for AI features — typical usage for a small team is a few dollars a month.

### 3. Run locally

```bash
git clone https://github.com/thirteensun/Rollable
cd rollable
npm install
cp .env.local.example .env.local
# fill in your Supabase and Anthropic keys
npm run dev
# → http://localhost:3000
```

### 4. Deploy to Vercel

```bash
vercel deploy
```

Or connect the repo in the Vercel dashboard for automatic deploys on push. Add all env vars from `.env.local.example` under **Settings → Environment Variables**.

---

## Key features

| Feature | Description |
|---------|-------------|
| **AI Capture** | Paste text or describe an interaction — Claude extracts contacts, deals, and tasks |
| **Pipeline** | Deal tracking with stages, values, and close dates |
| **Tasks** | AI-generated and manual tasks linked to contacts and deals |
| **AI Sandbox** | Freeform assistant with full access to your CRM data |
| **Analytics** | Token usage and activity tracking per org |
| **Multi-org** | Organisation-scoped data with Supabase RLS |

---

## Project structure

```
src/
  app/
    page.tsx       # Dashboard
    contacts/      # Contact list and detail
    companies/     # Company list and detail
    deals/         # Pipeline view
    tasks/         # Task management
    capture/       # AI capture flow
    ai-sandbox/    # Freeform AI assistant
    analytics/     # Usage analytics
    settings/      # User and org settings
    admin/         # Admin panel (restricted by ADMIN_EMAILS env var)
    api/           # API routes
  components/      # Shared UI components
  lib/             # Supabase clients, org context, utilities
```

---

## License

MIT — see [LICENSE](LICENSE).
