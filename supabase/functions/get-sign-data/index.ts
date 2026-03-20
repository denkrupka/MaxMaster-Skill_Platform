import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { token } = await req.json()
    if (!token) return new Response(JSON.stringify({ error: 'Token required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Знайти токен
    const { data: tokenData, error: tokenErr } = await supabase
      .from('signature_tokens')
      .select('*')
      .eq('token', token)
      .single()

    if (tokenErr || !tokenData) {
      return new Response(JSON.stringify({ error: 'Link jest nieważny lub wygasł' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: 'Link wygasł' }), { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (tokenData.used_at) {
      return new Response(JSON.stringify({ error: 'Link już został użyty' }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Знайти signature_request
    const { data: request } = await supabase
      .from('signature_requests')
      .select('*')
      .eq('id', tokenData.request_id)
      .single()

    // Знайти документ
    const { data: document } = await supabase
      .from('documents')
      .select('id, title, content, status, company_id')
      .eq('id', request?.document_id)
      .single()

    return new Response(
      JSON.stringify({ token: tokenData, request, document }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Internal error', detail: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
