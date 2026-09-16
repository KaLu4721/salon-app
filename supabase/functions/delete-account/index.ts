// Supabase Edge Function: delete-account
//
// Deletes the calling user's own account. Must be invoked by an authenticated
// client (supabase.functions.invoke('delete-account')) which forwards the
// user's access token in the Authorization header.
//
// Deploy: supabase functions deploy delete-account
// Requires these secrets to be set on the project (never commit real values):
//   SUPABASE_URL              - project URL
//   SUPABASE_SERVICE_ROLE_KEY - service-role key (server-side only, never in the app)
// (SUPABASE_URL/SUPABASE_ANON_KEY/SUPABASE_SERVICE_ROLE_KEY are auto-injected
// by the Supabase platform for Edge Functions, so no manual `supabase secrets set`
// is usually needed for these three.)

import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Client scoped to the caller's own token, used only to verify who is calling.
    const callerClient = createClient(supabaseUrl, serviceRoleKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: userError } = await callerClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired session' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Admin client (service-role key) for privileged operations.
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    // Anonymize the user's own bookings instead of deleting them, so the
    // salon keeps its booking history. Requires termini.korisnik_id to be
    // nullable — verify this in the Supabase dashboard before relying on it.
    const { error: anonymizeError } = await adminClient
      .from('termini')
      .update({ korisnik_id: null })
      .eq('korisnik_id', user.id)

    if (anonymizeError) {
      console.error('anonymize termini failed:', anonymizeError.message)
      return new Response(JSON.stringify({ error: anonymizeError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id, false)

    if (deleteError) {
      console.error('deleteUser failed:', deleteError.message)
      return new Response(JSON.stringify({ error: deleteError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('unhandled error:', err)
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
