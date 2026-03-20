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
      token = new URL(req.url).searchParams.get('token') || ''
    } else {
      const body = await req.json()
      token = body.token || ''
    }

    if (!token) return new Response(JSON.stringify({ error: 'Token required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // Token lookup: signature_tokens.token = the token UUID from URL
    const { data: tokenData } = await supabase.from('signature_tokens').select('*').eq('token', token).maybeSingle()
    if (!tokenData) return new Response(JSON.stringify({ error: 'Link jest nieważny lub wygasł' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    // Get the signature request
    const { data: request } = await supabase.from('signature_requests').select('*').eq('id', tokenData.request_id).maybeSingle()

    // Get the document via request.document_id
    let document = null
    if (request?.document_id) {
      const { data: doc } = await supabase.from('documents').select('id, name, number, status, company_id, data, pdf_path, signing_mode, parties, created_at').eq('id', request.document_id).maybeSingle()
      document = doc
    }

    return new Response(JSON.stringify({ token: tokenData, request, document }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
