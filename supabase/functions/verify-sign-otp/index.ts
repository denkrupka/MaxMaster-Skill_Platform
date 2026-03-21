import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { token, phone, code } = await req.json()

    if (!token || !phone || !code) {
      return new Response(JSON.stringify({ error: 'token, phone i code są wymagane' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const normalizedPhone = phone.replace(/[\s\-\(\)]/g, '').replace(/^00/, '+').replace(/^0/, '+48')

    // Find OTP record
    const { data: otpRow } = await supabase
      .from('sign_otp_codes')
      .select('*')
      .eq('token', token)
      .eq('phone', normalizedPhone)
      .eq('verified', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!otpRow) {
      return new Response(JSON.stringify({ error: 'Kod wygasł lub nie istnieje. Wyślij nowy kod.' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check attempts
    if (otpRow.attempts >= 5) {
      await supabase.from('sign_otp_codes').delete().eq('id', otpRow.id)
      return new Response(JSON.stringify({ error: 'Zbyt wiele prób. Wyślij nowy kod.' }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (otpRow.code !== code.trim()) {
      await supabase.from('sign_otp_codes').update({ attempts: otpRow.attempts + 1 }).eq('id', otpRow.id)
      return new Response(JSON.stringify({ error: 'Nieprawidłowy kod. Sprawdź SMS i spróbuj ponownie.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Mark as verified
    await supabase.from('sign_otp_codes').update({ verified: true }).eq('id', otpRow.id)

    return new Response(
      JSON.stringify({ ok: true, verified: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
