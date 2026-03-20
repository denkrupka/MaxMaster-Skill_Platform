import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    let token = ''
    if (req.method === 'GET') {
      const url = new URL(req.url)
      token = url.searchParams.get('token') || ''
    } else {
      const body = await req.json()
      token = body.token || ''
    }

    if (!token) return new Response(JSON.stringify({ error: 'Token required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Try by token column first
    let { data: tokenData, error: tokenErr } = await supabase
      .from('signature_tokens')
      .select('*')
      .eq('token', token)
      .maybeSingle()

    // Fallback: try by id
    if (!tokenData) {
      const res = await supabase
        .from('signature_tokens')
        .select('*')
        .eq('id', token)
        .maybeSingle()
      tokenData = res.data
      tokenErr = res.error
    }

    if (!tokenData) {
      return new Response(JSON.stringify({ error: 'Link jest nieważny lub wygasł', detail: tokenErr?.message }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: 'Link wygasł' }), { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Get signature_request
    const { data: request } = await supabase
      .from('signature_requests')
      .select('*')
      .eq('id', tokenData.request_id)
      .maybeSingle()

    // Get document
    const { data: document } = await supabase
      .from('documents')
      .select('id, title, content, status, company_id')
      .eq('id', request?.document_id)
      .maybeSingle()

    return new Response(
      JSON.stringify({ token: tokenData, request, document }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Internal error', detail: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
