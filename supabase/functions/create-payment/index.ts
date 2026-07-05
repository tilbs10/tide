// create-payment — charges a Square card token server-side, records the order,
// and fires the Klaviyo "Placed Order" event.
//
// Secrets required (supabase secrets set ...):
//   SQUARE_ACCESS_TOKEN   Square Developer Dashboard → Credentials
//   SQUARE_LOCATION_ID    Square Dashboard → Locations
//   SQUARE_ENV            'sandbox' (default) or 'production'
// Plus the shared SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / KLAVIYO_PRIVATE_KEY.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { trackEvent } from '../_shared/klaviyo.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Canonical catalogue — keep in sync with data/products.json.
// Prices are verified server-side; client-submitted prices are never trusted.
const CATALOGUE: Record<number, { name: string; variation: string; slug: string; price: number }> = {
  1:  { name: 'Tidepop Hybrid Goggle', variation: 'Dark Blue',   slug: 'hybrid', price: 34.99 },
  2:  { name: 'Tidepop Hybrid Goggle', variation: 'Light Blue',  slug: 'hybrid', price: 34.99 },
  3:  { name: 'Tidepop Hybrid Goggle', variation: 'Lime Green',  slug: 'hybrid', price: 34.99 },
  4:  { name: 'Tidepop Hybrid Goggle', variation: 'Hot Pink',    slug: 'hybrid', price: 34.99 },
  5:  { name: 'Tidepop Hybrid Goggle', variation: 'Purple',      slug: 'hybrid', price: 34.99 },
  6:  { name: 'Tidepop Mask Goggle',   variation: 'Mint Green',  slug: 'mask',   price: 29.99 },
  7:  { name: 'Tidepop Mask Goggle',   variation: 'Baby Blue',   slug: 'mask',   price: 29.99 },
  8:  { name: 'Tidepop Mask Goggle',   variation: 'Baby Pink',   slug: 'mask',   price: 29.99 },
  9:  { name: 'Tidepop Mask Goggle',   variation: 'Black',       slug: 'mask',   price: 29.99 },
  10: { name: 'Tidepop Mask Goggle',   variation: 'Coral Pink',  slug: 'mask',   price: 29.99 },
  11: { name: 'Tidepop Mask Goggle',   variation: 'Yellow',      slug: 'mask',   price: 29.99 },
  12: { name: 'Tidepop Mini Goggle',   variation: 'Pink/Yellow', slug: 'mini',   price: 17.99 },
  13: { name: 'Tidepop Mini Goggle',   variation: 'Pink/Purple', slug: 'mini',   price: 17.99 },
  14: { name: 'Tidepop Mini Goggle',   variation: 'Black/Green', slug: 'mini',   price: 17.99 },
  15: { name: 'Tidepop Mini Goggle',   variation: 'Blue/Yellow', slug: 'mini',   price: 17.99 },
};

const FREE_SHIPPING_THRESHOLD = 50;
const SHIPPING_FLAT = 8.95;

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  try {
    const body = await req.json();
    const { source_id, idempotency_key, session_id, email, name, address, items } = body;

    if (!source_id || !idempotency_key || !email || !name || !Array.isArray(items) || items.length === 0) {
      return json(400, { error: 'source_id, idempotency_key, email, name and items are required.' });
    }
    if (!address?.street || !address?.suburb || !address?.state || !address?.postcode) {
      return json(400, { error: 'A full shipping address is required.' });
    }

    // ── Rebuild the order from the canonical catalogue ─────────────────────
    const lineItems = [];
    let subtotal = 0;
    for (const item of items) {
      const product = CATALOGUE[item?.id];
      const qty = parseInt(item?.qty);
      if (!product || !Number.isInteger(qty) || qty < 1 || qty > 99) {
        return json(400, { error: 'Cart contains an invalid item. Please refresh and try again.' });
      }
      lineItems.push({ id: item.id, name: product.name, variation: product.variation, slug: product.slug, price: product.price, qty });
      subtotal += product.price * qty;
    }
    subtotal = Math.round(subtotal * 100) / 100;
    const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FLAT;
    const total = Math.round((subtotal + shipping) * 100) / 100;
    const amountCents = Math.round(total * 100);

    // ── Charge via Square Payments API ─────────────────────────────────────
    const squareToken = Deno.env.get('SQUARE_ACCESS_TOKEN');
    const locationId  = Deno.env.get('SQUARE_LOCATION_ID');
    if (!squareToken || !locationId) {
      console.error('[create-payment] Square secrets not configured');
      return json(500, { error: 'Payments are not configured yet. Please try again later.' });
    }
    const squareHost = Deno.env.get('SQUARE_ENV') === 'production'
      ? 'https://connect.squareup.com'
      : 'https://connect.squareupsandbox.com';

    const squareRes = await fetch(`${squareHost}/v2/payments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${squareToken}`,
        'Square-Version': '2024-01-18',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source_id,
        idempotency_key,
        location_id: locationId,
        amount_money: { amount: amountCents, currency: 'AUD' },
        buyer_email_address: email,
        note: `Tidepop web order — ${lineItems.reduce((n, i) => n + i.qty, 0)} item(s)`,
      }),
    });

    const squareJson = await squareRes.json();
    if (!squareRes.ok) {
      const detail = squareJson?.errors?.[0]?.detail || 'Your card could not be charged.';
      console.error('[create-payment] Square error:', JSON.stringify(squareJson?.errors));
      return json(402, { error: detail });
    }

    const payment = squareJson.payment;
    const cleanEmail = email.toLowerCase().trim();
    const [firstName, ...rest] = String(name).trim().split(/\s+/);
    const orderRef = 'TP-' + String(payment.id).slice(-8).toUpperCase();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // ── Record the order ───────────────────────────────────────────────────
    const { error: orderError } = await supabase.from('orders').insert({
      email: cleanEmail,
      first_name: firstName || null,
      last_name: rest.join(' ') || null,
      line_items: lineItems,
      subtotal,
      shipping,
      total,
      status: 'paid',
      session_id: session_id || null,
      shipping_address: address,
      square_payment_id: payment.id,
      currency: 'AUD',
    });
    if (orderError) {
      // Payment succeeded — never fail the request over a bookkeeping error
      console.error('[create-payment] Order insert error:', orderError);
    }

    // ── Record the checkout cart event ─────────────────────────────────────
    if (session_id) {
      const { error: eventError } = await supabase.from('cart_events').insert({
        session_id,
        email: cleanEmail,
        event_type: 'checkout',
      });
      if (eventError) console.error('[create-payment] Cart event insert error:', eventError);
    }

    // ── Klaviyo: Placed Order ──────────────────────────────────────────────
    const klaviyoKey = Deno.env.get('KLAVIYO_PRIVATE_KEY');
    if (klaviyoKey) {
      try {
        await trackEvent(klaviyoKey, {
          name: 'Placed Order',
          email: cleanEmail,
          value: total,
          properties: {
            order_ref: orderRef,
            session_id: session_id || null,
            items: lineItems,
            subtotal,
            shipping,
            total,
          },
        });
      } catch (err) {
        console.error('[create-payment] Klaviyo sync failed:', err);
      }
    }

    return json(200, {
      success: true,
      order_ref: orderRef,
      payment_id: payment.id,
      receipt_url: payment.receipt_url ?? null,
      total,
    });

  } catch (err) {
    console.error('[create-payment] Unexpected error:', err);
    return json(500, { error: 'Something went wrong. Please try again.' });
  }
});
