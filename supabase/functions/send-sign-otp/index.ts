import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { token, phone } = await req.json()

    if (!token || !phone) {
      return new Response(JSON.stringify({ error: 'token i phone są wymagane' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // Normalize phone: remove spaces, dashes; ensure starts with +
    const normalizedPhone = phone.replace(/[\s\-\(\)]/g, '').replace(/^00/, '+').replace(/^0/, '+48')

    // Get token → request → signers
    const { data: tokenRow } = await supabase
      .from('signature_tokens')
      .select('request_id')
      .eq('token', token)
      .is('used_at', null)
      .maybeSingle()

    if (!tokenRow) {
      return new Response(JSON.stringify({ error: 'Link nieważny lub wygasł' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { data: request } = await supabase
      .from('signature_requests')
      .select('signers')
      .eq('id', tokenRow.request_id)
      .maybeSingle()

    // Check phone matches a signer
    const signers = request?.signers || []
    const signerList = Array.isArray(signers) ? signers : [signers]
    
    const matchedSigner = signerList.find((s: any) => {
      if (!s?.phone) return false
      const signerPhone = s.phone.replace(/[\s\-\(\)]/g, '').replace(/^00/, '+').replace(/^0/, '+48')
      return signerPhone === normalizedPhone
    })

    if (!matchedSigner) {
      return new Response(JSON.stringify({ 
        error: 'Numer telefonu nie jest powiązany z tym dokumentem. Skontaktuj się z wystawcą dokumentu.' 
      }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Generate 6-digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString()

    // Store OTP (delete old ones for this token+phone first)
    await supabase.from('sign_otp_codes').delete().eq('token', token).eq('phone', normalizedPhone)
    await supabase.from('sign_otp_codes').insert({
      token, phone: normalizedPhone, code
    })

    // Send SMS via SMSAPI.pl
    const smsToken = Deno.env.get('SMSAPI_TOKEN')
    const senderName = Deno.env.get('SMSAPI_SENDER_NAME') || 'MAXMASTER'
    
    if (smsToken) {
      const smsRes = await fetch('https://api.smsapi.pl/sms.do', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${smsToken}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          to: normalizedPhone,
          message: `Twój kod weryfikacyjny MaxMaster: ${code}. Ważny 10 minut.`,
          from: senderName,
          format: 'json',
        })
      })
      const smsResult = await smsRes.json()
      if (smsResult.error) {
        console.error('SMS error:', smsResult)
      }
    } else {
      console.log(`OTP code for ${normalizedPhone}: ${code}`)
    }

    return new Response(
      JSON.stringify({ ok: true, message: 'Kod SMS wysłany' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
