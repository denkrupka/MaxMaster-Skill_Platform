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

    const body = await req.json()
    const { document_id, event_type, action, actor_email, description, metadata, details, content_snapshot, snapshot_reason } = body

    const effectiveAction = event_type || action
    if (!document_id || !effectiveAction) {
      return new Response(JSON.stringify({ error: 'document_id and event_type/action required' }), {
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

    // eIDAS compliance: IP, UserAgent, content hash
    const ip_address = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
    const user_agent = (req.headers.get('user-agent') || 'unknown').slice(0, 200)

    let document_hash: string | null = null
    if (content_snapshot) {
      const encoder = new TextEncoder()
      const data = encoder.encode(content_snapshot)
      const hashBuffer = await crypto.subtle.digest('SHA-256', data)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      document_hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32)
    }

    // Log audit event
    const { data, error } = await supabase.from('document_audit_log').insert({
      document_id,
      event_type: effectiveAction,
      description: description || details || effectiveAction,
      user_id,
      actor_email: actor_email || null,
      metadata: metadata || {},
      ip_address,
      user_agent,
      document_hash,
    }).select().single()

    if (error) throw error

    // Save version snapshot if content provided
    if (content_snapshot && document_id) {
      const { data: lastVer } = await supabase
        .from('document_versions')
        .select('version_number')
        .eq('document_id', document_id)
        .order('version_number', { ascending: false })
        .limit(1)
        .single()
        .catch(() => ({ data: null }))

      const nextVersion = (lastVer?.version_number || 0) + 1

      await supabase.from('document_versions').insert({
        document_id,
        version_number: nextVersion,
        content: content_snapshot,
        created_by: actor_email || user_id || null,
        snapshot_reason: snapshot_reason || effectiveAction,
      })
    }

    return new Response(JSON.stringify({ ok: true, data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
