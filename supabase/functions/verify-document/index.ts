import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  
  const url = new URL(req.url)
  const documentId = url.searchParams.get('id')
  
  if (!documentId) {
    return new Response(JSON.stringify({ error: 'Document ID required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: doc } = await supabase.from('documents')
    .select('id, title, status, created_at, expires_at')
    .eq('id', documentId).single()

  if (!doc) {
    return new Response(JSON.stringify({ valid: false, error: 'Document not found' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const { data: signatures } = await supabase.from('signature_requests')
    .select('signer_name, signer_email, status, signed_at, ip_address')
    .eq('document_id', documentId).eq('status', 'signed')

  return new Response(JSON.stringify({
    valid: true,
    document: {
      id: doc.id,
      title: doc.title,
      status: doc.status,
      created_at: doc.created_at,
      expires_at: doc.expires_at,
    },
    signatures: signatures || [],
    verified_at: new Date().toISOString(),
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})
