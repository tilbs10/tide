import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { trackEvent } from '../_shared/klaviyo.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const { session_id, email, product_slug, colour, quantity, event_type } = body;

    if (!session_id || !event_type) {
      return new Response(JSON.stringify({ error: 'session_id and event_type are required.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // ── Insert cart event ──────────────────────────────────────────────────
    const { error: insertError } = await supabase.from('cart_events').insert({
      session_id,
      email: email?.toLowerCase().trim() || null,
      product_slug: product_slug || null,
      colour: colour || null,
      quantity: quantity ? parseInt(quantity) : null,
      event_type,
    });

    if (insertError) {
      console.error('[track-cart] Insert error:', insertError);
    }

    // ── Klaviyo: fire abandon event ────────────────────────────────────────
    if (event_type === 'abandon' && email) {
      const klaviyoKey = Deno.env.get('KLAVIYO_PRIVATE_KEY');
      if (klaviyoKey) {
        try {
          // Fetch the full session cart from cart_events to build line items
          const { data: cartItems } = await supabase
            .from('cart_events')
            .select('product_slug, colour, quantity')
            .eq('session_id', session_id)
            .eq('event_type', 'add');

          await trackEvent(klaviyoKey, {
            name: 'Started Checkout',
            email: email.toLowerCase().trim(),
            properties: {
              session_id,
              items: cartItems ?? [],
              abandoned_product: product_slug,
              abandoned_colour: colour,
            },
          });
        } catch (err) {
          console.error('[track-cart] Klaviyo abandon sync failed:', err);
        }
      }
    }

    // ── Klaviyo: fire order complete event ─────────────────────────────────
    if (event_type === 'checkout' && email) {
      const klaviyoKey = Deno.env.get('KLAVIYO_PRIVATE_KEY');
      if (klaviyoKey) {
        try {
          const { data: cartItems } = await supabase
            .from('cart_events')
            .select('product_slug, colour, quantity')
            .eq('session_id', session_id)
            .eq('event_type', 'add');

          await trackEvent(klaviyoKey, {
            name: 'Placed Order',
            email: email.toLowerCase().trim(),
            properties: {
              session_id,
              items: cartItems ?? [],
            },
          });
        } catch (err) {
          console.error('[track-cart] Klaviyo checkout sync failed:', err);
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[track-cart] Unexpected error:', err);
    return new Response(JSON.stringify({ error: 'Something went wrong.' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
