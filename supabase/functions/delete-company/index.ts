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
    const { companyId } = await req.json()

    if (!companyId) {
      throw new Error('companyId is required')
    }

    console.log('Deleting company:', companyId)

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

    // Verify that the requesting user is a superadmin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user: requestingUser } } = await supabaseAdmin.auth.getUser(token)

    if (!requestingUser) {
      throw new Error('Invalid token')
    }

    // Check if requesting user is superadmin
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', requestingUser.id)
      .single()

    if (!userData || userData.role !== 'superadmin') {
      throw new Error('Only superadmins can delete companies')
    }

    // Check if company has users
    const { data: companyUsers, error: usersCheckError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('company_id', companyId)

    if (usersCheckError) {
      console.error('Error checking company users:', usersCheckError)
    }

    if (companyUsers && companyUsers.length > 0) {
      throw new Error(`Nie można usunąć firmy, która ma ${companyUsers.length} użytkowników. Najpierw usuń lub przenieś użytkowników.`)
    }

    // Get company name for response
    const { data: companyData } = await supabaseAdmin
      .from('companies')
      .select('name')
      .eq('id', companyId)
      .single()

    const companyName = companyData?.name || 'Unknown'

    // Delete related records first (using service_role bypasses RLS)
    console.log('Deleting company_modules...')
    const { error: modulesError } = await supabaseAdmin
      .from('company_modules')
      .delete()
      .eq('company_id', companyId)
    if (modulesError) console.log('Error deleting company_modules:', modulesError)

    console.log('Deleting bonus_transactions...')
    const { error: bonusError } = await supabaseAdmin
      .from('bonus_transactions')
      .delete()
      .eq('company_id', companyId)
    if (bonusError) console.log('Error deleting bonus_transactions:', bonusError)

    console.log('Deleting subscription_history...')
    const { error: historyError } = await supabaseAdmin
      .from('subscription_history')
      .delete()
      .eq('company_id', companyId)
    if (historyError) console.log('Error deleting subscription_history:', historyError)

    console.log('Deleting module_user_access...')
    const { error: accessError } = await supabaseAdmin
      .from('module_user_access')
      .delete()
      .eq('company_id', companyId)
    if (accessError) console.log('Error deleting module_user_access:', accessError)

    // Delete the company
    console.log('Deleting company...')
    const { error: companyError } = await supabaseAdmin
      .from('companies')
      .delete()
      .eq('id', companyId)

    if (companyError) {
      throw companyError
    }

    // Verify deletion
    const { data: checkData } = await supabaseAdmin
      .from('companies')
      .select('id')
      .eq('id', companyId)
      .single()

    if (checkData) {
      throw new Error('Failed to delete company')
    }

    console.log('Company deleted successfully:', companyName)

    return new Response(
      JSON.stringify({
        success: true,
        message: `Firma "${companyName}" została usunięta.`
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
