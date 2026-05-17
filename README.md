# Tidepop — Developer README

Swimming goggle DTC brand. Static frontend on GitHub Pages + Supabase backend + Klaviyo email marketing.

**Live site:** https://tilbs10.github.io/tide/
**Repo:** https://github.com/tilbs10/tide

---

## Architecture

```
Browser (static GitHub Pages site)
  └── js/tidepop-tracking.js
        ├── POST /functions/v1/subscribe         → Supabase Edge Function
        ├── POST /functions/v1/track-cart        → Supabase Edge Function
        └── POST /functions/v1/track-pageview   → Supabase Edge Function

Supabase Edge Functions (Deno/TypeScript)
  ├── subscribe        → writes to subscribers table → calls Klaviyo
  ├── track-cart       → writes to cart_events table → calls Klaviyo on abandon/checkout
  ├── sync-to-klaviyo  → internal, protected by X-Internal-Secret header
  └── track-pageview   → writes to page_views table (fire and forget)

Supabase Postgres
  ├── subscribers      (email captures + consent records)
  ├── cart_events      (add/remove/abandon/checkout events)
  ├── orders           (order records, populated post-Square integration)
  └── page_views       (anonymous page tracking)

Klaviyo
  ├── Subscriber list  (synced from subscribe function)
  └── Events           (Started Checkout, Placed Order)
```

---

## Initial Setup

### 1. Supabase Project

1. Create a free project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and paste the contents of `supabase/migrations/001_initial_schema.sql`
3. Click **Run** — this creates all tables and RLS policies
4. Go to **Project Settings → API** and copy:
   - **Project URL** → `SUPABASE_URL`
   - **anon public** key → `SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (keep this secret)

### 2. Deploy Edge Functions

Install the Supabase CLI:
```bash
npm install -g supabase
```

Login and link to your project:
```bash
supabase login
supabase link --project-ref your-project-ref
```

Deploy all functions:
```bash
supabase functions deploy subscribe
supabase functions deploy track-cart
supabase functions deploy sync-to-klaviyo
supabase functions deploy track-pageview
```

### 3. Set Edge Function Environment Variables

In the Supabase dashboard go to **Edge Functions → Manage secrets**, or use the CLI:

```bash
supabase secrets set SUPABASE_URL=https://your-project.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJ...
supabase secrets set KLAVIYO_PRIVATE_KEY=pk_xxx
supabase secrets set KLAVIYO_LIST_ID=XXXXXX
supabase secrets set INTERNAL_SECRET=$(openssl rand -hex 32)
```

### 4. Wire the Frontend

Open `js/tidepop-tracking.js` and replace the two placeholders at the top:

```javascript
const SUPABASE_URL      = 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = 'eyJ...your-anon-key...';
```

Then push to GitHub — the static site will pick up the changes automatically.

---

## Klaviyo Setup

1. Create a Klaviyo account at [klaviyo.com](https://klaviyo.com)
2. Go to **Account → Settings → API Keys → Create Private API Key** (Full Access)
3. Go to **Lists & Segments → Create List** — name it "Tidepop Subscribers"
4. Open the list → **Settings** — copy the List ID
5. Add both values to Supabase secrets (step 3 above)

See `KLAVIYO_FLOWS.md` for the 5 email flows to set up in Klaviyo.

---

## Local Development

Run edge functions locally:
```bash
supabase start          # starts local Supabase
supabase functions serve # serves all functions at http://localhost:54321/functions/v1/
```

Test subscribe endpoint:
```bash
curl -X POST http://localhost:54321/functions/v1/subscribe \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_LOCAL_ANON_KEY" \
  -d '{"email":"test@example.com","source":"newsletter_footer","consent_ip":"1.2.3.4"}'
```

---

## Data & Privacy — Australian Compliance

### What data we store

| Table | Data | Retention |
|-------|------|-----------|
| `subscribers` | Email, name, DOB (optional), goggle interest, child age, consent timestamp + IP, source | Until deletion request |
| `cart_events` | Session ID, email (if captured), product, colour, quantity, event type | 12 months |
| `orders` | Email, name, line items, total | 7 years (tax records) |
| `page_views` | Session ID (no PII), page URL, referrer | 90 days |

### Consent

- Consent is captured at point of email submission only
- `consent_given`, `consent_timestamp`, and `consent_ip` are stored on every subscriber record
- The newsletter form must include visible consent text — e.g. *"By subscribing you agree to receive marketing emails from Tidepop. Unsubscribe any time."*
- The checkout form implies consent to transactional emails; marketing consent requires the same notice

### Australian Privacy Act (Privacy Act 1988)

- Personal information is stored in Supabase (hosted on AWS — region configurable)
- For Australian data residency, select the `ap-southeast-2` (Sydney) region when creating your Supabase project
- Tidepop must publish a Privacy Policy listing: what data is collected, how it's used, how to request deletion

### Spam Act 2003

- All marketing emails sent via Klaviyo must include a working unsubscribe link
- Klaviyo handles unsubscribe automatically — do not suppress this
- Transactional emails (order confirmation) do not require unsubscribe but must not contain marketing content

### Handling deletion requests

When a customer requests deletion of their data:

1. In Supabase SQL editor:
```sql
-- Anonymise subscriber record (preserves consent audit trail)
UPDATE subscribers
SET email = 'deleted-' || id || '@tidepop.internal',
    first_name = null,
    date_of_birth = null,
    consent_ip = null
WHERE email = 'customer@example.com';

-- Delete associated events
DELETE FROM cart_events WHERE email = 'customer@example.com';
```

2. In Klaviyo: go to **Profiles → search email → Delete profile**

---

## File Structure

```
tidepop/
├── supabase/
│   ├── migrations/
│   │   └── 001_initial_schema.sql
│   └── functions/
│       ├── _shared/
│       │   └── klaviyo.ts          Shared Klaviyo API wrapper
│       ├── subscribe/
│       │   └── index.ts
│       ├── track-cart/
│       │   └── index.ts
│       ├── sync-to-klaviyo/
│       │   └── index.ts            Internal — protected by X-Internal-Secret
│       └── track-pageview/
│           └── index.ts
├── js/
│   ├── tidepop-tracking.js         Frontend tracking module (include on all pages)
│   └── cart.js                     Cart UI (add/remove/toast)
├── .env.example                    Environment variable template
├── KLAVIYO_FLOWS.md                Klaviyo flow documentation
└── README.md                       This file
```
