import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { action, offer_id, phone_number, code, recipient_name } = await req.json()

    if (action === 'send-code') {
      // Generate 6-digit code
      const verificationCode = String(Math.floor(100000 + Math.random() * 900000))
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes

      // Store in DB
      const { error: insertErr } = await supabase
        .from('offer_sms_verifications')
        .insert({
          offer_id,
          phone_number,
          code: verificationCode,
          expires_at: expiresAt,
        })

      if (insertErr) {
        return new Response(JSON.stringify({ error: 'Nie udało się wygenerować kodu' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Send SMS via SMSAPI.pl
      const smsApiToken = Deno.env.get('SMSAPI_TOKEN')
      if (smsApiToken) {
        try {
          const smsResponse = await fetch('https://api.smsapi.pl/sms.do', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${smsApiToken}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              to: phone_number.replace(/\D/g, ''),
              message: `Twój kod weryfikacyjny do akceptacji oferty: ${verificationCode}. Ważny przez 10 minut.`,
              from: 'MaxMaster',
              format: 'json',
            }),
          })

          if (!smsResponse.ok) {
            console.error('SMSAPI error:', await smsResponse.text())
          }
        } catch (smsErr) {
          console.error('SMS send error:', smsErr)
          // Continue even if SMS fails — code is in DB for testing
        }
      } else {
        console.warn('SMSAPI_TOKEN not set — code stored in DB only (dev mode)')
      }

      // Mask phone number for response
      const digits = phone_number.replace(/\D/g, '')
      const masked = digits.length > 4
        ? '*'.repeat(digits.length - 4) + digits.slice(-4)
        : digits

      return new Response(JSON.stringify({ success: true, masked_phone: masked }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })

    } else if (action === 'verify-code') {
      // Find latest non-expired verification for this offer
      const { data: verification, error: fetchErr } = await supabase
        .from('offer_sms_verifications')
        .select('*')
        .eq('offer_id', offer_id)
        .is('verified_at', null)
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (fetchErr || !verification) {
        return new Response(JSON.stringify({ error: 'Kod wygasł lub nie istnieje. Wyślij nowy kod.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Check max attempts
      if (verification.attempts >= 5) {
        return new Response(JSON.stringify({ error: 'Zbyt wiele prób. Wyślij nowy kod.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Increment attempts
      await supabase
        .from('offer_sms_verifications')
        .update({ attempts: verification.attempts + 1 })
        .eq('id', verification.id)

      // Check code
      if (verification.code !== code) {
        return new Response(JSON.stringify({
          error: 'Nieprawidłowy kod',
          attempts_left: 4 - verification.attempts
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Mark as verified
      await supabase
        .from('offer_sms_verifications')
        .update({ verified_at: new Date().toISOString() })
        .eq('id', verification.id)

      // Accept the offer
      await supabase
        .from('offers')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString(),
        })
        .eq('id', offer_id)

      return new Response(JSON.stringify({ success: true, verified: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })

    } else {
      return new Response(JSON.stringify({ error: 'Nieznana akcja' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  } catch (err) {
    console.error('verify-offer-sms error:', err)
    return new Response(JSON.stringify({ error: 'Wewnętrzny błąd serwera' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
