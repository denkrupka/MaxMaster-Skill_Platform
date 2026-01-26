import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Stripe Price IDs for each module (configure in Stripe Dashboard)
const MODULE_PRICE_IDS: Record<string, string> = {
  'recruitment': Deno.env.get('STRIPE_PRICE_RECRUITMENT') ?? '',
  'skills': Deno.env.get('STRIPE_PRICE_SKILLS') ?? '',
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
        const { companyId, moduleCode, quantity, successUrl, cancelUrl } = body

        if (!companyId || !moduleCode || !quantity) {
          throw new Error('companyId, moduleCode, and quantity are required')
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

        // Get price ID for module
        const priceId = MODULE_PRICE_IDS[moduleCode]
        if (!priceId) {
          throw new Error(`No Stripe price configured for module: ${moduleCode}`)
        }

        // Create checkout session
        const session = await stripe.checkout.sessions.create({
          customer: customerId,
          mode: 'subscription',
          line_items: [
            {
              price: priceId,
              quantity: quantity,
            },
          ],
          success_url: successUrl,
          cancel_url: cancelUrl,
          subscription_data: {
            metadata: {
              company_id: companyId,
              module_code: moduleCode,
            },
          },
          metadata: {
            company_id: companyId,
            module_code: moduleCode,
          },
          allow_promotion_codes: true,
          billing_address_collection: 'required',
          tax_id_collection: {
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
