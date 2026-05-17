// Internal edge function — protected by X-Internal-Secret header
// Called by other edge functions or manually for backfill operations

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { upsertProfile, subscribeToList, trackEvent } from '../_shared/klaviyo.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // ── Internal secret check ────────────────────────────────────────────────
  const secret = req.headers.get('x-internal-secret');
  if (secret !== Deno.env.get('INTERNAL_SECRET')) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const { type, payload } = body;
    // type: 'subscriber' | 'abandon' | 'order'

    const klaviyoKey  = Deno.env.get('KLAVIYO_PRIVATE_KEY')!;
    const klaviyoList = Deno.env.get('KLAVIYO_LIST_ID')!;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    if (type === 'subscriber') {
      const { email, first_name, date_of_birth, goggle_interest, child_age, source } = payload;

      await upsertProfile(klaviyoKey, { email, first_name, date_of_birth, goggle_interest, child_age, source });
      await subscribeToList(klaviyoKey, klaviyoList, email, source ?? 'newsletter_footer');

      await supabase
        .from('subscribers')
        .update({ klaviyo_synced: true })
        .eq('email', email);
    }

    if (type === 'abandon') {
      const { email, session_id, items } = payload;
      await trackEvent(klaviyoKey, {
        name: 'Started Checkout',
        email,
        properties: { session_id, items: items ?? [] },
      });
    }

    if (type === 'order') {
      const { email, order_id, line_items, total } = payload;
      await trackEvent(klaviyoKey, {
        name: 'Placed Order',
        email,
        value: total,
        properties: { order_id, line_items: line_items ?? [] },
      });
    }

    // Backfill: sync all unsynced subscribers
    if (type === 'backfill') {
      const { data: unsynced } = await supabase
        .from('subscribers')
        .select('*')
        .eq('klaviyo_synced', false)
        .limit(50);

      for (const sub of unsynced ?? []) {
        try {
          await upsertProfile(klaviyoKey, {
            email: sub.email,
            first_name: sub.first_name,
            date_of_birth: sub.date_of_birth,
            goggle_interest: sub.goggle_interest,
            child_age: sub.child_age,
            source: sub.source,
          });
          await subscribeToList(klaviyoKey, klaviyoList, sub.email, sub.source ?? 'newsletter_footer');
          await supabase.from('subscribers').update({ klaviyo_synced: true }).eq('id', sub.id);
        } catch (err) {
          console.error('[sync-to-klaviyo] backfill failed for', sub.email, err);
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[sync-to-klaviyo] Error:', err);
    return new Response(JSON.stringify({ error: 'Sync failed.' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
