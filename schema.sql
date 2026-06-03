-- Rollable — Supabase schema
-- Run this in your Supabase project's SQL Editor before first use.
-- Dashboard → SQL Editor → New query → paste → Run

-- ============================================================
-- ORGANISATIONS
-- ============================================================
CREATE TABLE organisations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  context    jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- ORGANISATION_MEMBERS
-- ============================================================
CREATE TABLE organisation_members (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id     uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  role       text NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'manager', 'admin')),
  status     text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, org_id)
);
ALTER TABLE organisation_members ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_organisation_members_user_id ON organisation_members(user_id);
CREATE INDEX idx_organisation_members_org_id  ON organisation_members(org_id);

-- ============================================================
-- COMPANIES
-- ============================================================
CREATE TABLE companies (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id          uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  type            text CHECK (type IN ('prospect','customer','partner','competitor','investor','other')),
  status          text CHECK (status IN ('active','at_risk','churned','dormant')),
  industry        text,
  website         text,
  employee_count  integer CHECK (employee_count > 0),
  annual_revenue  numeric,
  linkedin_url    text,
  city            text,
  country         text,
  lead_source     text CHECK (lead_source IN ('referral','inbound','cold_outreach','event','partner','other')),
  tags            text[] NOT NULL DEFAULT '{}',
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_companies_org_id  ON companies(org_id);
CREATE INDEX idx_companies_user_id ON companies(user_id);

-- ============================================================
-- CONTACTS
-- ============================================================
CREATE TABLE contacts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id              uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  company_id          uuid REFERENCES companies(id) ON DELETE SET NULL,
  full_name           text NOT NULL,
  role                text,
  email               text,
  phone               text,
  status              text CHECK (status IN ('active','inactive','churned','do_not_contact')),
  department          text CHECK (department IN ('sales','marketing','engineering','finance','legal','operations','hr','procurement','it','other')),
  seniority_level     text CHECK (seniority_level IN ('intern','junior','mid','senior','lead','exec','c_level')),
  linkedin_url        text,
  twitter_url         text,
  location            text,
  preferred_channel   text CHECK (preferred_channel IN ('email','phone','whatsapp','linkedin','in_person','video_call')),
  lead_source         text CHECK (lead_source IN ('referral','inbound','cold_outreach','event','linkedin','partner','website','other')),
  last_contacted_at   timestamptz,
  next_followup_date  date,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_contacts_org_id     ON contacts(org_id);
CREATE INDEX idx_contacts_user_id    ON contacts(user_id);
CREATE INDEX idx_contacts_company_id ON contacts(company_id);

-- ============================================================
-- DEALS
-- ============================================================
CREATE TABLE deals (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id               uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  company_id           uuid REFERENCES companies(id) ON DELETE SET NULL,
  name                 text NOT NULL,
  stage                text NOT NULL DEFAULT 'lead' CHECK (stage IN ('lead','qualified','demo','proposal','negotiation','closed_won','closed_lost')),
  value                numeric,
  currency             text NOT NULL DEFAULT 'EUR',
  priority             text CHECK (priority IN ('low','medium','high','critical','p0','p1','p2','p3')),
  deal_type            text CHECK (deal_type IN ('new_business','expansion','renewal','upsell','cross_sell','win_back')),
  expected_close_date  date,
  next_step            text,
  probability          numeric CHECK (probability >= 0 AND probability <= 100),
  contracted_value     numeric,
  confirmed_revenue    numeric,
  invoice_ref          text,
  po_ref               text,
  invoice_date         date,
  po_date              date,
  payment_status       text CHECK (payment_status IN ('none','invoiced','partial','paid','overdue')),
  lead_source          text CHECK (lead_source IN ('referral','inbound','cold_outreach','event','partner','other')),
  competitors          text,
  loss_reason          text,
  tags                 text[] NOT NULL DEFAULT '{}',
  notes                text,
  last_activity_at     timestamptz,
  stage_entered_at     timestamptz,
  closed_at            timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_deals_org_id     ON deals(org_id);
CREATE INDEX idx_deals_user_id    ON deals(user_id);
CREATE INDEX idx_deals_company_id ON deals(company_id);
CREATE INDEX idx_deals_stage      ON deals(stage);

-- ============================================================
-- DEAL_CONTACTS  (many-to-many)
-- ============================================================
CREATE TABLE deal_contacts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id    uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (deal_id, contact_id)
);
ALTER TABLE deal_contacts ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_deal_contacts_deal_id    ON deal_contacts(deal_id);
CREATE INDEX idx_deal_contacts_contact_id ON deal_contacts(contact_id);

-- ============================================================
-- TASKS
-- ============================================================
CREATE TABLE tasks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id       uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  contact_id   uuid REFERENCES contacts(id) ON DELETE SET NULL,
  deal_id      uuid REFERENCES deals(id) ON DELETE SET NULL,
  title        text NOT NULL,
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','cancelled')),
  priority     text CHECK (priority IN ('low','medium','high')),
  due_date     date,
  ai_generated boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_tasks_org_id     ON tasks(org_id);
CREATE INDEX idx_tasks_user_id    ON tasks(user_id);
CREATE INDEX idx_tasks_contact_id ON tasks(contact_id);
CREATE INDEX idx_tasks_deal_id    ON tasks(deal_id);

-- ============================================================
-- EVENTS  (activity log)
-- ============================================================
CREATE TABLE events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id        uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  contact_id    uuid REFERENCES contacts(id) ON DELETE SET NULL,
  deal_id       uuid REFERENCES deals(id) ON DELETE SET NULL,
  company_id    uuid REFERENCES companies(id) ON DELETE SET NULL,
  type          text NOT NULL CHECK (type IN ('call','meeting','email','demo','other')),
  summary       text,
  ai_confidence numeric CHECK (ai_confidence >= 0 AND ai_confidence <= 1),
  metadata      jsonb NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_events_org_id     ON events(org_id);
CREATE INDEX idx_events_user_id    ON events(user_id);
CREATE INDEX idx_events_contact_id ON events(contact_id);
CREATE INDEX idx_events_deal_id    ON events(deal_id);
CREATE INDEX idx_events_company_id ON events(company_id);

-- ============================================================
-- CONVERSATIONS  (AI sandbox chat history)
-- ============================================================
CREATE TABLE conversations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id     uuid REFERENCES organisations(id) ON DELETE CASCADE,
  source     text NOT NULL DEFAULT 'sandbox',
  title      text NOT NULL,
  messages   jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_org_id  ON conversations(org_id);

-- ============================================================
-- TOKEN_USAGE  (AI API consumption tracking)
-- ============================================================
CREATE TABLE token_usage (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id        uuid REFERENCES organisations(id) ON DELETE CASCADE,
  route         text NOT NULL,
  model         text NOT NULL,
  input_tokens  integer NOT NULL,
  output_tokens integer NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE token_usage ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_token_usage_org_id     ON token_usage(org_id);
CREATE INDEX idx_token_usage_user_id    ON token_usage(user_id);
CREATE INDEX idx_token_usage_created_at ON token_usage(created_at);

-- ============================================================
-- FEEDBACK
-- ============================================================
CREATE TABLE feedback (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id     uuid REFERENCES organisations(id) ON DELETE CASCADE,
  page       text,
  category   text,
  rating     integer CHECK (rating >= 1 AND rating <= 5),
  text       text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_feedback_org_id  ON feedback(org_id);
CREATE INDEX idx_feedback_user_id ON feedback(user_id);

-- ============================================================
-- WAITLIST
-- ============================================================
CREATE TABLE waitlist (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email              text NOT NULL,
  status             text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved')),
  approved_at        timestamptz,
  approved_by_email  text,
  created_at         timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_waitlist_user_id ON waitlist(user_id);

-- ============================================================
-- SUBSCRIPTIONS
-- ============================================================
CREATE TABLE subscriptions (
  org_id     uuid PRIMARY KEY REFERENCES organisations(id) ON DELETE CASCADE,
  plan       text NOT NULL CHECK (plan IN ('free','pro','business')),
  seats      integer NOT NULL,
  status     text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- ANNOUNCEMENTS
-- ============================================================
CREATE TABLE announcements (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text NOT NULL,
  body         text NOT NULL,
  image_url    text,
  link_url     text,
  published    boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- APP_SETTINGS  (admin key-value config)
-- ============================================================
CREATE TABLE app_settings (
  key        text PRIMARY KEY,
  value      jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- DEAL_STAGE_VELOCITY  (pipeline analytics)
-- ============================================================
CREATE TABLE deal_stage_velocity (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id      uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  stage       text NOT NULL,
  transitions integer NOT NULL DEFAULT 0,
  avg_days    numeric NOT NULL DEFAULT 0,
  min_days    integer NOT NULL DEFAULT 0,
  max_days    integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE deal_stage_velocity ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_deal_stage_velocity_org_id ON deal_stage_velocity(org_id);

-- ============================================================
-- DEAL_STAGE_CONVERSION  (pipeline analytics)
-- ============================================================
CREATE TABLE deal_stage_conversion (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id           uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  stage            text NOT NULL,
  deals_entered    integer NOT NULL DEFAULT 0,
  deals_advanced   integer NOT NULL DEFAULT 0,
  deals_lost_here  integer NOT NULL DEFAULT 0,
  advance_rate_pct numeric NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE deal_stage_conversion ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_deal_stage_conversion_org_id ON deal_stage_conversion(org_id);

-- ============================================================
-- REP_QUOTA_ATTAINMENT  (sales rep performance)
-- ============================================================
CREATE TABLE rep_quota_attainment (
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id            uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  role              text CHECK (role IN ('member','manager','admin')),
  quota             numeric,
  quota_period      text NOT NULL DEFAULT 'quarterly',
  confirmed_revenue numeric NOT NULL DEFAULT 0,
  pipeline_value    numeric NOT NULL DEFAULT 0,
  attainment_pct    numeric,
  gap_to_quota      numeric,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, org_id)
);
ALTER TABLE rep_quota_attainment ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_rep_quota_attainment_org_id ON rep_quota_attainment(org_id);

-- ============================================================
-- NOTE ON RLS POLICIES
-- ============================================================
-- Row Level Security is enabled on all tables above.
-- You need to add your own RLS policies based on your auth setup.
-- A typical pattern for org-scoped data:
--
-- CREATE POLICY "members can read own org data" ON contacts
--   FOR SELECT USING (
--     org_id IN (
--       SELECT org_id FROM organisation_members WHERE user_id = auth.uid()
--     )
--   );
--
-- Add equivalent INSERT / UPDATE / DELETE policies as needed.
-- See: https://supabase.com/docs/guides/database/row-level-security
