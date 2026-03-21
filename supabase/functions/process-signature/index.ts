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
      })
    }

    // Owner signing (from DocumentViewPage)
    if (signed_by === 'owner' || notify_all) {
      const { data: doc } = await supabase.from('documents').select('id, name, company_id').eq('id', document_id).single()
      
      // Mark document as completed
      await supabase.from('documents').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', document_id)
      
      // Get all signature requests with signers JSONB
      const { data: requests } = await supabase.from('signature_requests').select('id, signers, status').eq('document_id', document_id)
      
      const certLink = `https://denkrupka.github.io/maxmaster-preview/#/construction/dms/${document_id}/certificate`
      
      // Notify all signers from signers JSONB
      for (const request of (requests || [])) {
        const signers = request.signers || []
        const signerList = Array.isArray(signers) ? signers : [signers]
        for (const signer of signerList) {
          const email = signer?.email || signer?.signer_email
          const name = signer?.name || signer?.signer_name || ''
          if (email) {
            await sendEmail(email, `Dokument podpisany przez obie strony`,
              `<p>Dzień dobry${name ? ` ${name}` : ''},</p>
               <p>Dokument <strong>${doc?.name || 'Dokument'}</strong> został podpisany przez wszystkie strony.</p>
               <p><a href="${certLink}" style="background:#059669;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;">Zobacz certyfikat podpisu</a></p>`)
          }
        }
      }
      
      // Log event
      await supabase.from('document_audit_log').insert({
        document_id: document_id,
        action: 'completed',
        actor_email: 'owner',
        details: 'Dokument podpisany przez obie strony. Status: completed.',
        created_at: new Date().toISOString(),
      })
      
      return new Response(JSON.stringify({ success: true, status: 'completed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Client signing (from SignPage via token)
    if (!token) {
      return new Response(JSON.stringify({ error: 'token required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Validate token (used_at IS NULL means not yet used; no expires_at column)
    const { data: tokenData, error: tokenErr } = await supabase
      .from('signature_tokens')
      .select('*')
      .eq('token', token)
      .is('used_at', null)
      .maybeSingle()

    if (tokenErr || !tokenData) {
      return new Response(JSON.stringify({ error: 'Link nieważny lub już wykorzystany' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Fetch signature request separately (tokenData.request_id → signature_requests.id)
    const { data: signRequest } = await supabase
      .from('signature_requests')
      .select('*')
      .eq('id', tokenData.request_id)
      .maybeSingle()

    // Fetch document separately
    const { data: doc } = await supabase
      .from('documents')
      .select('id, name, company_id, status')
      .eq('id', signRequest?.document_id)
      .maybeSingle()

    // Extract signer info from signers JSONB
    const signers = signRequest?.signers || []
    const signerList = Array.isArray(signers) ? signers : [signers]
    const signerEmail = signerList.length > 0
      ? (signerList[0]?.email || signerList[0]?.signer_email || '')
      : ''
    const signerName = signerList.length > 0
      ? (signerList[0]?.name || signerList[0]?.signer_name || body.name || 'Signer')
      : (body.name || 'Signer')

    // Generate signature code
    const signatureCode = crypto.randomUUID().replace(/-/g, '').toUpperCase().slice(0, 16)

    const ip = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown'
    const ua = req.headers.get('user-agent') || 'unknown'

    // Mark token as used
    await supabase.from('signature_tokens').update({
      used_at: new Date().toISOString(),
      ip_address: ip,
      user_agent: ua,
      signature_data: body.signature || null,
      metadata: { signed_name: signerName, signature_code: signatureCode }
    }).eq('id', tokenData.id)

    // Update signature request status → signed
    await supabase.from('signature_requests').update({
      status: 'signed',
    }).eq('id', tokenData.request_id)

    // Update document status
    await supabase.from('documents').update({ status: 'client_signed', updated_at: new Date().toISOString() }).eq('id', signRequest?.document_id)

    // Log event
    await supabase.from('document_audit_log').insert({
      document_id: signRequest?.document_id,
      action: 'signed',
      actor_email: signerEmail || 'signer',
      details: `Podpisano elektronicznie przez ${signerName}. Kod: ${signatureCode}. IP: ${ip}`,
      created_at: new Date().toISOString(),
    })

    // Notify document owner
    const { data: ownerProfile } = await supabase
      .from('user_profiles')
      .select('email')
      .eq('company_id', doc?.company_id)
      .eq('role', 'admin')
      .limit(1)
      .maybeSingle()

    const ownerEmail = (ownerProfile as any)?.email
    const docLink = `https://denkrupka.github.io/maxmaster-preview/#/construction/dms/${signRequest?.document_id}`

    if (ownerEmail) {
      await sendEmail(ownerEmail,
        `${signerName || signerEmail} podpisał dokument`,
        `<p>Klient <strong>${signerName || signerEmail}</strong> podpisał dokument <strong>${doc?.name || 'Dokument'}</strong>.</p>
         <p>Kod podpisu: <code>${signatureCode}</code></p>
         <p><a href="${docLink}" style="background:#2563eb;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;">Podpisz jako właściciel</a></p>`)
    }

    // Send confirmation email to signer
    if (signerEmail) {
      const certLink = `https://denkrupka.github.io/maxmaster-preview/#/sign/${token}/certificate`
      await sendEmail(signerEmail, `Potwierdzenie podpisu: ${doc?.name || 'Dokument'}`,
        `<p>Dzień dobry ${signerName},</p>
         <p>Dokument <strong>${doc?.name || 'Dokument'}</strong> został pomyślnie podpisany.</p>
         <p>Data podpisu: ${new Date().toLocaleDateString('pl-PL')}</p>
         <p>Kod podpisu: <code>${signatureCode}</code></p>
         <p><a href="${certLink}" style="background:#059669;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;">Zobacz certyfikat podpisu</a></p>
         <p style="color:#6b7280;font-size:12px;">MaxMaster — System zarządzania dokumentami</p>`)
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
