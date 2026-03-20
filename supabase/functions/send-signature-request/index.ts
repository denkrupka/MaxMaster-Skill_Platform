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
    const { document_id, signer_email, signer_name, signer_position, party_name, party_role, message: emailMessage, subject: emailSubject, expires_at: customExpiry, email_body } = body
    
    // Support both flat single-signer format and array format
    let signers = body.signers
    if (!signers?.length && signer_email) {
      signers = [{ email: signer_email, name: signer_name || signer_email.split('@')[0], position: signer_position, party_name, party_role }]
    }
    
    if (!document_id || !signers?.length) {
      return new Response(JSON.stringify({ error: 'document_id and signers required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { data: doc } = await supabase.from('documents')
      .select('title, company_id')
      .eq('id', document_id).single()

    const results = []
    const postmarkKey = Deno.env.get('POSTMARK_API_KEY') || Deno.env.get('POSTMARK_SERVER_TOKEN')
    const EMAIL_FROM = Deno.env.get('EMAIL_FROM') || 'MaxMaster <noreply@maxmaster.info>'

    for (const signer of signers) {
      // Create token
      const token = crypto.randomUUID()
      const expires_at = customExpiry ? new Date(customExpiry).toISOString() : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

      // Insert signature request
      const { data: sr, error: srErr } = await supabase.from('signature_requests').insert({
        document_id,
        company_id: doc?.company_id,
        signer_email: signer.email,
        signer_name: signer.name,
        signer_role: signer.role || 'signer',
        signing_order: signer.order || 1,
        status: 'pending',
        token,
        expires_at,
      }).select().single()

      if (srErr) { results.push({ email: signer.email, error: srErr.message }); continue }

      // Insert token
      await supabase.from('signature_tokens').insert({
        token,
        signature_request_id: sr.id,
        document_id,
        expires_at,
      })

      // Send email via Postmark
      if (postmarkKey) {
        const signUrl = `https://denkrupka.github.io/maxmaster-preview/#/sign/${token}`
        const emailResp = await fetch('https://api.postmarkapp.com/email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-Postmark-Server-Token': postmarkKey,
          },
          body: JSON.stringify({
            From: EMAIL_FROM,
            To: signer.email,
            Subject: `Prośba o podpis: ${doc?.title || 'Dokument'}`,
            HtmlBody: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 30px; text-align: center;">
                  <h1 style="color: white; margin: 0;">MaxMaster</h1>
                </div>
                <div style="padding: 30px; background: #f8fafc;">
                  <h2 style="color: #1e293b;">Prośba o podpis dokumentu</h2>
                  <p style="color: #475569;">Cześć <strong>${signer.name}</strong>,</p>
                  <p style="color: #475569;">Proszę o podpisanie dokumentu: <strong>${doc?.title || 'Dokument'}</strong></p>
                  <p style="margin: 24px 0;">
                    <a href="${signUrl}"
                       style="background:#1d4ed8;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">
                      Podpisz dokument →
                    </a>
                  </p>
                  <p style="color: #6b7280; font-size: 12px;">Link ważny 7 dni. Nie odpowiadaj na ten email.</p>
                </div>
              </div>
            `,
            TextBody: `Proszę o podpis dokumentu "${doc?.title}". Link: ${signUrl}`,
            MessageStream: 'outbound',
          }),
        })
        const emailResult = await emailResp.json()
        if (!emailResp.ok || emailResult.ErrorCode) {
          console.error('Postmark error:', emailResult)
          results.push({ email: signer.email, sent: false, error: emailResult.Message || 'Failed to send email via Postmark' })
        } else {
          results.push({ email: signer.email, sent: true, messageId: emailResult.MessageID })

          // SMS notification if phone provided
          if (signer.phone) {
            try {
              await supabase.functions.invoke('send-sms', {
                body: {
                  phoneNumber: signer.phone,
                  message: `MaxMaster: Masz dokument do podpisania. Kliknij: ${signUrl}`
                }
              })
              console.log('SMS sent to', signer.phone)
            } catch (smsErr) {
              console.warn('SMS failed (non-critical):', smsErr)
            }
          }
        }
      } else {
        results.push({ email: signer.email, sent: false, error: 'POSTMARK_API_KEY not configured' })
      }
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
