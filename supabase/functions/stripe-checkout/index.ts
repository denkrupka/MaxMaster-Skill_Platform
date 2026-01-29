import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// Use npm: specifier instead of esm.sh to avoid Deno.core.runMicrotasks() error in Edge Runtime
import Stripe from 'npm:stripe@12.18.0'

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
      apiVersion: '2022-11-15',
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
    const { data: userData, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError) {
      console.error('Auth error:', authError.message)
      throw new Error(`Authentication failed: ${authError.message}`)
    }

    if (!userData?.user) {
      throw new Error('Invalid token: user not found')
    }

    const requestingUser = userData.user

    const body = await req.json()
    const { action } = body

    console.log('Stripe action:', action, body)

    switch (action) {
      case 'create-checkout-session': {
        const { companyId, modules, successUrl, cancelUrl, billingInterval = 'month' } = body
        // Support legacy single module format
        const moduleCode = body.moduleCode
        const quantity = body.quantity

        // Validate billing interval
        const interval: 'month' | 'year' = billingInterval === 'year' ? 'year' : 'month'

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

          // Sync existing bonus_balance to Stripe Customer Balance for new customer
          if (company.bonus_balance && company.bonus_balance > 0) {
            try {
              const balanceInGrosze = Math.round(company.bonus_balance * 100) * -1 // Negative = credit
              await stripe.customers.createBalanceTransaction(
                customerId,
                {
                  amount: balanceInGrosze,
                  currency: 'pln',
                  description: `Synchronizacja istniejącego balansu bonusowego - ${company.bonus_balance} PLN`
                }
              )
              console.log(`Synced existing balance ${company.bonus_balance} PLN to Stripe Customer Balance for new customer ${customerId}`)
            } catch (syncError) {
              console.error('Failed to sync existing balance to Stripe:', syncError)
            }
          }
        } else {
          // For existing customer - sync local balance with Stripe if needed
          // This handles case when superadmin added balance but functions weren't deployed
          if (company.bonus_balance && company.bonus_balance > 0) {
            try {
              const stripeCustomer = await stripe.customers.retrieve(customerId) as Stripe.Customer
              // Stripe balance is negative (credit), local is positive
              const stripeBalancePLN = stripeCustomer.balance ? (stripeCustomer.balance / -100) : 0
              const localBalance = company.bonus_balance

              // If local balance is higher than Stripe - add the difference
              if (localBalance > stripeBalancePLN) {
                const differenceToAdd = localBalance - stripeBalancePLN
                const differenceInGrosze = Math.round(differenceToAdd * 100) * -1 // Negative = credit
                await stripe.customers.createBalanceTransaction(
                  customerId,
                  {
                    amount: differenceInGrosze,
                    currency: 'pln',
                    description: `Synchronizacja balansu bonusowego - ${differenceToAdd.toFixed(2)} PLN`
                  }
                )
                console.log(`Synced balance difference ${differenceToAdd} PLN to Stripe Customer Balance for ${customerId} (local: ${localBalance}, stripe was: ${stripeBalancePLN})`)
              }
            } catch (syncError) {
              console.error('Failed to sync balance to Stripe:', syncError)
              // Continue anyway - subscription can still be created
            }
          }
        }

        // Check if this is the company's first subscription (for 7-day trial)
        const { data: existingSubscriptions, error: subsError } = await supabaseAdmin
          .from('company_modules')
          .select('id, stripe_subscription_id')
          .eq('company_id', companyId)
          .not('stripe_subscription_id', 'is', null)
          .eq('is_active', true)

        const isFirstSubscription = !existingSubscriptions || existingSubscriptions.length === 0
        console.log(`Is first subscription: ${isFirstSubscription}`)

        // Calculate discount for yearly billing (20% off)
        const yearlyDiscountPercent = 20

        // Build line_items for all modules
        const lineItems = modulesToProcess.map(mod => {
          const moduleInfo = modulesInfo.find(m => m.code === mod.moduleCode)!
          let pricePerUser = moduleInfo.base_price_per_user

          // For yearly billing: calculate annual price with 20% discount
          if (interval === 'year') {
            // Monthly price × 12 months × (1 - 20% discount) = yearly price per user
            pricePerUser = pricePerUser * 12 * (1 - yearlyDiscountPercent / 100)
          }

          const unitAmountInGrosze = Math.round(pricePerUser * 100)
          const intervalLabel = interval === 'year' ? 'roczna' : 'miesięczna'
          const discountLabel = interval === 'year' ? ' (-20%)' : ''

          console.log(`Module ${mod.moduleCode}: ${mod.quantity} seats × ${pricePerUser.toFixed(2)} PLN (${interval})${discountLabel}`)

          return {
            price_data: {
              currency: 'pln',
              product_data: {
                name: `${moduleInfo.name_pl} - subskrypcja ${intervalLabel}${discountLabel}`,
                description: `Dostęp do modułu ${moduleInfo.name_pl}`,
                metadata: {
                  module_code: mod.moduleCode,
                },
              },
              unit_amount: unitAmountInGrosze,
              recurring: {
                interval: interval,
              },
              tax_behavior: 'exclusive' as const,
            },
            quantity: mod.quantity,
          }
        })

        // Store modules info in metadata (JSON stringified for multiple modules)
        const modulesMetadata = JSON.stringify(modulesToProcess)

        // Build subscription_data with optional trial period
        const subscriptionData: any = {
          metadata: {
            company_id: companyId,
            modules: modulesMetadata, // JSON array of {moduleCode, quantity}
            billing_interval: interval,
          },
        }

        // Add 7-day trial for first subscription
        if (isFirstSubscription) {
          subscriptionData.trial_period_days = 7
          console.log('Adding 7-day trial period for first subscription')
        }

        // Create checkout session with dynamic pricing from database
        const session = await stripe.checkout.sessions.create({
          customer: customerId,
          mode: 'subscription',
          line_items: lineItems,
          success_url: successUrl,
          cancel_url: cancelUrl,
          subscription_data: subscriptionData,
          metadata: {
            company_id: companyId,
            modules: modulesMetadata,
            billing_interval: interval,
            is_trial: isFirstSubscription ? 'true' : 'false',
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
          JSON.stringify({
            sessionId: session.id,
            url: session.url,
            isFirstSubscription,
            hasTrial: isFirstSubscription,
            trialDays: isFirstSubscription ? 7 : 0,
            billingInterval: interval,
          }),
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
        const { companyId, moduleCode, additionalQuantity, successUrl, cancelUrl, useMinPayment } = body

        if (!companyId || !moduleCode || !additionalQuantity) {
          throw new Error('companyId, moduleCode, and additionalQuantity are required')
        }

        // Minimum payment amount in grosze (2 PLN)
        const MIN_PAYMENT_GROSZE = 200

        // Get company details including bonus_balance
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
          .select('stripe_subscription_id, stripe_subscription_item_id, max_users, price_per_user, scheduled_max_users')
          .eq('company_id', companyId)
          .eq('module_code', moduleCode)
          .single()

        if (cmError || !companyModule?.stripe_subscription_id) {
          throw new Error('Active module subscription not found')
        }

        // Get subscription period from Stripe
        const subscription = await stripe.subscriptions.retrieve(companyModule.stripe_subscription_id)
        const periodEnd = new Date(subscription.current_period_end * 1000)
        const periodStart = new Date(subscription.current_period_start * 1000)
        const now = new Date()

        // Calculate days remaining until subscription period end
        const totalDaysInPeriod = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24))
        const daysRemaining = Math.max(1, Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))

        // Use base_price_per_user for consistent calculation with frontend
        const pricePerUser = moduleInfo.base_price_per_user
        const proratedAmount = Math.round((pricePerUser * additionalQuantity * daysRemaining / totalDaysInPeriod) * 100) // in grosze

        // Handle minimum payment: if amount is below 2 PLN and useMinPayment is true, charge 2 PLN
        let chargeAmount = proratedAmount
        let bonusAmount = 0
        if (useMinPayment && proratedAmount < MIN_PAYMENT_GROSZE) {
          chargeAmount = MIN_PAYMENT_GROSZE
          bonusAmount = MIN_PAYMENT_GROSZE - proratedAmount // Difference goes to bonus balance
        }

        // Convert to PLN for balance calculations
        const chargeAmountPLN = chargeAmount / 100
        const currentBalance = company.bonus_balance || 0

        // Check if balance can cover the payment (fully or partially)
        const balanceToUse = Math.min(currentBalance, chargeAmountPLN)
        const remainingToCharge = chargeAmountPLN - balanceToUse
        const remainingToChargeGrosze = Math.round(remainingToCharge * 100)

        console.log(`Prorated payment: ${chargeAmountPLN} PLN total, balance: ${currentBalance} PLN, using: ${balanceToUse} PLN, remaining: ${remainingToCharge} PLN`)

        // If balance covers the entire payment - no Stripe checkout needed
        if (remainingToChargeGrosze <= 0) {
          // Deduct from balance
          const newBalance = currentBalance - chargeAmountPLN
          console.log(`Deducting ${chargeAmountPLN} PLN from balance. Current: ${currentBalance}, New: ${newBalance}`)

          const { error: balanceError } = await supabaseAdmin
            .from('companies')
            .update({ bonus_balance: newBalance })
            .eq('id', companyId)

          if (balanceError) {
            console.error('Failed to update balance:', balanceError)
            throw new Error('Nie udało się zaktualizować balansu')
          }

          console.log('Balance updated successfully')

          // Log balance usage
          const { error: txError } = await supabaseAdmin
            .from('bonus_transactions')
            .insert({
              company_id: companyId,
              amount: chargeAmountPLN,
              type: 'debit',
              description: `Opłata za ${additionalQuantity} dodatkowych miejsc w module ${moduleCode}`
            })

          if (txError) {
            console.error('Failed to log transaction:', txError)
          }

          // Update subscription quantity in Stripe (same logic as schedule-subscription-update)
          if (companyModule.stripe_subscription_item_id && companyModule.stripe_subscription_id) {
            try {
              // If there's a scheduled quantity (from "purchase next period"), Stripe already has
              // that higher quantity. We need to add to the scheduled quantity, not just max_users.
              const baseQuantity = companyModule.scheduled_max_users && companyModule.scheduled_max_users > companyModule.max_users
                ? companyModule.scheduled_max_users
                : companyModule.max_users
              const newQuantity = baseQuantity + additionalQuantity
              console.log(`Updating Stripe subscription for "buy now": base=${baseQuantity} (max_users=${companyModule.max_users}, scheduled=${companyModule.scheduled_max_users}) + ${additionalQuantity} = ${newQuantity} users`)

              // Get current subscription to check price
              const currentSubscription = await stripe.subscriptions.retrieve(companyModule.stripe_subscription_id)
              const subscriptionItem = currentSubscription.items.data.find(
                (item: any) => item.id === companyModule.stripe_subscription_item_id
              )

              if (subscriptionItem) {
                const currentUnitAmount = subscriptionItem.price?.unit_amount || 0
                const expectedUnitAmount = Math.round(moduleInfo.base_price_per_user * 100)

                // Get the existing interval from the subscription item to avoid interval mismatch
                const existingInterval = subscriptionItem.price?.recurring?.interval || 'month'
                const existingIntervalCount = subscriptionItem.price?.recurring?.interval_count || 1

                if (currentUnitAmount !== expectedUnitAmount) {
                  // Price changed - create new price and update
                  console.log(`Price mismatch: Stripe has ${currentUnitAmount/100} PLN, expected ${expectedUnitAmount/100} PLN - creating new price`)

                  const productId = subscriptionItem.price.product as string
                  let activeProductId = productId

                  // Check if product is active
                  try {
                    const product = await stripe.products.retrieve(productId)
                    if (!product.active) {
                      await stripe.products.update(productId, { active: true })
                      console.log(`Reactivated product ${productId}`)
                    }
                  } catch (productErr) {
                    console.log('Creating new product for subscription...')
                    const newProduct = await stripe.products.create({
                      name: `${moduleInfo.name_pl} - Subscription`,
                      metadata: { module_code: moduleCode, company_id: companyId }
                    })
                    activeProductId = newProduct.id
                  }

                  // Create new price - use existing interval to avoid mismatch
                  const newPrice = await stripe.prices.create({
                    currency: 'pln',
                    unit_amount: expectedUnitAmount,
                    recurring: { interval: existingInterval, interval_count: existingIntervalCount },
                    product: activeProductId,
                    tax_behavior: 'exclusive',
                  })

                  // Update subscription item with new price and quantity
                  await stripe.subscriptionItems.update(
                    companyModule.stripe_subscription_item_id,
                    {
                      price: newPrice.id,
                      quantity: newQuantity,
                      proration_behavior: 'none'
                    }
                  )
                  console.log(`Updated Stripe subscription to new price and ${newQuantity} users`)
                } else {
                  // Price is same, just update quantity
                  await stripe.subscriptionItems.update(
                    companyModule.stripe_subscription_item_id,
                    {
                      quantity: newQuantity,
                      proration_behavior: 'none'
                    }
                  )
                  console.log(`Updated Stripe subscription to ${newQuantity} users`)
                }

                // Update Stripe metadata: if there's a scheduled quantity, update it to include the new seats.
                // If no scheduled quantity, clear it so webhook can update max_users normally.
                if (companyModule.scheduled_max_users && companyModule.scheduled_max_users > companyModule.max_users) {
                  const newScheduled = companyModule.scheduled_max_users + additionalQuantity
                  await stripe.subscriptions.update(companyModule.stripe_subscription_id, {
                    metadata: {
                      ...currentSubscription.metadata,
                      scheduled_max_users: newScheduled.toString(),
                    }
                  })
                  console.log(`Updated scheduled_max_users metadata to ${newScheduled}`)
                } else {
                  await stripe.subscriptions.update(companyModule.stripe_subscription_id, {
                    metadata: {
                      ...currentSubscription.metadata,
                      scheduled_max_users: '',
                      scheduled_at: ''
                    }
                  })
                  console.log('Cleared scheduled_max_users metadata from Stripe subscription')
                }
              } else {
                console.error('Could not find subscription item in Stripe subscription')
              }
            } catch (stripeErr: any) {
              if (stripeErr.message?.includes('Deno.core.runMicrotasks')) {
                console.warn('Deno.core.runMicrotasks warning - operation may have succeeded')
              } else {
                console.error('Failed to update Stripe subscription:', stripeErr?.message || stripeErr)
              }
            }
          } else {
            console.warn('Missing stripe_subscription_item_id or stripe_subscription_id - skipping Stripe update')
          }

          // Update local record - also update scheduled_max_users if it exists
          const newMaxUsers = companyModule.max_users + additionalQuantity
          const updateData: { max_users: number; scheduled_max_users?: number } = { max_users: newMaxUsers }

          // If there's a scheduled quantity, also add the new users to it
          if (companyModule.scheduled_max_users && companyModule.scheduled_max_users > 0) {
            updateData.scheduled_max_users = companyModule.scheduled_max_users + additionalQuantity
            console.log(`Also updating scheduled_max_users from ${companyModule.scheduled_max_users} to ${updateData.scheduled_max_users}`)
          }

          await supabaseAdmin
            .from('company_modules')
            .update(updateData)
            .eq('company_id', companyId)
            .eq('module_code', moduleCode)

          // Add any bonus amount to balance
          if (bonusAmount > 0) {
            const bonusAmountPLN = bonusAmount / 100
            await supabaseAdmin
              .from('companies')
              .update({ bonus_balance: newBalance + bonusAmountPLN })
              .eq('id', companyId)
          }

          // Log in payment_history
          await supabaseAdmin
            .from('payment_history')
            .insert({
              company_id: companyId,
              amount: chargeAmountPLN,
              currency: 'PLN',
              status: 'paid',
              description: `Opłata z balansu: ${additionalQuantity} miejsc w module ${moduleCode}`,
              paid_at: new Date().toISOString(),
              payment_method: 'bonus',
              payment_type: 'seats_purchase',
              comment: `+${additionalQuantity} miejsc w module ${moduleInfo.name_pl || moduleCode}`
            })

          console.log(`Payment covered entirely from balance. New balance: ${newBalance} PLN`)

          return new Response(
            JSON.stringify({
              paidFromBalance: true,
              amountUsed: chargeAmountPLN,
              newBalance: bonusAmount > 0 ? newBalance + bonusAmount/100 : newBalance
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200
            }
          )
        }

        // Need Stripe checkout - balance will be deducted ONLY AFTER successful payment in webhook
        // This prevents balance loss if user cancels or payment fails

        // Format dates for description
        const formatDate = (d: Date) => d.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' })

        // Build description
        let description = `Proporcjonalna opłata za ${additionalQuantity} miejsc (${daysRemaining}/${totalDaysInPeriod} dni do ${formatDate(periodEnd)})`
        if (balanceToUse > 0) {
          description += ` - ${balanceToUse.toFixed(2)} PLN zostanie potrącone z balansu`
        }
        if (bonusAmount > 0) {
          description += ` + ${(bonusAmount/100).toFixed(2)} PLN bonus`
        }

        console.log(`Creating checkout for ${remainingToCharge} PLN. Balance to deduct after success: ${balanceToUse} PLN`)

        // Create one-time payment checkout session for remaining amount
        // Balance deduction happens in webhook AFTER successful payment
        const session = await stripe.checkout.sessions.create({
          customer: company.stripe_customer_id,
          mode: 'payment',
          line_items: [{
            price_data: {
              currency: 'pln',
              product_data: {
                name: `${moduleInfo.name_pl} - dodatkowe miejsca`,
                description,
              },
              unit_amount: remainingToChargeGrosze,
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
            new_total_quantity: ((companyModule.scheduled_max_users && companyModule.scheduled_max_users > companyModule.max_users ? companyModule.scheduled_max_users : companyModule.max_users) + additionalQuantity).toString(),
            bonus_amount_grosze: bonusAmount.toString(),
            balance_to_deduct: balanceToUse.toString(), // Deduct this AFTER successful payment
          },
          automatic_tax: {
            enabled: true,
          },
        })

        return new Response(
          JSON.stringify({
            sessionId: session.id,
            url: session.url,
            balanceToDeduct: balanceToUse,
            amountToCharge: remainingToCharge
          }),
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

        // Get module info for base price (in case admin changed it)
        const { data: moduleInfo, error: moduleInfoError } = await supabaseAdmin
          .from('modules')
          .select('name_pl, base_price_per_user')
          .eq('code', moduleCode)
          .single()

        if (moduleInfoError || !moduleInfo) {
          throw new Error('Moduł nie istnieje')
        }

        // Always use base price from superadmin settings for consistency
        const pricePerUser = moduleInfo.base_price_per_user
        const unitAmountGrosze = Math.round(pricePerUser * 100)

        // Get subscription to find billing period end date
        let effectiveDate: Date
        let subscription: any
        try {
          subscription = await stripe.subscriptions.retrieve(companyModule.stripe_subscription_id)
          effectiveDate = new Date(subscription.current_period_end * 1000)
        } catch (err) {
          console.error('Failed to get subscription:', err)
          throw new Error('Nie udało się pobrać danych subskrypcji z Stripe')
        }

        // Calculate the scheduled price (new total price per month)
        const scheduledTotalPrice = quantity * pricePerUser

        // Store scheduled change in database
        // Store scheduled_max_users for UI display and next_billing_cycle_price for price tracking
        const { error: updateError } = await supabaseAdmin
          .from('company_modules')
          .update({
            next_billing_cycle_price: scheduledTotalPrice,
            price_scheduled_at: new Date().toISOString(),
            scheduled_max_users: quantity,
            scheduled_change_at: new Date().toISOString()
          })
          .eq('company_id', companyId)
          .eq('module_code', moduleCode)

        if (updateError) {
          console.error('Failed to save scheduled change:', updateError)
          throw new Error('Nie udało się zapisać zaplanowanej zmiany')
        }

        // Update Stripe subscription with metadata about scheduled change
        // The actual quantity change will apply when customer.subscription.updated fires
        if (companyModule.stripe_subscription_item_id) {
          try {
            // Update subscription metadata to store scheduled quantity
            await stripe.subscriptions.update(companyModule.stripe_subscription_id, {
              metadata: {
                ...subscription.metadata,
                scheduled_max_users: quantity.toString(),
                scheduled_at: new Date().toISOString()
              }
            })

            // Check if Stripe price needs to be updated
            // Get current subscription item to compare price
            const subscriptionItem = subscription.items.data.find(
              (item: any) => item.id === companyModule.stripe_subscription_item_id
            )
            const currentUnitAmount = subscriptionItem?.price?.unit_amount || 0

            // Get the existing interval from the subscription item to avoid interval mismatch
            const existingInterval = subscriptionItem.price?.recurring?.interval || 'month'
            const existingIntervalCount = subscriptionItem.price?.recurring?.interval_count || 1

            if (currentUnitAmount !== unitAmountGrosze) {
              // Price has changed - create a new price and update subscription item
              console.log(`Price changed from ${currentUnitAmount/100} PLN to ${unitAmountGrosze/100} PLN - updating Stripe price`)

              const productId = subscriptionItem.price.product as string

              // Check if the product is active
              let activeProductId = productId
              try {
                const product = await stripe.products.retrieve(productId)
                if (!product.active) {
                  console.log(`Product ${productId} is inactive, reactivating...`)
                  // Reactivate the product
                  await stripe.products.update(productId, { active: true })
                  console.log(`Product ${productId} reactivated successfully`)
                }
              } catch (productErr: any) {
                console.error('Failed to check/reactivate product:', productErr)
                // If we can't reactivate, create a new product
                console.log('Creating new product for subscription...')
                const newProduct = await stripe.products.create({
                  name: `${moduleInfo.name_pl} - Subscription`,
                  metadata: {
                    module_code: moduleCode,
                    company_id: companyId
                  }
                })
                activeProductId = newProduct.id
                console.log(`Created new product: ${activeProductId}`)
              }

              // Create new price with updated amount - use existing interval to avoid mismatch
              const newPrice = await stripe.prices.create({
                currency: 'pln',
                unit_amount: unitAmountGrosze,
                recurring: { interval: existingInterval, interval_count: existingIntervalCount },
                product: activeProductId,
                tax_behavior: 'exclusive',
              })

              // Update subscription item with new price and quantity
              await stripe.subscriptionItems.update(
                companyModule.stripe_subscription_item_id,
                {
                  price: newPrice.id,
                  quantity,
                  proration_behavior: 'none' // No prorated charge, apply from next period
                }
              )
              console.log(`Updated Stripe subscription to new price (${unitAmountGrosze/100} PLN) and ${quantity} users`)
            } else {
              // Price is the same, just update quantity
              await stripe.subscriptionItems.update(
                companyModule.stripe_subscription_item_id,
                {
                  quantity,
                  proration_behavior: 'none' // No prorated charge, apply from next period
                }
              )
              console.log(`Scheduled Stripe subscription update to ${quantity} users (effective from ${effectiveDate.toISOString()})`)
            }
          } catch (stripeErr: any) {
            // Handle specific Stripe errors
            if (stripeErr.message?.includes('Deno.core.runMicrotasks')) {
              // This is a known Stripe SDK issue in Deno - operation may still succeed
              console.warn('Deno.core.runMicrotasks warning - checking if operation succeeded...')
              // Don't throw - the update might have worked
            } else if (stripeErr.code === 'resource_missing') {
              console.error('Stripe resource not found:', stripeErr.message)
              throw new Error('Subskrypcja nie została znaleziona w Stripe')
            } else if (stripeErr.raw?.message?.includes('inactive')) {
              console.error('Product inactive error:', stripeErr)
              throw new Error('Produkt w Stripe jest nieaktywny. Skontaktuj się z administratorem.')
            } else {
              console.error('Failed to update Stripe subscription:', stripeErr)
              throw new Error('Nie udało się zaplanować zmiany w Stripe: ' + (stripeErr.message || 'Unknown error'))
            }
          }
        }

        // DON'T update max_users immediately - it will be updated when payment succeeds
        // Just log the scheduled change
        console.log(`Scheduled subscription update for ${moduleCode}: ${companyModule.max_users} -> ${quantity} users at ${pricePerUser} PLN/user (effective: ${effectiveDate.toISOString()})`)

        return new Response(
          JSON.stringify({
            success: true,
            scheduledQuantity: quantity,
            pricePerUser: pricePerUser,
            effectiveDate: effectiveDate.toISOString()
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
          }
        )
      }

      case 'create-topup-session': {
        // Create one-time payment for balance top-up
        const { companyId, packageIndex, amount, points, successUrl, cancelUrl } = body

        if (!companyId || amount === undefined || points === undefined) {
          throw new Error('companyId, amount, and points are required')
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

        // Amount in grosze (1 PLN = 100 groszy)
        const amountInGrosze = Math.round(amount * 100)

        // Create checkout session for one-time payment
        const session = await stripe.checkout.sessions.create({
          customer: customerId,
          mode: 'payment',
          line_items: [{
            price_data: {
              currency: 'pln',
              product_data: {
                name: `Doładowanie balansu - ${points} PLN`,
                description: `Pakiet doładowania konta bonusowego`,
              },
              unit_amount: amountInGrosze,
              tax_behavior: 'exclusive' as const,
            },
            quantity: 1,
          }],
          success_url: successUrl,
          cancel_url: cancelUrl,
          metadata: {
            company_id: companyId,
            action_type: 'balance_topup',
            topup_amount: points.toString(), // Amount to add to bonus balance
            package_index: packageIndex?.toString() || '0',
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

      case 'add-stripe-balance': {
        // Add balance to Stripe Customer Balance (for admin bonus or top-up)
        const { companyId, amount, description } = body

        if (!companyId || amount === undefined) {
          throw new Error('companyId and amount are required')
        }

        // Get company with Stripe customer ID
        const { data: company, error: companyError } = await supabaseAdmin
          .from('companies')
          .select('stripe_customer_id, name, email, tax_id')
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

        // Convert amount to grosze (negative = credit to customer)
        // Stripe Customer Balance: negative amount = credit (money owed TO customer)
        const amountInGrosze = Math.round(amount * 100) * -1

        // Create balance transaction in Stripe
        const balanceTransaction = await stripe.customers.createBalanceTransaction(
          customerId,
          {
            amount: amountInGrosze,
            currency: 'pln',
            description: description || `Bonus balance: ${amount} PLN`
          }
        )

        console.log(`Added ${amount} PLN to Stripe Customer Balance for ${customerId} (transaction: ${balanceTransaction.id})`)

        // Record in payment_history for unified view (using service role - bypasses RLS)
        const isCredit = amount > 0
        const { error: paymentHistoryError } = await supabaseAdmin
          .from('payment_history')
          .insert({
            company_id: companyId,
            amount: Math.abs(amount),
            currency: 'PLN',
            status: 'paid',
            description: description || (isCredit ? 'Doładowanie balansu' : 'Pobranie z balansu'),
            payment_method: 'portal',
            payment_type: isCredit ? 'bonus_credit' : 'bonus_debit',
            comment: description || null,
            paid_at: new Date().toISOString()
          })

        if (paymentHistoryError) {
          console.error('Failed to log payment history:', paymentHistoryError)
        } else {
          console.log(`Recorded bonus in payment_history for company ${companyId}`)
        }

        return new Response(
          JSON.stringify({
            success: true,
            transactionId: balanceTransaction.id,
            newBalance: balanceTransaction.ending_balance / -100 // Convert back to positive PLN
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
          }
        )
      }

      case 'get-stripe-balance': {
        // Get current Stripe Customer Balance
        const { companyId } = body

        if (!companyId) {
          throw new Error('companyId is required')
        }

        const { data: company, error: companyError } = await supabaseAdmin
          .from('companies')
          .select('stripe_customer_id')
          .eq('id', companyId)
          .single()

        if (companyError || !company?.stripe_customer_id) {
          return new Response(
            JSON.stringify({ balance: 0 }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200
            }
          )
        }

        // Get customer from Stripe
        const customer = await stripe.customers.retrieve(company.stripe_customer_id) as Stripe.Customer

        // Balance is negative in Stripe (credit = money owed to customer)
        const balance = customer.balance ? (customer.balance / -100) : 0

        return new Response(
          JSON.stringify({ balance }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
          }
        )
      }

      case 'sync-subscription-periods': {
        // Sync subscription period data from Stripe for all company modules
        const { companyId } = body

        if (!companyId) {
          throw new Error('companyId is required')
        }

        // Get all company modules with stripe subscriptions
        const { data: companyModules, error: cmError } = await supabaseAdmin
          .from('company_modules')
          .select('id, module_code, stripe_subscription_id')
          .eq('company_id', companyId)
          .not('stripe_subscription_id', 'is', null)

        if (cmError) {
          throw new Error('Failed to get company modules')
        }

        const results = []
        for (const cm of companyModules || []) {
          if (!cm.stripe_subscription_id) continue

          try {
            const subscription = await stripe.subscriptions.retrieve(cm.stripe_subscription_id)
            const periodStart = new Date(subscription.current_period_start * 1000)
            const periodEnd = new Date(subscription.current_period_end * 1000)

            await supabaseAdmin
              .from('company_modules')
              .update({
                subscription_period_start: periodStart.toISOString(),
                subscription_period_end: periodEnd.toISOString()
              })
              .eq('id', cm.id)

            results.push({
              module_code: cm.module_code,
              period_start: periodStart.toISOString(),
              period_end: periodEnd.toISOString(),
              status: 'synced'
            })
            console.log(`Synced period for ${cm.module_code}: ${periodStart.toISOString()} - ${periodEnd.toISOString()}`)
          } catch (err) {
            console.error(`Failed to sync period for ${cm.module_code}:`, err)
            results.push({
              module_code: cm.module_code,
              status: 'error',
              error: err instanceof Error ? err.message : 'Unknown error'
            })
          }
        }

        return new Response(
          JSON.stringify({ success: true, results }),
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
