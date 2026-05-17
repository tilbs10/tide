# Klaviyo Flows — Tidepop

Set these up manually in the Klaviyo dashboard after the integration is live.
All flows are triggered by events or list subscriptions sent by the Supabase edge functions.

---

## 1. Welcome Series

**Trigger:** Profile subscribes to the Tidepop list (list subscription trigger)
**Goal:** Deliver the 10% code, educate on the range, convert to first purchase

| Delay | Email | Subject | Content |
|-------|-------|---------|---------|
| Immediately | Welcome + 10% Code | "Welcome to Tidepop — here's 10% off" | Brand intro, discount code, link to shop |
| 3 days | Which Goggle? | "Not sure which goggle is right?" | Quick comparison: Hybrid vs Mask vs Mini, link to each product page |
| 7 days | Social Proof | "What families are saying about Tidepop" | Pull in review quotes, star ratings, link to shop |

**Filters:**
- Do not send if `placed_order` event has fired

---

## 2. Abandoned Cart

**Trigger:** "Started Checkout" event fires (from track-cart edge function, event_type: 'abandon')
**Goal:** Recover abandoned sessions

| Delay | Email | Subject | Content |
|-------|-------|---------|---------|
| 1 hour | Gentle Reminder | "You left something behind" | Show abandoned product (from event properties), link back to product page |
| 24 hours | Nudge with Incentive | "Still thinking? Here's 10% to decide" | Discount code for first-time purchasers only (use Klaviyo filter: no previous orders) |

**Filters:**
- Exit flow immediately if "Placed Order" event fires
- Only send 24hr email if customer has never placed an order

**Event properties available (from track-cart edge function):**
- `abandoned_product` — 'hybrid' | 'mask' | 'mini'
- `abandoned_colour`
- `session_id`
- `items` array

---

## 3. Post-Purchase

**Trigger:** "Placed Order" event fires (from track-cart edge function, event_type: 'checkout')
**Goal:** Delight the customer, collect a review, encourage repeat purchase

| Delay | Email | Subject | Content |
|-------|-------|---------|---------|
| 1 day | Order Confirmed | "Your Tidepop goggles are on the way!" | Order summary, goggle care tips (rinse with fresh water, keep in bag), expected delivery |
| 14 days | Review Request | "How are the goggles?" | Star rating CTA, link to leave a review on Google or your platform |
| 60 days | Reorder / Upsell | "Time for another adventure?" | Show the other goggle styles they haven't tried, link to shop |

**Filters:**
- Day 60 email: suppress if customer has already placed a second order

---

## 4. Win-Back

**Trigger:** Smart segment — subscribed to list AND no "Placed Order" event in the last 90 days
**Goal:** Re-engage lapsed subscribers

| Delay | Email | Subject | Content |
|-------|-------|---------|---------|
| Immediately | We miss you | "It's been a while — here's what's new at Tidepop" | Show current range, any new colours, lifestyle photo, link to shop |

**Filters:**
- Suppress if customer has placed an order in the last 90 days
- Only send once per 90-day window

---

## 5. Child Age Milestone (Upsell)

**Trigger:** Date-based filter on the `child_age` custom property
**Goal:** Upsell Mini Goggle buyers to the Hybrid when their child ages out of the Mini (ages 3–7)

**Setup in Klaviyo:**
1. Create a segment: `goggle_interest = 'mini'` OR `last purchase product = 'mini'`
2. AND `child_age` was between 3–6 at time of purchase
3. Date trigger: when child would be turning 7 or 8 (calculate from `date_of_birth` or estimate from `child_age` + `created_at`)

| Email | Subject | Content |
|-------|---------|---------|
| Milestone email | "Is your little swimmer ready to level up?" | "They've grown — the Hybrid Goggle is the perfect next step for 7–8 year olds." Link to hybrid.html |

**Notes:**
- Klaviyo's conditional splits can handle the age calculation using profile property date logic
- Alternatively, run this as a manual campaign quarterly against the Mini buyer segment

---

## Klaviyo Setup Checklist

- [ ] Create list: "Tidepop Subscribers" — note the List ID and add to KLAVIYO_LIST_ID env var
- [ ] Generate Private API Key with `Full Access` → add to KLAVIYO_PRIVATE_KEY env var
- [ ] Create metric: "Started Checkout" (auto-created on first event)
- [ ] Create metric: "Placed Order" (auto-created on first event)
- [ ] Build flows 1–5 above
- [ ] Test subscribe flow with a real email address
- [ ] Verify "Started Checkout" fires on a test cart abandon (check Activity Feed in Klaviyo)
