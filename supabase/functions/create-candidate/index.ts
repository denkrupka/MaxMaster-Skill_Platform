import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Priority order for auto-granting module access
const ROLE_PRIORITY = ['hr', 'coordinator', 'brigadir', 'employee', 'trial', 'candidate']

/**
 * Auto-grant module access to a new user if there are free seats.
 * Checks all active company modules and grants access where seats are available.
 */
async function autoGrantAccessForNewUser(supabaseAdmin: any, userId: string, companyId: string) {
  try {
    // Get all active modules for the company
    const { data: activeModules } = await supabaseAdmin
      .from('company_modules')
      .select('id, module_code, max_users')
      .eq('company_id', companyId)
      .eq('is_active', true)

    if (!activeModules || activeModules.length === 0) return

    for (const mod of activeModules) {
      // Count currently enabled users
      const { count } = await supabaseAdmin
        .from('module_user_access')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('module_code', mod.module_code)
        .eq('is_enabled', true)

      const currentEnabled = count || 0

      if (currentEnabled < mod.max_users) {
        // Grant access
        const { error } = await supabaseAdmin
          .from('module_user_access')
          .insert({
            company_id: companyId,
            user_id: userId,
            module_code: mod.module_code,
            is_enabled: true,
            enabled_at: new Date().toISOString()
          })

        if (!error) {
          // Update current_users count
          await supabaseAdmin
            .from('company_modules')
            .update({ current_users: currentEnabled + 1 })
            .eq('id', mod.id)

          console.log(`Auto-granted ${mod.module_code} access to user ${userId}`)
        } else {
          console.error(`Failed to auto-grant ${mod.module_code} access:`, error)
        }
      }
    }
  } catch (err) {
    console.error('autoGrantAccessForNewUser error:', err)
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, first_name, last_name, phone, target_position, source, status, company_id } = await req.json()

    console.log('Creating candidate:', email, 'for company:', company_id)

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

    // 1. First, create the auth user with admin.createUser
    // This ensures we get a valid user ID immediately
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      email_confirm: false, // User needs to confirm via email
      user_metadata: {
        first_name: first_name,
        last_name: last_name,
        role: 'candidate',
        target_position: target_position,
        phone: phone
      }
    })

    if (authError || !authData.user) {
      console.error('Auth user creation error:', authError)
      throw authError || new Error('Failed to create auth user')
    }

    console.log('Auth user created:', authData.user.id)

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
        hired_date: new Date().toISOString(),
        company_id: company_id || null
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

    // 2.5 Auto-grant module access if there are free seats
    if (company_id) {
      await autoGrantAccessForNewUser(supabaseAdmin, userData.id, company_id)
    }

    // 3. Send invitation email with confirmation link
    try {
      const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
        email,
        {
          redirectTo: redirectUrl
        }
      )

      if (inviteError) {
        console.error('Invite email error (non-critical):', inviteError)
        // Don't throw - user is created, email can be resent later
      } else {
        console.log('Invitation email sent to:', email)
      }
    } catch (emailError) {
      console.error('Email sending failed (non-critical):', emailError)
      // Continue - user is created successfully
    }

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
