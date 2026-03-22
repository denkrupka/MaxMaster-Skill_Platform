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

    // Token lookup: try token column first, then fall back to id column (backward compat)
    let tokenData = null
    const { data: byToken } = await supabase.from('signature_tokens').select('*').eq('token', token).maybeSingle()
    if (byToken) {
      tokenData = byToken
    } else {
      // Fallback: look up by id (old-style URLs used signature_tokens.id as the URL param)
      const { data: byId } = await supabase.from('signature_tokens').select('*').eq('id', token).maybeSingle()
      tokenData = byId
    }

    if (!tokenData) return new Response(JSON.stringify({ error: 'Link jest nieważny lub wygasł' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    // Get the signature request
    const { data: request } = await supabase.from('signature_requests').select('*').eq('id', tokenData.request_id).maybeSingle()

    // Get the document via request.document_id
    let document = null
    if (request?.document_id) {
      const { data: doc } = await supabase.from('documents').select('id, name, number, status, company_id, data, pdf_path, signing_mode, parties, created_at, template_id').eq('id', request.document_id).maybeSingle()
      document = doc
    }

    // Render template content if document has template_id
    let rendered_content: string | null = null
    if (document?.template_id) {
      const { data: tmpl } = await supabase.from('document_templates').select('content').eq('id', document.template_id).maybeSingle()
      if (tmpl?.content) {
        rendered_content = tmpl.content
        const docData = document.data || {}
        for (const [key, val] of Object.entries(docData)) {
          rendered_content = rendered_content!.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(val ?? ''))
        }
        // Clean up any remaining unreplaced placeholders
        rendered_content = rendered_content!.replace(/\{\{[^}]+\}\}/g, '')
      }
    }

    return new Response(JSON.stringify({ token: tokenData, request, document, rendered_content }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
