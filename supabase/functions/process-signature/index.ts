import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json()
    const { token, name, signature } = body

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const POSTMARK_KEY = Deno.env.get('POSTMARK_API_KEY') || Deno.env.get('POSTMARK_SERVER_TOKEN')

    const sendEmail = async (to: string, subject: string, html: string) => {
      if (!POSTMARK_KEY || !to) return
      try {
        await fetch('https://api.postmarkapp.com/email', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'X-Postmark-Server-Token': POSTMARK_KEY
          },
          body: JSON.stringify({ From: 'noreply@maxmaster.info', To: to, Subject: subject, HtmlBody: html })
        })
      } catch(e) { console.error('Email error:', e) }
    }

    if (!token) {
      return new Response(JSON.stringify({ error: 'token required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Get token — not yet used
    const { data: tokenData } = await supabase
      .from('signature_tokens')
      .select('*')
      .eq('token', token)
      .is('used_at', null)
      .maybeSingle()

    if (!tokenData) {
      return new Response(JSON.stringify({ error: 'Link nieważny lub już wykorzystany' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { data: signRequest } = await supabase
      .from('signature_requests')
      .select('*')
      .eq('id', tokenData.request_id)
      .maybeSingle()

    const { data: doc } = await supabase
      .from('documents')
      .select('id, name, company_id')
      .eq('id', signRequest?.document_id)
      .maybeSingle()

    const ip = req.headers.get('x-forwarded-for') || 'unknown'
    const ua = req.headers.get('user-agent') || 'unknown'
    const signerName = name || 'Signer'

    // Extract signer email
    const signers = signRequest?.signers || []
    const signerList = Array.isArray(signers) ? signers : [signers]
    const signerEmail = signerList[0]?.email || signerList[0]?.signer_email || ''

    // Mark token used
    await supabase.from('signature_tokens').update({
      used_at: new Date().toISOString(),
      ip_address: ip,
      user_agent: ua,
      signature_data: signature || null,
      metadata: { signed_name: signerName }
    }).eq('token', token)

    // Update request status
    await supabase.from('signature_requests')
      .update({ status: 'signed' })
      .eq('id', tokenData.request_id)

    // Audit log with all available columns
    try {
      await supabase.from('document_audit_log').insert({
        document_id: doc?.id,
        company_id: doc?.company_id,
        action: 'signed',
        actor_type: 'signer',
        actor_name: signerName,
        actor_email: signerEmail || null,
        ip_address: ip,
        user_agent: ua,
        metadata: { token_id: tokenData.id, request_id: tokenData.request_id },
        created_at: new Date().toISOString()
      })
    } catch(_) {}

    // Confirmation email
    if (signerEmail) {
      await sendEmail(
        signerEmail,
        `Potwierdzenie podpisu: ${doc?.name || 'Dokument'}`,
        `<p>Dzien dobry ${signerName},</p>
         <p>Dokument <strong>${doc?.name || 'Dokument'}</strong> został pomyślnie podpisany.</p>
         <p>Data podpisu: ${new Date().toLocaleDateString('pl-PL')}</p>
         <p style="color:#6b7280;font-size:12px;">MaxMaster</p>`
      )
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Dokument podpisany pomyślnie', signed_at: new Date().toISOString() }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
