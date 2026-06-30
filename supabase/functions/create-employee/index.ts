// Supabase Edge Function: create-employee
//
// Lets an authenticated admin create a new staff account (email + password set
// by the admin) without exposing the service-role key to the browser. The
// caller's JWT is verified and their profile role is checked server-side
// before the privileged auth.admin.createUser call is made.
//
// Deploy with: supabase functions deploy create-employee
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
      return json({ error: 'Missing authorization header' }, 401)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    // Client scoped to the caller's JWT, used only to verify identity + role.
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const {
      data: { user },
      error: userError,
    } = await callerClient.auth.getUser()
    if (userError || !user) {
      return json({ error: 'Invalid session' }, 401)
    }

    const { data: callerProfile, error: profileError } = await callerClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    if (profileError || callerProfile?.role !== 'admin') {
      return json({ error: 'Only admins can create staff accounts' }, 403)
    }

    const { full_name, email, password } = await req.json()
    if (!full_name || !email || !password) {
      return json({ error: 'full_name, email, and password are required' }, 400)
    }
    if (password.length < 6) {
      return json({ error: 'Password must be at least 6 characters' }, 400)
    }

    // Privileged client, only used for the single admin-creation call below.
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    })
    if (createError) {
      return json({ error: createError.message }, 400)
    }

    return json({ id: created.user.id }, 200)
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500)
  }
})

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
