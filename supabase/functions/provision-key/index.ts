import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Verify the user's JWT and get their identity
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if the user already has a key (maybeSingle returns null instead of error when no row exists)
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('openrouter_key')
      .eq('user_id', user.id)
      .maybeSingle();

    if (fetchError) {
      return new Response(JSON.stringify({ error: 'Failed to fetch user record', detail: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (existingUser?.openrouter_key) {
      // Already has a key — return it
      return new Response(JSON.stringify({ key: existingUser.openrouter_key }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // No key yet — create one via OpenRouter Management API
    const managementKey = Deno.env.get('OPENROUTER_MANAGEMENT_KEY');
    if (!managementKey) {
      return new Response(JSON.stringify({ error: 'Management key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const orResponse = await fetch('https://openrouter.ai/api/v1/keys', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${managementKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `student-${user.id}`,
        limit: 0.50,
        limit_resets: 'monthly',
      }),
    });

    if (!orResponse.ok) {
      const errText = await orResponse.text();
      return new Response(JSON.stringify({ error: 'OpenRouter key creation failed', detail: errText }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const orData = await orResponse.json();
    const newKey = orData.key ?? orData.data?.key;

    if (!newKey) {
      return new Response(JSON.stringify({ error: 'No key returned from OpenRouter', detail: orData }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Save the key — upsert creates the row if it doesn't exist yet
    const { error: upsertError } = await supabase
      .from('users')
      .upsert({
        user_id: user.id,
        email: user.email,
        display_name: user.user_metadata?.full_name ?? user.email,
        openrouter_key: newKey,
      }, { onConflict: 'user_id' });

    if (upsertError) {
      return new Response(JSON.stringify({ error: 'Failed to save key', detail: upsertError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ key: newKey }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Unexpected error', detail: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
