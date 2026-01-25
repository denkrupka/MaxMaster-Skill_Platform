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
    const { action, userId, password, email, first_name, last_name, phone, role } = await req.json()

    console.log('Managing user:', action, userId)

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

    // Verify that the requesting user is an admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user: requestingUser } } = await supabaseAdmin.auth.getUser(token)

    if (!requestingUser) {
      throw new Error('Invalid token')
    }

    // Check if requesting user is admin
    const { data: adminData } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', requestingUser.id)
      .single()

    if (!adminData || (adminData.role !== 'admin' && adminData.role !== 'superadmin')) {
      throw new Error('Only admins can manage users')
    }

    // Handle different actions
    switch (action) {
      case 'updatePassword': {
        if (!userId || !password) {
          throw new Error('userId and password are required')
        }

        const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
          userId,
          { password }
        )

        if (error) throw error

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Hasło zostało zmienione pomyślnie'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
          }
        )
      }

      case 'updateUser': {
        if (!userId) {
          throw new Error('userId is required')
        }

        // Update auth metadata if needed
        const authUpdates: any = {}
        if (email) authUpdates.email = email
        if (password) authUpdates.password = password

        const userMetadata: any = {}
        if (first_name) userMetadata.first_name = first_name
        if (last_name) userMetadata.last_name = last_name
        if (phone) userMetadata.phone = phone
        if (role) userMetadata.role = role

        if (Object.keys(userMetadata).length > 0) {
          authUpdates.user_metadata = userMetadata
        }

        if (Object.keys(authUpdates).length > 0) {
          const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
            userId,
            authUpdates
          )
          if (authError) throw authError
        }

        // Update database record
        const dbUpdates: any = {}
        if (email) dbUpdates.email = email
        if (first_name) dbUpdates.first_name = first_name
        if (last_name) dbUpdates.last_name = last_name
        if (phone) dbUpdates.phone = phone
        if (role) dbUpdates.role = role
        if (password) dbUpdates.plain_password = password

        if (Object.keys(dbUpdates).length > 0) {
          const { error: dbError } = await supabaseAdmin
            .from('users')
            .update(dbUpdates)
            .eq('id', userId)

          if (dbError) throw dbError
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Użytkownik został zaktualizowany pomyślnie'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
          }
        )
      }

      case 'deleteUser': {
        if (!userId) {
          throw new Error('userId is required')
        }

        // Delete all related data first
        console.log('Deleting user skills...')
        await supabaseAdmin.from('user_skills').delete().eq('user_id', userId)

        console.log('Deleting test attempts...')
        await supabaseAdmin.from('test_attempts').delete().eq('user_id', userId)

        console.log('Deleting candidate history...')
        await supabaseAdmin.from('candidate_history').delete().eq('candidate_id', userId)

        console.log('Deleting employee notes...')
        await supabaseAdmin.from('employee_notes').delete().eq('employee_id', userId)

        console.log('Deleting employee badges...')
        await supabaseAdmin.from('employee_badges').delete().eq('employee_id', userId)

        console.log('Deleting quality incidents...')
        await supabaseAdmin.from('quality_incidents').delete().eq('user_id', userId)

        // Delete from users table
        console.log('Deleting from users table...')
        const { error: userDeleteError } = await supabaseAdmin
          .from('users')
          .delete()
          .eq('id', userId)

        if (userDeleteError) throw userDeleteError

        // Delete from auth
        console.log('Deleting from auth...')
        const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)

        if (authDeleteError) {
          console.error('Auth deletion error (non-critical):', authDeleteError)
          // Don't throw - database records are already deleted
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Użytkownik został całkowicie usunięty z systemu'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
          }
        )
      }

      default:
        throw new Error(`Unknown action: ${action}`)
    }
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
