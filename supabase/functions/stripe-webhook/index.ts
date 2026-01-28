import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// Use npm: specifier instead of esm.sh to avoid Deno.core.runMicrotasks() error in Edge Runtime
import Stripe from 'npm:stripe@12.18.0'

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
        const { company_id, modules: modulesJson, module_code, action_type, new_total_quantity, additional_quantity } = session.metadata || {}

        console.log('checkout.session.completed metadata:', session.metadata)
        console.log('Session mode:', session.mode)
        console.log('Session subscription ID:', session.subscription)

        if (!company_id) {
          console.warn('checkout.session.completed: Missing company_id in metadata')
          break
        }

        // Handle balance top-up payment
        if (session.mode === 'payment' && action_type === 'balance_topup') {
          const topupAmount = parseFloat(session.metadata?.topup_amount || '0')

          if (topupAmount > 0) {
            // Get current balance and stripe_customer_id
            const { data: company } = await supabaseAdmin
              .from('companies')
              .select('bonus_balance, stripe_customer_id')
              .eq('id', company_id)
              .single()

            const currentBalance = company?.bonus_balance || 0
            const newBalance = currentBalance + topupAmount

            // Update company bonus balance in database
            const { error: balanceError } = await supabaseAdmin
              .from('companies')
              .update({ bonus_balance: newBalance })
              .eq('id', company_id)

            if (balanceError) {
              console.error('Failed to update bonus balance:', balanceError)
            } else {
              console.log(`Added ${topupAmount} PLN to company ${company_id} bonus balance (new total: ${newBalance} PLN)`)
            }

            // Also add to Stripe Customer Balance for automatic deduction on future payments
            if (company?.stripe_customer_id) {
              try {
                // Stripe Customer Balance: negative amount = credit (money owed TO customer)
                const amountInGrosze = Math.round(topupAmount * 100) * -1
                await stripe.customers.createBalanceTransaction(
                  company.stripe_customer_id,
                  {
                    amount: amountInGrosze,
                    currency: 'pln',
                    description: `Doładowanie balansu - ${topupAmount} PLN`
                  }
                )
                console.log(`Added ${topupAmount} PLN to Stripe Customer Balance for ${company.stripe_customer_id}`)
              } catch (stripeBalanceError) {
                console.error('Failed to add to Stripe Customer Balance:', stripeBalanceError)
                // Don't fail the whole operation - local balance is updated
              }
            }

            // Log to bonus_transactions
            await supabaseAdmin
              .from('bonus_transactions')
              .insert({
                company_id,
                amount: topupAmount,
                type: 'credit',
                description: `Doładowanie balansu - ${topupAmount} PLN`
              })

            // Log payment in payment_history
            const { error: historyError } = await supabaseAdmin
              .from('payment_history')
              .insert({
                company_id,
                amount: session.amount_total ? session.amount_total / 100 : 0,
                currency: session.currency?.toUpperCase() || 'PLN',
                status: 'paid',
                description: `Doładowanie balansu bonusowego - ${topupAmount} PLN`,
                stripe_invoice_id: session.invoice as string || null,
                paid_at: new Date().toISOString(),
                payment_method: 'stripe',
                payment_type: 'balance_topup',
                comment: `Doładowanie +${topupAmount} PLN`
              })

            if (historyError) {
              console.error('Failed to log payment history:', historyError)
            }
          }
          break
        }

        // Handle one-time payment for adding seats to existing subscription
        if (session.mode === 'payment' && action_type === 'add_seats' && session.metadata?.module_code) {
          const moduleCodeToUpdate = session.metadata.module_code
          const newQuantity = parseInt(new_total_quantity || '0', 10)
          const bonusAmountGrosze = parseInt(session.metadata?.bonus_amount_grosze || '0', 10)
          const balanceToDeduct = parseFloat(session.metadata?.balance_to_deduct || '0')

          console.log(`Processing add_seats payment: ${moduleCodeToUpdate}, new quantity: ${newQuantity}, bonus: ${bonusAmountGrosze} grosze, balance to deduct: ${balanceToDeduct} PLN`)

          if (newQuantity > 0) {
            // Get company module with subscription info
            const { data: companyModule, error: cmError } = await supabaseAdmin
              .from('company_modules')
              .select('stripe_subscription_id, stripe_subscription_item_id, max_users, scheduled_max_users')
              .eq('company_id', company_id)
              .eq('module_code', moduleCodeToUpdate)
              .single()

            if (cmError || !companyModule) {
              console.error('Company module not found:', cmError)
              break
            }

            // Calculate how many users were added
            const addedUsers = newQuantity - companyModule.max_users

            // Update subscription quantity in Stripe (with proration_behavior: 'none' since prorated payment was already charged)
            if (companyModule.stripe_subscription_item_id) {
              try {
                await stripe.subscriptionItems.update(
                  companyModule.stripe_subscription_item_id,
                  {
                    quantity: newQuantity,
                    proration_behavior: 'none'
                  }
                )
                console.log(`Updated Stripe subscription item to ${newQuantity} users`)
              } catch (stripeErr) {
                console.error('Failed to update Stripe subscription:', stripeErr)
              }
            }

            // Update local record - also update scheduled_max_users if it exists
            const updateData: { max_users: number; scheduled_max_users?: number } = { max_users: newQuantity }

            // If there's a scheduled quantity, also add the new users to it
            if (companyModule.scheduled_max_users && companyModule.scheduled_max_users > 0 && addedUsers > 0) {
              updateData.scheduled_max_users = companyModule.scheduled_max_users + addedUsers
              console.log(`Also updating scheduled_max_users from ${companyModule.scheduled_max_users} to ${updateData.scheduled_max_users}`)
            }

            const { error: updateError } = await supabaseAdmin
              .from('company_modules')
              .update(updateData)
              .eq('company_id', company_id)
              .eq('module_code', moduleCodeToUpdate)

            if (updateError) {
              console.error('Failed to update company_modules:', updateError)
            } else {
              console.log(`Updated company_modules max_users to ${newQuantity}`)
            }

            // Get company balance for deduction and bonus
            const { data: company } = await supabaseAdmin
              .from('companies')
              .select('bonus_balance, stripe_customer_id')
              .eq('id', company_id)
              .single()

            let currentBalance = company?.bonus_balance || 0

            // Deduct balance that was reserved during checkout (AFTER successful payment)
            if (balanceToDeduct > 0) {
              const newBalance = Math.max(0, currentBalance - balanceToDeduct)

              await supabaseAdmin
                .from('companies')
                .update({ bonus_balance: newBalance })
                .eq('id', company_id)

              // Log balance deduction
              await supabaseAdmin
                .from('bonus_transactions')
                .insert({
                  company_id,
                  amount: balanceToDeduct,
                  type: 'debit',
                  description: `Opłata za ${additional_quantity} miejsc w module ${moduleCodeToUpdate} (część z balansu)`
                })

              console.log(`Deducted ${balanceToDeduct} PLN from balance (was: ${currentBalance}, now: ${newBalance})`)
              currentBalance = newBalance
            }

            // Add bonus amount to company balance if applicable
            if (bonusAmountGrosze > 0) {
              const bonusAmount = bonusAmountGrosze / 100 // Convert to PLN
              const newBalance = currentBalance + bonusAmount

              const { error: bonusError } = await supabaseAdmin
                .from('companies')
                .update({ bonus_balance: newBalance })
                .eq('id', company_id)

              if (bonusError) {
                console.error('Failed to update bonus balance:', bonusError)
              } else {
                console.log(`Added ${bonusAmount} PLN to company bonus balance (new total: ${newBalance} PLN)`)
              }

              // Also add to Stripe Customer Balance for future subscription payments
              if (company?.stripe_customer_id) {
                try {
                  const amountInGrosze = bonusAmountGrosze * -1 // Negative = credit
                  await stripe.customers.createBalanceTransaction(
                    company.stripe_customer_id,
                    {
                      amount: amountInGrosze,
                      currency: 'pln',
                      description: `Bonus za minimalną płatność - ${bonusAmount} PLN`
                    }
                  )
                  console.log(`Added ${bonusAmount} PLN to Stripe Customer Balance for ${company.stripe_customer_id}`)
                } catch (stripeBalanceError) {
                  console.error('Failed to add to Stripe Customer Balance:', stripeBalanceError)
                }
              }
            }

            // Calculate total paid (card + balance)
            const cardAmount = session.amount_total ? session.amount_total / 100 : 0
            const totalPaid = cardAmount + balanceToDeduct

            // Log payment in payment_history
            let paymentDescription = `Dokupienie ${additional_quantity} miejsc w module ${moduleCodeToUpdate}`
            if (balanceToDeduct > 0) {
              paymentDescription += ` (${balanceToDeduct.toFixed(2)} PLN z balansu + ${cardAmount.toFixed(2)} PLN kartą)`
            }

            // Determine payment method: stripe, bonus, or mixed
            let paymentMethod = 'stripe'
            if (balanceToDeduct > 0 && cardAmount > 0) {
              paymentMethod = 'mixed'
            } else if (balanceToDeduct > 0 && cardAmount === 0) {
              paymentMethod = 'bonus'
            }

            // Build comment with module name
            const moduleLabels: Record<string, string> = {
              'recruitment': 'Rekrutacja',
              'skills': 'Umiejętności'
            }
            const moduleName = moduleLabels[moduleCodeToUpdate] || moduleCodeToUpdate
            const seatsComment = `+${additional_quantity} miejsc w module ${moduleName}`

            const { error: historyError } = await supabaseAdmin
              .from('payment_history')
              .insert({
                company_id,
                amount: totalPaid,
                currency: session.currency?.toUpperCase() || 'PLN',
                status: 'paid',
                description: paymentDescription,
                stripe_invoice_id: session.invoice as string || null,
                paid_at: new Date().toISOString(),
                payment_method: paymentMethod,
                payment_type: 'seats_purchase',
                comment: seatsComment
              })

            if (historyError) {
              console.error('Failed to log payment history:', historyError)
            }
          }
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
            // Update existing - clear all scheduled data from previous subscription
            const { error: updateError } = await supabaseAdmin
              .from('company_modules')
              .update({
                is_active: true,
                max_users: quantity,
                stripe_subscription_id: subscription.id,
                stripe_subscription_item_id: subscriptionItem.id,
                activated_at: new Date().toISOString(),
                subscription_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
                subscription_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
                // Clear scheduled data from previous subscription so new subscription starts fresh
                scheduled_max_users: null,
                scheduled_change_at: null,
                next_billing_cycle_price: null,
                price_scheduled_at: null,
                deactivated_at: null
              })
              .eq('id', existingModule.id)

            if (updateError) {
              console.error(`Error updating company_module for ${mod.moduleCode}:`, updateError)
            } else {
              console.log(`Successfully reactivated company_module ${existingModule.id} (${mod.moduleCode}), cleared previous scheduled data`)
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
                activated_at: new Date().toISOString(),
                subscription_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
                subscription_period_end: new Date(subscription.current_period_end * 1000).toISOString()
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

        // Determine subscription status based on subscription state
        let subscriptionStatus = 'active'
        if (subscription.status === 'trialing') {
          subscriptionStatus = 'trialing'
          console.log(`Subscription is in trial period until ${new Date(subscription.trial_end! * 1000).toISOString()}`)
        }

        // Update company subscription status
        const { error: companyUpdateError } = await supabaseAdmin
          .from('companies')
          .update({ subscription_status: subscriptionStatus })
          .eq('id', company_id)

        if (companyUpdateError) {
          console.error('Error updating company subscription_status:', companyUpdateError)
        } else {
          console.log(`Company ${company_id} subscription_status updated to ${subscriptionStatus}`)
        }
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const companyId = subscription.metadata?.company_id
        const modulesJson = subscription.metadata?.modules
        const moduleCode = subscription.metadata?.module_code
        const scheduledMaxUsers = subscription.metadata?.scheduled_max_users

        if (!companyId) {
          console.warn('customer.subscription.updated: Missing company_id')
          break
        }

        // If there's a scheduled_max_users in metadata, this is a scheduled change
        // Don't update max_users now - it will be applied on invoice.payment_succeeded
        if (scheduledMaxUsers) {
          console.log(`Subscription has scheduled_max_users=${scheduledMaxUsers}, skipping max_users update (will apply on payment)`)

          // Store the scheduled quantity in the database for UI display
          // Find the company_module by subscription ID
          const { data: companyModule } = await supabaseAdmin
            .from('company_modules')
            .select('id, module_code')
            .eq('stripe_subscription_id', subscription.id)
            .single()

          if (companyModule) {
            await supabaseAdmin
              .from('company_modules')
              .update({
                scheduled_max_users: parseInt(scheduledMaxUsers, 10),
                scheduled_change_at: subscription.metadata?.scheduled_at || new Date().toISOString()
              })
              .eq('id', companyModule.id)

            console.log(`Stored scheduled_max_users=${scheduledMaxUsers} for module ${companyModule.module_code}`)
          }

          // Still update company status but NOT max_users
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
            // Module is active if subscription is active OR trialing
            const isActive = subscription.status === 'active' || subscription.status === 'trialing'
            await supabaseAdmin
              .from('company_modules')
              .update({
                max_users: item.quantity || 10,
                is_active: isActive
              })
              .eq('company_id', companyId)
              .eq('module_code', modCode)

            console.log(`Updated module ${modCode}: quantity=${item.quantity}, active=${isActive} (status: ${subscription.status})`)
          }
        }

        // Update company subscription status
        const statusMap: Record<string, string> = {
          'active': 'active',
          'trialing': 'trialing',
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

        // Deactivate all modules in subscription and clear all scheduled/period data
        for (const modCode of moduleCodes) {
          await supabaseAdmin
            .from('company_modules')
            .update({
              is_active: false,
              deactivated_at: new Date().toISOString(),
              // Clear all scheduled and period fields so new subscription starts fresh
              scheduled_max_users: null,
              scheduled_change_at: null,
              subscription_period_start: null,
              subscription_period_end: null,
              next_billing_cycle_price: null,
              price_scheduled_at: null
            })
            .eq('company_id', companyId)
            .eq('module_code', modCode)

          console.log(`Deactivated module ${modCode} for company ${companyId}, cleared scheduled data`)
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
          .select('id, bonus_balance')
          .eq('stripe_customer_id', customerId)
          .single()

        if (company) {
          // Check if Stripe Customer Balance was used for this payment
          // starting_balance and ending_balance are negative (credit to customer)
          const startingBalance = invoice.starting_balance || 0
          const endingBalance = invoice.ending_balance || 0
          const balanceUsed = (startingBalance - endingBalance) / 100 // Convert to PLN (positive if balance was used)

          if (balanceUsed > 0) {
            // Update local bonus_balance to match Stripe
            const newLocalBalance = Math.max(0, (company.bonus_balance || 0) - balanceUsed)

            await supabaseAdmin
              .from('companies')
              .update({ bonus_balance: newLocalBalance })
              .eq('id', company.id)

            console.log(`Stripe used ${balanceUsed} PLN from Customer Balance. Local balance updated: ${company.bonus_balance} -> ${newLocalBalance}`)

            // Log balance usage in bonus_transactions
            await supabaseAdmin
              .from('bonus_transactions')
              .insert({
                company_id: company.id,
                amount: balanceUsed,
                type: 'debit',
                description: `Automatyczne wykorzystanie balansu dla faktury ${invoice.number || invoice.id}`
              })
          }

          // Determine payment method based on balance usage
          const cardPaidAmount = invoice.amount_paid / 100
          let invoicePaymentMethod = 'stripe'
          if (balanceUsed > 0 && cardPaidAmount > 0) {
            invoicePaymentMethod = 'mixed'
          } else if (balanceUsed > 0 && cardPaidAmount === 0) {
            invoicePaymentMethod = 'bonus'
          }

          // Build comment with module details from active company modules
          let paymentComment: string | null = null
          try {
            const { data: activeModules } = await supabaseAdmin
              .from('company_modules')
              .select('module_code, max_users')
              .eq('company_id', company.id)
              .eq('is_active', true)

            if (activeModules && activeModules.length > 0) {
              const moduleLabels: Record<string, string> = {
                'recruitment': 'Rekrutacja',
                'skills': 'Umiejętności'
              }
              const moduleDetails = activeModules.map(m =>
                `${moduleLabels[m.module_code] || m.module_code}: ${m.max_users} miejsc`
              ).join(', ')
              paymentComment = moduleDetails
            }
          } catch (e) {
            console.log('Could not fetch module details for payment comment:', e)
          }

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
              paid_at: new Date().toISOString(),
              description: balanceUsed > 0
                ? `Płatność: ${(invoice.amount_paid / 100).toFixed(2)} PLN z karty + ${balanceUsed.toFixed(2)} PLN z balansu`
                : undefined,
              payment_method: invoicePaymentMethod,
              payment_type: 'subscription',
              comment: paymentComment
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

          // Apply scheduled max_users changes from Stripe subscription metadata
          if (invoice.subscription) {
            try {
              const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string)
              const scheduledMaxUsers = subscription.metadata?.scheduled_max_users

              if (scheduledMaxUsers) {
                const newMaxUsers = parseInt(scheduledMaxUsers, 10)
                const moduleCode = subscription.metadata?.module_code

                // Find company_module by subscription ID
                const { data: companyModule } = await supabaseAdmin
                  .from('company_modules')
                  .select('id, module_code')
                  .eq('stripe_subscription_id', subscription.id)
                  .single()

                if (companyModule && newMaxUsers > 0) {
                  // Apply the scheduled max_users change, clear scheduled fields, and update period dates
                  await supabaseAdmin
                    .from('company_modules')
                    .update({
                      max_users: newMaxUsers,
                      scheduled_max_users: null,
                      scheduled_change_at: null,
                      subscription_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
                      subscription_period_end: new Date(subscription.current_period_end * 1000).toISOString()
                    })
                    .eq('id', companyModule.id)

                  console.log(`Applied scheduled max_users ${newMaxUsers} to company_module ${companyModule.id}`)

                  // Clear the scheduled metadata from Stripe
                  await stripe.subscriptions.update(subscription.id, {
                    metadata: {
                      ...subscription.metadata,
                      scheduled_max_users: null,
                      scheduled_at: null
                    }
                  })
                }
              }
              // Always update subscription period dates for this module
              await supabaseAdmin
                .from('company_modules')
                .update({
                  subscription_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
                  subscription_period_end: new Date(subscription.current_period_end * 1000).toISOString()
                })
                .eq('stripe_subscription_id', subscription.id)

              console.log(`Updated subscription period dates for subscription ${subscription.id}`)
            } catch (subErr) {
              console.error('Error applying scheduled max_users:', subErr)
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
              created_at: new Date().toISOString(),
              payment_method: 'stripe',
              payment_type: 'subscription'
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
