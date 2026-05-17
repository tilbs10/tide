import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { upsertProfile, subscribeToList } from '../_shared/klaviyo.ts';

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
    const { email, first_name, date_of_birth, goggle_interest, child_age, source, consent_ip } = body;

    // ── Validate email ─────────────────────────────────────────────────────
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return new Response(JSON.stringify({ error: 'A valid email address is required.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Supabase client (service role — bypasses RLS) ───────────────────────
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // ── Upsert subscriber ──────────────────────────────────────────────────
    const { error: upsertError } = await supabase
      .from('subscribers')
      .upsert(
        {
          email: email.toLowerCase().trim(),
          first_name: first_name?.trim() || null,
          date_of_birth: date_of_birth || null,
          goggle_interest: goggle_interest || null,
          child_age: child_age ? parseInt(child_age) : null,
          source: source || 'newsletter_footer',
          consent_given: true,
          consent_timestamp: new Date().toISOString(),
          consent_ip: consent_ip || null,
          klaviyo_synced: false,
        },
        { onConflict: 'email', ignoreDuplicates: false }
      );

    if (upsertError) {
      console.error('[subscribe] Supabase upsert error:', upsertError);
      return new Response(JSON.stringify({ error: 'Failed to save subscription.' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Sync to Klaviyo (non-blocking — failure does not break response) ───
    const klaviyoKey  = Deno.env.get('KLAVIYO_PRIVATE_KEY');
    const klaviyoList = Deno.env.get('KLAVIYO_LIST_ID');

    if (klaviyoKey && klaviyoList) {
      try {
        await upsertProfile(klaviyoKey, {
          email: email.toLowerCase().trim(),
          first_name: first_name || null,
          date_of_birth: date_of_birth || null,
          goggle_interest: goggle_interest || null,
          child_age: child_age ? parseInt(child_age) : null,
          source: source || 'newsletter_footer',
        });

        await subscribeToList(klaviyoKey, klaviyoList, email.toLowerCase().trim(), source || 'Newsletter Footer');

        // Mark synced
        await supabase
          .from('subscribers')
          .update({ klaviyo_synced: true })
          .eq('email', email.toLowerCase().trim());

      } catch (klaviyoErr) {
        // Log but do not fail the request
        console.error('[subscribe] Klaviyo sync failed:', klaviyoErr);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[subscribe] Unexpected error:', err);
    return new Response(JSON.stringify({ error: 'Something went wrong. Please try again.' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
