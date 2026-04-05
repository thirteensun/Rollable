# SDM Prototype 001
### Liberate sales and marketing through effortless AI.

A mobile-first AI CRM for SMB sales teams. Snap a photo, record a voice memo, or screenshot a conversation — AI extracts contacts, deals, and tasks automatically.

---

## Stack

- **Framework:** Next.js 14 (App Router)
- **Database:** Supabase (Postgres + RLS)
- **Auth:** Supabase Auth
- **Styling:** Tailwind CSS
- **Hosting:** Vercel
- **AI (dev):** Google Gemini 2.0 Flash
- **AI (prod):** Anthropic Claude Sonnet

---

## Getting started

```bash
git clone https://github.com/thirteensun/sdm-prototype
cd sdm-prototype
npm install
cp .env.local.example .env.local
```

Fill in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
GEMINI_API_KEY=your-gemini-key
```

```bash
npm run dev
# → http://localhost:3000
```

---

## Project structure

```
src/
  app/
    page.tsx          # Home (today's focus + activity)
    planning/         # Planning tab
    tracking/         # Tracking tab (pipeline)
    capture/          # Capture flow (image → AI → confirm)
  components/
    layout/
      BottomNav.tsx   # Bottom tab bar with breathing Capture button
  lib/
    supabase.ts       # Supabase client
```

---

## Three core screens

| Screen | Purpose |
|--------|---------|
| **Home** | Today's focus, color-coded by urgency, recent AI-logged activity |
| **Planning** | Overdue, today, this week — task list powered by AI |
| **Tracking** | Pipeline deals with progress bars, value, risk flags |
| **Capture** | Snap/voice → AI reads → plain English confirmation → save |

---

## Database

Run `schema.sql` in Supabase SQL Editor before first use.

Tables: `users`, `companies`, `contacts`, `deals`, `deal_contacts`, `events`, `tasks`

---

## Deployment

Push to `main` → Vercel auto-deploys.

Add env vars in Vercel dashboard → Settings → Environment Variables.
