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
    const body = await req.json()
    const {
      email,
      first_name,
      last_name,
      phone,
      role,
      status,
      company_id,
      is_global_user
    } = body

    // Generate a temporary password if none provided
    const password = body.password || (() => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
      const array = new Uint8Array(16)
      crypto.getRandomValues(array)
      return Array.from(array, b => chars[b % chars.length]).join('')
    })()

    console.log('Creating user by admin:', email, 'role:', role)

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

    // Verify the requesting user has admin privileges
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !requestingUser) {
      throw new Error('Invalid token')
    }

    // Check if requesting user has admin role
    const { data: requestingUserData } = await supabaseAdmin
      .from('users')
      .select('role, company_id')
      .eq('id', requestingUser.id)
      .single()

    const allowedRoles = ['superadmin', 'admin', 'hr', 'company_admin']
    if (!allowedRoles.includes(requestingUserData?.role)) {
      throw new Error('Only admins can create users')
    }

    // For non-superadmin roles, ensure they can only create users in their own company
    if (requestingUserData?.role !== 'superadmin' && company_id && requestingUserData?.company_id) {
      if (company_id !== requestingUserData.company_id) {
        throw new Error('You can only create users in your own company')
      }
    }

    // 1. Create the auth user with password
    const { data: authData, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // Auto-confirm email for admin-created users
      user_metadata: {
        first_name: first_name,
        last_name: last_name,
        role: role
      }
    })

    if (createAuthError || !authData.user) {
      console.error('Auth user creation error:', createAuthError)
      throw createAuthError || new Error('Failed to create auth user')
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
        role: role,
        status: status || 'active',
        company_id: company_id || null,
        is_global_user: is_global_user || false,
        hired_date: new Date().toISOString(),
        plain_password: password
      }])
      .select()
      .single()

    if (userError) {
      console.error('User insert error:', userError)
      // Rollback: delete auth user if database insert fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      throw userError
    }

    console.log('User created successfully:', userData.id)

    return new Response(
      JSON.stringify({
        success: true,
        data: userData,
        message: 'Użytkownik utworzony pomyślnie'
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
