import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json()
    const { token, signed, phone, document_id, signed_by, notify_all } = body

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const POSTMARK_KEY = Deno.env.get('POSTMARK_API_KEY') || Deno.env.get('POSTMARK_SERVER_TOKEN')

    const sendEmail = async (to: string, subject: string, html: string) => {
      if (!POSTMARK_KEY || !to) return
      await fetch('https://api.postmarkapp.com/email', {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'X-Postmark-Server-Token': POSTMARK_KEY },
        body: JSON.stringify({ From: 'noreply@maxmaster.info', To: to, Subject: subject, HtmlBody: html })
      }).catch(() => {})
    }

    // Owner signing (from DocumentViewPage)
    if (signed_by === 'owner' || notify_all) {
      const { data: doc } = await supabase.from('documents').select('id, name, company_id').eq('id', document_id).single()
      
      // Mark document as completed
      await supabase.from('documents').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', document_id)
      
      // Get all signers
      const { data: requests } = await supabase.from('signature_requests').select('signer_email, signer_name').eq('document_id', document_id)
      
      const certLink = `https://denkrupka.github.io/maxmaster-preview/#/construction/dms/${document_id}/certificate`
      
      // Notify all signers
      for (const req of (requests || [])) {
        if (req.signer_email) {
          await sendEmail(req.signer_email, `Dokument podpisany przez obie strony`,
            `<p>Dzień dobry${req.signer_name ? ` ${req.signer_name}` : ''},</p>
             <p>Dokument <strong>${doc?.name || 'Dokument'}</strong> został podpisany przez wszystkie strony.</p>
             <p><a href="${certLink}" style="background:#059669;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;">Zobacz certyfikat podpisu</a></p>`)
        }
      }
      
      // Log event
      await supabase.from('document_audit_log').insert({
        document_id: document_id,
        action: 'completed',
        actor_email: 'owner',
        details: 'Dokument podpisany przez obie strony. Status: completed.',
        created_at: new Date().toISOString(),
      }).catch(() => {})
      
      return new Response(JSON.stringify({ success: true, status: 'completed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Client signing (from SignPage via token)
    if (!token) {
      return new Response(JSON.stringify({ error: 'token required' }), { status: 400, headers: corsHeaders })
    }

    // Validate token
    const { data: tokenData, error: tokenErr } = await supabase
      .from('signature_tokens')
      .select('*, signature_requests(id, document_id, signer_email, signer_name, documents(name, company_id))')
      .eq('token', token)
      .eq('used', false)
      .gte('expires_at', new Date().toISOString())
      .single()

    if (tokenErr || !tokenData) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), { status: 400, headers: corsHeaders })
    }

    const signatureRequest = tokenData.signature_requests as any
    const doc = signatureRequest?.documents

    // Generate signature code
    const signatureCode = crypto.randomUUID().replace(/-/g, '').toUpperCase().slice(0, 16)

    // Mark token as used
    await supabase.from('signature_tokens').update({ used: true, used_at: new Date().toISOString() }).eq('id', tokenData.id)

    // Update signature request
    await supabase.from('signature_requests').update({
      status: 'signed',
      signed_at: new Date().toISOString(),
      signature_code: signatureCode,
      signature_method: phone ? 'sms' : 'email',
      signer_phone: phone || null,
    }).eq('id', signatureRequest.id)

    // Update document status
    await supabase.from('documents').update({ status: 'client_signed', updated_at: new Date().toISOString() }).eq('id', signatureRequest.document_id)

    // Log event
    await supabase.from('document_audit_log').insert({
      document_id: signatureRequest.document_id,
      action: 'signed',
      actor_email: signatureRequest.signer_email,
      details: `Podpisano elektronicznie. Kod: ${signatureCode}. Metoda: ${phone ? 'SMS' : 'Email'}`,
      created_at: new Date().toISOString(),
    }).catch(() => {})

    // Notify document owner — find owner email
    const { data: ownerProfile } = await supabase
      .from('user_profiles')
      .select('email')
      .eq('company_id', doc?.company_id)
      .eq('role', 'admin')
      .limit(1)
      .single()
      .catch(() => ({ data: null }))

    const ownerEmail = ownerProfile?.email
    const docLink = `https://denkrupka.github.io/maxmaster-preview/#/construction/dms/${signatureRequest.document_id}`

    if (ownerEmail) {
      await sendEmail(ownerEmail,
        `${signatureRequest.signer_name || signatureRequest.signer_email} podpisał dokument`,
        `<p>Klient <strong>${signatureRequest.signer_name || signatureRequest.signer_email}</strong> podpisał dokument <strong>${doc?.name || 'Dokument'}</strong>.</p>
         <p>Kod podpisu: <code>${signatureCode}</code></p>
         <p><a href="${docLink}" style="background:#2563eb;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;">Podpisz jako właściciel</a></p>`)
    }

    return new Response(JSON.stringify({ success: true, signatureCode }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
