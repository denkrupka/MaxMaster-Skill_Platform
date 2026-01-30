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
    const {
      // Company data
      companyName,
      legalName,
      taxId,
      regon,
      addressStreet,
      addressCity,
      addressPostalCode,
      industry,
      employeeCount,
      // Contact person data
      firstName,
      lastName,
      position,
      phone,
      email,
      billingEmail,
      // Referral
      referralCompanyId
    } = await req.json()

    // Validate required fields
    if (!email || !firstName || !lastName || !taxId || !companyName) {
      throw new Error('Brakuje wymaganych danych: email, imię, nazwisko, NIP, nazwa firmy')
    }

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

    const normalizedEmail = email.trim().toLowerCase()

    // 1. Check if email already exists in users table
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (existingUser) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Konto z tym adresem e-mail już istnieje. Zaloguj się lub użyj innego adresu.'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    }

    // 2. Check if email already exists in auth
    const { data: existingAuthUsers } = await supabaseAdmin.auth.admin.listUsers({
      filter: `email.eq.${normalizedEmail}`,
      page: 1,
      perPage: 1
    })

    // Fallback: also check directly
    const { data: { users: authUsersList } } = await supabaseAdmin.auth.admin.listUsers()
    const emailExists = authUsersList?.some((u: any) => u.email === normalizedEmail)

    if (emailExists) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Konto z tym adresem e-mail już istnieje. Zaloguj się lub użyj innego adresu.'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    }

    // 3. Check if company with this NIP already exists
    const cleanNip = taxId.replace(/[\s-]/g, '')
    const { data: existingCompany } = await supabaseAdmin
      .from('companies')
      .select('id')
      .eq('tax_id', cleanNip)
      .maybeSingle()

    if (existingCompany) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Firma o tym NIP jest już zarejestrowana na portalu MaxMaster.'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    }

    console.log('Registering company:', companyName, 'NIP:', cleanNip, 'email:', normalizedEmail)

    // 4. Create auth user (no password - will be set via email confirmation)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      email_confirm: false,
      user_metadata: {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        role: 'company_admin'
      }
    })

    if (authError || !authData.user) {
      console.error('Auth user creation error:', authError)
      throw new Error(authError?.message || 'Nie udało się utworzyć konta użytkownika')
    }

    console.log('Auth user created:', authData.user.id)

    // 5. Create company
    const { data: newCompany, error: companyError } = await supabaseAdmin
      .from('companies')
      .insert([{
        name: companyName,
        legal_name: legalName || companyName,
        tax_id: cleanNip,
        regon: regon || null,
        address_street: addressStreet || null,
        address_city: addressCity || null,
        address_postal_code: addressPostalCode || null,
        address_country: 'PL',
        contact_email: normalizedEmail,
        contact_phone: phone || null,
        billing_email: billingEmail || normalizedEmail,
        industry: industry || null,
        status: 'trial',
        is_blocked: false,
        subscription_status: 'trialing',
        bonus_balance: 0,
        referred_by_company_id: referralCompanyId || null,
        slug: cleanNip
      }])
      .select()
      .single()

    if (companyError) {
      console.error('Company creation error:', companyError)
      // Rollback: delete auth user
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      throw new Error('Nie udało się utworzyć konto firmy. Spróbuj ponownie.')
    }

    console.log('Company created:', newCompany.id)

    // 6. Create user record linked to company
    const { error: userError } = await supabaseAdmin
      .from('users')
      .insert([{
        id: authData.user.id,
        email: normalizedEmail,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone || null,
        role: 'company_admin',
        status: 'active',
        company_id: newCompany.id,
        is_global_user: false,
        position: position || null
      }])

    if (userError) {
      console.error('User creation error:', userError)
      // Rollback: delete company and auth user
      await supabaseAdmin.from('companies').delete().eq('id', newCompany.id)
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      throw new Error('Nie udało się utworzyć konta użytkownika. Spróbuj ponownie.')
    }

    console.log('User record created for:', normalizedEmail)

    // 7. Create CRM company record for sales team
    const employeeCountNum = employeeCount
      ? parseInt(String(employeeCount).replace(/[^0-9]/g, '')) || null
      : null

    let referralCompanyName: string | null = null
    if (referralCompanyId) {
      const { data: refCo } = await supabaseAdmin
        .from('companies')
        .select('name')
        .eq('id', referralCompanyId)
        .maybeSingle()
      referralCompanyName = refCo?.name || null
    }

    const { data: crmCompany } = await supabaseAdmin
      .from('crm_companies')
      .insert([{
        name: companyName,
        legal_name: legalName || companyName,
        tax_id: cleanNip,
        regon: regon || null,
        industry: industry || null,
        address_street: addressStreet || null,
        address_city: addressCity || null,
        address_postal_code: addressPostalCode || null,
        address_country: 'PL',
        employee_count: employeeCountNum,
        status: 'new',
        source: referralCompanyId ? 'referral' : 'self_registration',
        linked_company_id: newCompany.id,
        subscription_status: 'trialing',
        notes: referralCompanyName
          ? `Rejestracja przez polecenie firmy: ${referralCompanyName}`
          : 'Samodzielna rejestracja przez formularz'
      }])
      .select()
      .single()

    // 8. Create CRM contact for the registered person
    if (crmCompany) {
      await supabaseAdmin
        .from('crm_contacts')
        .insert([{
          crm_company_id: crmCompany.id,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: normalizedEmail,
          phone: phone || null,
          position: position || null,
          is_decision_maker: true,
          status: 'active'
        }])
      console.log('CRM company and contact created')
    }

    // 9. Send invitation email with confirmation link
    const siteUrl = Deno.env.get('SITE_URL') || 'https://portal.maxmaster.info'
    const redirectUrl = `${siteUrl}/email-redirect.html`

    try {
      const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
        normalizedEmail,
        { redirectTo: redirectUrl }
      )
      if (inviteError) {
        console.error('Invite email error (non-critical):', inviteError)
      } else {
        console.log('Invitation email sent to:', normalizedEmail)
      }
    } catch (emailError) {
      console.error('Email sending failed (non-critical):', emailError)
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: { companyId: newCompany.id },
        message: 'Firma zarejestrowana pomyślnie. Email z zaproszeniem został wysłany.'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  } catch (error) {
    console.error('Registration error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    )
  }
})
