import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeKey) {
      throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY in environment.')
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    })

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

    // Verify authorization
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user: requestingUser } } = await supabaseAdmin.auth.getUser(token)

    if (!requestingUser) {
      throw new Error('Invalid token')
    }

    const body = await req.json()
    const { action } = body

    console.log('Stripe action:', action, body)

    switch (action) {
      case 'create-checkout-session': {
        const { companyId, modules, successUrl, cancelUrl } = body
        // Support legacy single module format
        const moduleCode = body.moduleCode
        const quantity = body.quantity

        // Build modules array (support both new array format and legacy single module)
        let modulesToProcess: Array<{ moduleCode: string; quantity: number }> = []

        if (modules && Array.isArray(modules) && modules.length > 0) {
          modulesToProcess = modules
        } else if (moduleCode && quantity) {
          modulesToProcess = [{ moduleCode, quantity }]
        }

        if (!companyId || modulesToProcess.length === 0) {
          throw new Error('companyId and modules (or moduleCode + quantity) are required')
        }

        console.log('Processing modules:', modulesToProcess)

        // Get company details
        const { data: company, error: companyError } = await supabaseAdmin
          .from('companies')
          .select('*')
          .eq('id', companyId)
          .single()

        if (companyError || !company) {
          throw new Error('Company not found')
        }

        // Get all module info from database
        const moduleCodes = modulesToProcess.map(m => m.moduleCode)
        const { data: modulesInfo, error: modulesInfoError } = await supabaseAdmin
          .from('modules')
          .select('code, name_pl, base_price_per_user')
          .in('code', moduleCodes)

        if (modulesInfoError || !modulesInfo || modulesInfo.length === 0) {
          throw new Error(`Modules not found: ${moduleCodes.join(', ')}`)
        }

        // Validate all modules have prices
        for (const mod of modulesInfo) {
          if (!mod.base_price_per_user || mod.base_price_per_user <= 0) {
            throw new Error(`Price not configured for module: ${mod.code}. Superadmin must set base_price_per_user.`)
          }
        }

        // Get or create Stripe customer
        let customerId = company.stripe_customer_id

        if (!customerId) {
          const customer = await stripe.customers.create({
            email: company.email || undefined,
            name: company.name,
            metadata: {
              company_id: companyId,
              tax_id: company.tax_id || ''
            }
          })
          customerId = customer.id

          // Save customer ID to company
          await supabaseAdmin
            .from('companies')
            .update({ stripe_customer_id: customerId })
            .eq('id', companyId)
        }

        // Build line_items for all modules
        const lineItems = modulesToProcess.map(mod => {
          const moduleInfo = modulesInfo.find(m => m.code === mod.moduleCode)!
          const unitAmountInGrosze = Math.round(moduleInfo.base_price_per_user * 100)

          console.log(`Module ${mod.moduleCode}: ${mod.quantity} seats × ${moduleInfo.base_price_per_user} PLN = ${mod.quantity * moduleInfo.base_price_per_user} PLN`)

          return {
            price_data: {
              currency: 'pln',
              product_data: {
                name: `${moduleInfo.name_pl} - subskrypcja`,
                description: `Dostęp do modułu ${moduleInfo.name_pl}`,
                metadata: {
                  module_code: mod.moduleCode,
                },
              },
              unit_amount: unitAmountInGrosze,
              recurring: {
                interval: 'month' as const,
              },
              tax_behavior: 'exclusive' as const,
            },
            quantity: mod.quantity,
          }
        })

        // Store modules info in metadata (JSON stringified for multiple modules)
        const modulesMetadata = JSON.stringify(modulesToProcess)

        // Create checkout session with dynamic pricing from database
        const session = await stripe.checkout.sessions.create({
          customer: customerId,
          mode: 'subscription',
          line_items: lineItems,
          success_url: successUrl,
          cancel_url: cancelUrl,
          subscription_data: {
            metadata: {
              company_id: companyId,
              modules: modulesMetadata, // JSON array of {moduleCode, quantity}
            },
          },
          metadata: {
            company_id: companyId,
            modules: modulesMetadata,
          },
          // Allow updating customer info from checkout form (required for tax_id_collection)
          customer_update: {
            name: 'auto',
            address: 'auto',
          },
          allow_promotion_codes: true,
          billing_address_collection: 'required',
          tax_id_collection: {
            enabled: true,
          },
          // Enable automatic tax calculation (VAT 23% for Poland)
          automatic_tax: {
            enabled: true,
          },
        })

        return new Response(
          JSON.stringify({ sessionId: session.id, url: session.url }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
          }
        )
      }

      case 'create-portal-session': {
        const { customerId, returnUrl } = body

        if (!customerId || !returnUrl) {
          throw new Error('customerId and returnUrl are required')
        }

        const session = await stripe.billingPortal.sessions.create({
          customer: customerId,
          return_url: returnUrl,
        })

        return new Response(
          JSON.stringify({ url: session.url }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
          }
        )
      }

      case 'update-subscription': {
        const { companyId, moduleCode, quantity } = body

        if (!companyId || !moduleCode || !quantity) {
          throw new Error('companyId, moduleCode, and quantity are required')
        }

        // Get company with Stripe customer ID
        const { data: company, error: companyError } = await supabaseAdmin
          .from('companies')
          .select('stripe_customer_id')
          .eq('id', companyId)
          .single()

        if (companyError || !company?.stripe_customer_id) {
          throw new Error('Company has no Stripe subscription')
        }

        // Get company module subscription ID
        const { data: companyModule, error: moduleError } = await supabaseAdmin
          .from('company_modules')
          .select('stripe_subscription_id, stripe_subscription_item_id')
          .eq('company_id', companyId)
          .eq('module_code', moduleCode)
          .single()

        if (moduleError || !companyModule?.stripe_subscription_item_id) {
          throw new Error('Module subscription not found')
        }

        // Update subscription quantity
        await stripe.subscriptionItems.update(
          companyModule.stripe_subscription_item_id,
          { quantity }
        )

        // Update local record
        await supabaseAdmin
          .from('company_modules')
          .update({ max_users: quantity })
          .eq('company_id', companyId)
          .eq('module_code', moduleCode)

        return new Response(
          JSON.stringify({ success: true, quantity }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
          }
        )
      }

      case 'create-prorated-payment': {
        // Create one-time payment checkout for adding seats to existing module
        const { companyId, moduleCode, additionalQuantity, successUrl, cancelUrl } = body

        if (!companyId || !moduleCode || !additionalQuantity) {
          throw new Error('companyId, moduleCode, and additionalQuantity are required')
        }

        // Get company details
        const { data: company, error: companyError } = await supabaseAdmin
          .from('companies')
          .select('*')
          .eq('id', companyId)
          .single()

        if (companyError || !company) {
          throw new Error('Company not found')
        }

        if (!company.stripe_customer_id) {
          throw new Error('Company has no Stripe account')
        }

        // Get module info
        const { data: moduleInfo, error: moduleInfoError } = await supabaseAdmin
          .from('modules')
          .select('code, name_pl, base_price_per_user')
          .eq('code', moduleCode)
          .single()

        if (moduleInfoError || !moduleInfo) {
          throw new Error('Module not found')
        }

        // Get company module to find current subscription
        const { data: companyModule, error: cmError } = await supabaseAdmin
          .from('company_modules')
          .select('stripe_subscription_id, stripe_subscription_item_id, max_users, price_per_user')
          .eq('company_id', companyId)
          .eq('module_code', moduleCode)
          .single()

        if (cmError || !companyModule?.stripe_subscription_id) {
          throw new Error('Active module subscription not found')
        }

        // Get subscription to calculate pro-rata period
        const subscription = await stripe.subscriptions.retrieve(companyModule.stripe_subscription_id)

        // Calculate days remaining in billing period
        const now = Math.floor(Date.now() / 1000)
        const periodEnd = subscription.current_period_end
        const periodStart = subscription.current_period_start
        const totalDays = Math.ceil((periodEnd - periodStart) / 86400)
        const daysRemaining = Math.ceil((periodEnd - now) / 86400)

        // Calculate prorated amount
        const pricePerUser = companyModule.price_per_user || moduleInfo.base_price_per_user
        const proratedAmount = Math.round((pricePerUser * additionalQuantity * daysRemaining / totalDays) * 100) // in grosze

        console.log(`Prorated payment: ${additionalQuantity} users × ${pricePerUser} PLN × ${daysRemaining}/${totalDays} days = ${proratedAmount/100} PLN`)

        // Create one-time payment checkout session
        const session = await stripe.checkout.sessions.create({
          customer: company.stripe_customer_id,
          mode: 'payment',
          line_items: [{
            price_data: {
              currency: 'pln',
              product_data: {
                name: `${moduleInfo.name_pl} - dodatkowe miejsca`,
                description: `Proporcjonalna opłata za ${additionalQuantity} miejsc na ${daysRemaining} dni`,
              },
              unit_amount: proratedAmount,
              tax_behavior: 'exclusive' as const,
            },
            quantity: 1,
          }],
          success_url: successUrl,
          cancel_url: cancelUrl,
          metadata: {
            company_id: companyId,
            module_code: moduleCode,
            additional_quantity: additionalQuantity.toString(),
            action_type: 'add_seats',
            new_total_quantity: (companyModule.max_users + additionalQuantity).toString(),
          },
          automatic_tax: {
            enabled: true,
          },
        })

        return new Response(
          JSON.stringify({ sessionId: session.id, url: session.url }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
          }
        )
      }

      case 'list-invoices': {
        const { customerId } = body

        if (!customerId) {
          throw new Error('customerId is required')
        }

        // Fetch invoices from Stripe
        const invoices = await stripe.invoices.list({
          customer: customerId,
          limit: 100,
        })

        return new Response(
          JSON.stringify({ invoices: invoices.data }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
          }
        )
      }

      case 'schedule-subscription-update': {
        const { companyId, moduleCode, quantity } = body

        if (!companyId || !moduleCode || !quantity) {
          throw new Error('companyId, moduleCode, and quantity are required')
        }

        // Get company module info
        const { data: companyModule, error: moduleError } = await supabaseAdmin
          .from('company_modules')
          .select('stripe_subscription_id, stripe_subscription_item_id, max_users, price_per_user')
          .eq('company_id', companyId)
          .eq('module_code', moduleCode)
          .single()

        if (moduleError || !companyModule) {
          console.error('Module not found:', moduleError)
          throw new Error('Moduł nie został znaleziony')
        }

        if (!companyModule.stripe_subscription_id) {
          throw new Error('Moduł nie ma aktywnej subskrypcji. Najpierw aktywuj moduł.')
        }

        // Get subscription to find billing period end date
        let effectiveDate: Date
        try {
          const subscription = await stripe.subscriptions.retrieve(companyModule.stripe_subscription_id)
          effectiveDate = new Date(subscription.current_period_end * 1000)
        } catch (err) {
          console.error('Failed to get subscription:', err)
          // Fallback to next month if we can't get subscription
          effectiveDate = new Date()
          effectiveDate.setMonth(effectiveDate.getMonth() + 1)
          effectiveDate.setDate(1)
        }

        // Calculate the scheduled price (new total price per month)
        const scheduledTotalPrice = quantity * companyModule.price_per_user

        // Store scheduled change in database
        // We store the new quantity in next_billing_cycle_price as total monthly price
        // and use a custom field for the quantity (we'll use the price calculation)
        const { error: updateError } = await supabaseAdmin
          .from('company_modules')
          .update({
            next_billing_cycle_price: scheduledTotalPrice,
            price_scheduled_at: new Date().toISOString(),
            // Store scheduled quantity in metadata or a JSON field
            // For now, we calculate it back from price when applying
          })
          .eq('company_id', companyId)
          .eq('module_code', moduleCode)

        if (updateError) {
          console.error('Failed to save scheduled change:', updateError)
          throw new Error('Nie udało się zapisać zaplanowanej zmiany')
        }

        // Also update Stripe subscription to increase quantity at next billing
        // This triggers Stripe to charge the new amount from next period
        if (companyModule.stripe_subscription_item_id) {
          try {
            await stripe.subscriptionItems.update(
              companyModule.stripe_subscription_item_id,
              {
                quantity,
                proration_behavior: 'none' // No prorated charge, apply from next period
              }
            )
            console.log(`Updated Stripe subscription item quantity to ${quantity} (no proration)`)
          } catch (stripeErr) {
            console.error('Failed to update Stripe subscription:', stripeErr)
            // Don't throw - the database change was saved
          }
        }

        // Update max_users in database to reflect scheduled change
        await supabaseAdmin
          .from('company_modules')
          .update({ max_users: quantity })
          .eq('company_id', companyId)
          .eq('module_code', moduleCode)

        console.log(`Scheduled subscription update for ${moduleCode}: ${companyModule.max_users} -> ${quantity} users`)

        return new Response(
          JSON.stringify({
            success: true,
            scheduledQuantity: quantity,
            effectiveDate: effectiveDate.toISOString()
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
    console.error('Stripe error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    )
  }
})
