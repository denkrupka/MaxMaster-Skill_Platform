import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    
    const { document_id, event_type, description, metadata } = await req.json()
    
    if (!document_id || !event_type) {
      return new Response(JSON.stringify({ error: 'document_id and event_type required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    // Get user from JWT
    const authHeader = req.headers.get('Authorization')
    let user_id = null
    if (authHeader) {
      const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
      user_id = user?.id
    }
    
    const { data, error } = await supabase.from('document_audit_log').insert({
      document_id,
      event_type,
      description: description || event_type,
      user_id,
      metadata: metadata || {},
      ip_address: req.headers.get('x-forwarded-for') || null,
    }).select().single()
    
    if (error) throw error
    
    return new Response(JSON.stringify({ ok: true, data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
