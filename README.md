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
        ├── POST /functions/v1/track-pageview   → Supabase Edge Function
        └── POST /functions/v1/create-payment   → Supabase Edge Function (checkout.html)

Supabase Edge Functions (Deno/TypeScript)
  ├── subscribe        → writes to subscribers table → calls Klaviyo
  ├── track-cart       → writes to cart_events table → calls Klaviyo on abandon/checkout
  ├── sync-to-klaviyo  → internal, protected by X-Internal-Secret header
  ├── track-pageview   → writes to page_views table (fire and forget)
  └── create-payment   → charges Square token, writes orders row, Klaviyo "Placed Order"

Supabase Postgres
  ├── subscribers      (email captures + consent records)
  ├── cart_events      (add/remove/abandon/checkout events)
  ├── orders           (paid orders written by create-payment)
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
3. Click **Run** — this creates all tables and RLS policies. Then run `supabase/migrations/002_orders_payment.sql` the same way (payment columns on `orders`)
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
supabase functions deploy create-payment
```

### 3. Set Edge Function Environment Variables

In the Supabase dashboard go to **Edge Functions → Manage secrets**, or use the CLI:

```bash
supabase secrets set SUPABASE_URL=https://your-project.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJ...
supabase secrets set KLAVIYO_PRIVATE_KEY=pk_xxx
supabase secrets set KLAVIYO_LIST_ID=XXXXXX
supabase secrets set INTERNAL_SECRET=$(openssl rand -hex 32)
supabase secrets set SQUARE_ACCESS_TOKEN=EAAA...
supabase secrets set SQUARE_LOCATION_ID=LXXXXXXXXXXXX
supabase secrets set SQUARE_ENV=sandbox   # 'production' when going live
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

## Payments (Square)

Checkout flow: `checkout.html` tokenizes the card with the Square Web Payments SDK,
then POSTs the token plus item ids/quantities to the `create-payment` edge function.
The function re-prices the cart from its own catalogue table (client prices are never
trusted), charges Square, inserts the `orders` row, records a `checkout` cart event,
and fires the Klaviyo **Placed Order** event with the order value.

Currently running in **sandbox**. To go live:

1. In `checkout.html`: swap the SDK URL to `https://web.squarecdn.com/v1/square.js`
   and replace `SQUARE_APP_ID` / `SQUARE_LOCATION` with production credentials
2. In Supabase secrets: set production `SQUARE_ACCESS_TOKEN` + `SQUARE_LOCATION_ID`
   and `SQUARE_ENV=production`
3. When product prices change, update both `data/products.json` and the `CATALOGUE`
   table at the top of `supabase/functions/create-payment/index.ts`

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
│   │   ├── 001_initial_schema.sql
│   │   └── 002_orders_payment.sql
│   └── functions/
│       ├── _shared/
│       │   └── klaviyo.ts          Shared Klaviyo API wrapper
│       ├── subscribe/
│       │   └── index.ts
│       ├── track-cart/
│       │   └── index.ts
│       ├── sync-to-klaviyo/
│       │   └── index.ts            Internal — protected by X-Internal-Secret
│       ├── track-pageview/
│       │   └── index.ts
│       └── create-payment/
│           └── index.ts            Square charge + orders row + Klaviyo order event
├── js/
│   ├── tidepop-tracking.js         Frontend tracking module (include on all pages)
│   └── cart.js                     Cart UI (add/remove/toast)
├── .env.example                    Environment variable template
├── KLAVIYO_FLOWS.md                Klaviyo flow documentation
└── README.md                       This file
```
