-- Tidepop Supabase Schema
-- Run this in the Supabase SQL editor or via supabase db push

-- ── Tables ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS subscribers (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  email             text          UNIQUE NOT NULL,
  first_name        text,
  date_of_birth     date,
  goggle_interest   text          CHECK (goggle_interest IN ('hybrid', 'mask', 'mini') OR goggle_interest IS NULL),
  child_age         integer       CHECK (child_age > 0 AND child_age < 18),
  source            text          CHECK (source IN ('newsletter_footer', 'checkout', 'popup')),
  consent_given     boolean       NOT NULL DEFAULT false,
  consent_timestamp timestamptz,
  consent_ip        text,
  klaviyo_synced    boolean       DEFAULT false,
  created_at        timestamptz   DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cart_events (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    text        NOT NULL,
  email         text,
  product_slug  text        CHECK (product_slug IN ('hybrid', 'mask', 'mini')),
  colour        text,
  quantity      integer     CHECK (quantity > 0),
  event_type    text        NOT NULL CHECK (event_type IN ('add', 'remove', 'abandon', 'checkout')),
  created_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text          NOT NULL,
  first_name  text,
  last_name   text,
  line_items  jsonb,
  subtotal    numeric(10,2),
  shipping    numeric(10,2),
  total       numeric(10,2),
  status      text          DEFAULT 'pending',
  created_at  timestamptz   DEFAULT now()
);

CREATE TABLE IF NOT EXISTS page_views (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      text,
  page            text,
  product_viewed  text,
  referrer        text,
  created_at      timestamptz DEFAULT now()
);

-- ── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS subscribers_email_idx       ON subscribers (email);
CREATE INDEX IF NOT EXISTS subscribers_klaviyo_idx     ON subscribers (klaviyo_synced) WHERE klaviyo_synced = false;
CREATE INDEX IF NOT EXISTS cart_events_session_idx     ON cart_events (session_id);
CREATE INDEX IF NOT EXISTS cart_events_email_idx       ON cart_events (email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS cart_events_type_idx        ON cart_events (event_type);
CREATE INDEX IF NOT EXISTS orders_email_idx            ON orders (email);
CREATE INDEX IF NOT EXISTS page_views_session_idx      ON page_views (session_id);

-- ── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE subscribers  ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_events  ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders       ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_views   ENABLE ROW LEVEL SECURITY;

-- No public SELECT on any table
-- Service role bypasses RLS automatically — no explicit policies needed for service role

-- Allow anonymous INSERT on subscribers (frontend → edge function → DB)
CREATE POLICY "anon_insert_subscribers"
  ON subscribers FOR INSERT
  TO anon
  WITH CHECK (consent_given = true);

-- Allow anonymous INSERT on cart_events
CREATE POLICY "anon_insert_cart_events"
  ON cart_events FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow anonymous INSERT on page_views
CREATE POLICY "anon_insert_page_views"
  ON page_views FOR INSERT
  TO anon
  WITH CHECK (true);

-- orders — no anon access at all (service role only)
-- (no policies = no access for any non-service role)
