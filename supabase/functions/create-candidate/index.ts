import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, first_name, last_name, phone, target_position, source, status } = await req.json()

    console.log('Creating candidate:', email)

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Get the site URL from environment or use default
    // IMPORTANT: Use email-redirect.html to properly handle Supabase auth tokens
    // This page will extract tokens from hash and redirect to /#/setup-password
    const siteUrl = Deno.env.get('SITE_URL') || 'https://portal.maxmaster.info'
    const redirectUrl = `${siteUrl}/email-redirect.html`

    console.log('Redirect URL:', redirectUrl)

    // 1. Use inviteUserByEmail - this will AUTOMATICALLY send email
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      {
        data: {
          first_name: first_name,
          last_name: last_name,
          role: 'candidate',
          target_position: target_position
        },
        redirectTo: redirectUrl
      }
    )

    if (authError || !authData.user) {
      console.error('Auth error:', authError)
      throw authError || new Error('Failed to invite user')
    }

    console.log('Auth user invited:', authData.user.id)

    // 2. Create record in public.users
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .insert([{
        id: authData.user.id,
        email: email,
        first_name: first_name,
        last_name: last_name,
        phone: phone || null,
        target_position: target_position || null,
        source: source || 'Aplikacja',
        role: 'candidate',
        status: status || 'started',
        hired_date: new Date().toISOString()
      }])
      .select()
      .single()

    if (userError) {
      console.error('User insert error:', userError)
      // Rollback: delete auth user if database insert fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      throw userError
    }

    console.log('Candidate created successfully:', userData.id)

    return new Response(
      JSON.stringify({
        success: true,
        data: userData,
        message: 'Kandydat utworzony. Email z zaproszeniem został wysłany.'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    )
  }
})
