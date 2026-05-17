import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Fire and forget — always return 200
  try {
    const body = await req.json();
    const { session_id, page, product_viewed, referrer } = body;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    supabase.from('page_views').insert({
      session_id: session_id || null,
      page: page || null,
      product_viewed: product_viewed || null,
      referrer: referrer || null,
    }).then(({ error }) => {
      if (error) console.error('[track-pageview] Insert error:', error);
    });

  } catch (err) {
    console.error('[track-pageview] Error:', err);
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
