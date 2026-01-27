import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')

    if (!stripeKey || !webhookSecret) {
      throw new Error('Stripe is not configured')
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

    // Verify webhook signature (use async version for Deno compatibility)
    const signature = req.headers.get('stripe-signature')
    if (!signature) {
      throw new Error('Missing stripe-signature header')
    }

    const body = await req.text()
    let event: Stripe.Event

    try {
      // IMPORTANT: Use constructEventAsync for Deno/Supabase Edge Functions
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret)
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message)
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 400, headers: corsHeaders }
      )
    }

    console.log('Received Stripe event:', event.type)

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const { company_id, modules: modulesJson, module_code } = session.metadata || {}

        console.log('checkout.session.completed metadata:', session.metadata)
        console.log('Session subscription ID:', session.subscription)

        if (!company_id) {
          console.warn('checkout.session.completed: Missing company_id in metadata')
          break
        }

        // Parse modules from metadata (supports both new array format and legacy single module)
        let modulesToActivate: Array<{ moduleCode: string; quantity: number }> = []

        if (modulesJson) {
          try {
            modulesToActivate = JSON.parse(modulesJson)
            console.log('Parsed modules from metadata:', modulesToActivate)
          } catch (e) {
            console.error('Failed to parse modules JSON:', e)
          }
        } else if (module_code) {
          // Legacy single module format
          modulesToActivate = [{ moduleCode: module_code, quantity: 10 }]
        }

        if (modulesToActivate.length === 0) {
          console.warn('checkout.session.completed: No modules to activate')
          break
        }

        // Get subscription details with expanded product info
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string, {
          expand: ['items.data.price.product']
        })

        console.log(`Subscription has ${subscription.items.data.length} items`)

        // Activate each module
        for (const mod of modulesToActivate) {
          console.log(`Activating module ${mod.moduleCode} for company ${company_id}`)

          // Find the subscription item for this module (by product metadata or by order)
          let subscriptionItem = subscription.items.data.find(item => {
            const product = item.price.product as Stripe.Product
            return product.metadata?.module_code === mod.moduleCode
          })

          // If not found by metadata, try to match by index (same order as in checkout)
          if (!subscriptionItem) {
            const modIndex = modulesToActivate.findIndex(m => m.moduleCode === mod.moduleCode)
            subscriptionItem = subscription.items.data[modIndex]
          }

          if (!subscriptionItem) {
            console.error(`Subscription item not found for module ${mod.moduleCode}`)
            continue
          }

          const quantity = subscriptionItem.quantity || mod.quantity || 10

          // Check if company_module already exists
          const { data: existingModule } = await supabaseAdmin
            .from('company_modules')
            .select('id')
            .eq('company_id', company_id)
            .eq('module_code', mod.moduleCode)
            .single()

          if (existingModule) {
            // Update existing
            const { error: updateError } = await supabaseAdmin
              .from('company_modules')
              .update({
                is_active: true,
                max_users: quantity,
                stripe_subscription_id: subscription.id,
                stripe_subscription_item_id: subscriptionItem.id,
                activated_at: new Date().toISOString()
              })
              .eq('id', existingModule.id)

            if (updateError) {
              console.error(`Error updating company_module for ${mod.moduleCode}:`, updateError)
            } else {
              console.log(`Successfully updated company_module ${existingModule.id} (${mod.moduleCode}) to active`)
            }
          } else {
            // Get module info
            const { data: moduleInfo } = await supabaseAdmin
              .from('modules')
              .select('base_price_per_user')
              .eq('code', mod.moduleCode)
              .single()

            // Create new company_module
            const { data: insertData, error: insertError } = await supabaseAdmin
              .from('company_modules')
              .insert({
                company_id,
                module_code: mod.moduleCode,
                is_active: true,
                max_users: quantity,
                current_users: 0,
                price_per_user: moduleInfo?.base_price_per_user || 79,
                stripe_subscription_id: subscription.id,
                stripe_subscription_item_id: subscriptionItem.id,
                activated_at: new Date().toISOString()
              })
              .select()
              .single()

            if (insertError) {
              console.error(`Error inserting company_module for ${mod.moduleCode}:`, insertError)
            } else {
              console.log(`Successfully created company_module for ${mod.moduleCode}:`, insertData)
            }
          }
        }

        // Update company subscription status
        const { error: companyUpdateError } = await supabaseAdmin
          .from('companies')
          .update({ subscription_status: 'active' })
          .eq('id', company_id)

        if (companyUpdateError) {
          console.error('Error updating company subscription_status:', companyUpdateError)
        } else {
          console.log(`Company ${company_id} subscription_status updated to active`)
        }
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const companyId = subscription.metadata?.company_id
        const modulesJson = subscription.metadata?.modules
        const moduleCode = subscription.metadata?.module_code

        if (!companyId) {
          console.warn('customer.subscription.updated: Missing company_id')
          break
        }

        // Parse modules (supports both array and legacy single module)
        let moduleCodes: string[] = []
        if (modulesJson) {
          try {
            const parsed = JSON.parse(modulesJson) as Array<{ moduleCode: string }>
            moduleCodes = parsed.map(m => m.moduleCode)
          } catch (e) {
            console.error('Failed to parse modules JSON:', e)
          }
        } else if (moduleCode) {
          moduleCodes = [moduleCode]
        }

        // Update each module's status based on subscription items
        for (let i = 0; i < subscription.items.data.length; i++) {
          const item = subscription.items.data[i]
          const modCode = moduleCodes[i] || moduleCode

          if (modCode) {
            await supabaseAdmin
              .from('company_modules')
              .update({
                max_users: item.quantity || 10,
                is_active: subscription.status === 'active'
              })
              .eq('company_id', companyId)
              .eq('module_code', modCode)

            console.log(`Updated module ${modCode}: quantity=${item.quantity}, active=${subscription.status === 'active'}`)
          }
        }

        // Update company subscription status
        const statusMap: Record<string, string> = {
          'active': 'active',
          'past_due': 'past_due',
          'canceled': 'canceled',
          'unpaid': 'suspended'
        }

        await supabaseAdmin
          .from('companies')
          .update({ subscription_status: statusMap[subscription.status] || 'active' })
          .eq('id', companyId)

        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const companyId = subscription.metadata?.company_id
        const modulesJson = subscription.metadata?.modules
        const moduleCode = subscription.metadata?.module_code

        if (!companyId) {
          console.warn('customer.subscription.deleted: Missing company_id')
          break
        }

        // Parse modules (supports both array and legacy single module)
        let moduleCodes: string[] = []
        if (modulesJson) {
          try {
            const parsed = JSON.parse(modulesJson) as Array<{ moduleCode: string }>
            moduleCodes = parsed.map(m => m.moduleCode)
          } catch (e) {
            console.error('Failed to parse modules JSON:', e)
          }
        } else if (moduleCode) {
          moduleCodes = [moduleCode]
        }

        // Deactivate all modules in subscription
        for (const modCode of moduleCodes) {
          await supabaseAdmin
            .from('company_modules')
            .update({
              is_active: false,
              deactivated_at: new Date().toISOString()
            })
            .eq('company_id', companyId)
            .eq('module_code', modCode)

          console.log(`Deactivated module ${modCode} for company ${companyId}`)
        }

        // Check if company has any active modules left
        const { data: activeModules } = await supabaseAdmin
          .from('company_modules')
          .select('id')
          .eq('company_id', companyId)
          .eq('is_active', true)

        if (!activeModules || activeModules.length === 0) {
          await supabaseAdmin
            .from('companies')
            .update({ subscription_status: 'canceled' })
            .eq('id', companyId)

          console.log(`Company ${companyId} has no active modules, status set to canceled`)
        }
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string

        // Find company by customer ID
        const { data: company } = await supabaseAdmin
          .from('companies')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single()

        if (company) {
          // Log payment
          await supabaseAdmin
            .from('payment_history')
            .insert({
              company_id: company.id,
              stripe_invoice_id: invoice.id,
              amount: invoice.amount_paid / 100, // Convert from cents
              currency: invoice.currency.toUpperCase(),
              status: 'paid',
              invoice_number: invoice.number,
              invoice_pdf_url: invoice.invoice_pdf,
              paid_at: new Date().toISOString()
            })

          // Apply scheduled price changes for this company's modules
          // Get all modules with scheduled price changes
          const { data: modulesWithScheduledPrice } = await supabaseAdmin
            .from('company_modules')
            .select('id, next_billing_cycle_price')
            .eq('company_id', company.id)
            .eq('is_active', true)
            .not('next_billing_cycle_price', 'is', null)

          if (modulesWithScheduledPrice && modulesWithScheduledPrice.length > 0) {
            // Apply each scheduled price
            for (const mod of modulesWithScheduledPrice) {
              await supabaseAdmin
                .from('company_modules')
                .update({
                  price_per_user: mod.next_billing_cycle_price,
                  next_billing_cycle_price: null,
                  price_scheduled_at: null
                })
                .eq('id', mod.id)

              console.log(`Applied scheduled price ${mod.next_billing_cycle_price} to company_module ${mod.id}`)
            }
          }
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string

        // Find company by customer ID
        const { data: company } = await supabaseAdmin
          .from('companies')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single()

        if (company) {
          // Update subscription status
          await supabaseAdmin
            .from('companies')
            .update({ subscription_status: 'past_due' })
            .eq('id', company.id)

          // Log failed payment
          await supabaseAdmin
            .from('payment_history')
            .insert({
              company_id: company.id,
              stripe_invoice_id: invoice.id,
              amount: invoice.amount_due / 100,
              currency: invoice.currency.toUpperCase(),
              status: 'failed',
              invoice_number: invoice.number,
              created_at: new Date().toISOString()
            })
        }
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return new Response(
      JSON.stringify({ received: true }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  } catch (error) {
    console.error('Webhook error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    )
  }
})
