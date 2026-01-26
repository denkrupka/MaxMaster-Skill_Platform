import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'

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

    // Verify webhook signature
    const signature = req.headers.get('stripe-signature')
    if (!signature) {
      throw new Error('Missing stripe-signature header')
    }

    const body = await req.text()
    let event: Stripe.Event

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
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
        const { company_id, module_code } = session.metadata || {}

        if (company_id && module_code) {
          console.log(`Activating module ${module_code} for company ${company_id}`)

          // Get subscription details
          const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
          const subscriptionItem = subscription.items.data[0]

          // Check if company_module already exists
          const { data: existingModule } = await supabaseAdmin
            .from('company_modules')
            .select('id')
            .eq('company_id', company_id)
            .eq('module_code', module_code)
            .single()

          if (existingModule) {
            // Update existing
            await supabaseAdmin
              .from('company_modules')
              .update({
                is_active: true,
                max_users: subscriptionItem.quantity || 10,
                stripe_subscription_id: subscription.id,
                stripe_subscription_item_id: subscriptionItem.id,
                activated_at: new Date().toISOString()
              })
              .eq('id', existingModule.id)
          } else {
            // Get module info
            const { data: moduleInfo } = await supabaseAdmin
              .from('modules')
              .select('base_price_per_user')
              .eq('code', module_code)
              .single()

            // Create new company_module
            await supabaseAdmin
              .from('company_modules')
              .insert({
                company_id,
                module_code,
                is_active: true,
                max_users: subscriptionItem.quantity || 10,
                current_users: 0,
                price_per_user: moduleInfo?.base_price_per_user || 79,
                stripe_subscription_id: subscription.id,
                stripe_subscription_item_id: subscriptionItem.id,
                activated_at: new Date().toISOString()
              })
          }

          // Update company subscription status
          await supabaseAdmin
            .from('companies')
            .update({ subscription_status: 'active' })
            .eq('id', company_id)
        }
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const companyId = subscription.metadata?.company_id
        const moduleCode = subscription.metadata?.module_code

        if (companyId && moduleCode) {
          const subscriptionItem = subscription.items.data[0]

          await supabaseAdmin
            .from('company_modules')
            .update({
              max_users: subscriptionItem.quantity || 10,
              is_active: subscription.status === 'active'
            })
            .eq('company_id', companyId)
            .eq('module_code', moduleCode)

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
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const companyId = subscription.metadata?.company_id
        const moduleCode = subscription.metadata?.module_code

        if (companyId && moduleCode) {
          // Deactivate module
          await supabaseAdmin
            .from('company_modules')
            .update({
              is_active: false,
              deactivated_at: new Date().toISOString()
            })
            .eq('company_id', companyId)
            .eq('module_code', moduleCode)

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
          }
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
