/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SMSAPI_TOKEN = Deno.env.get('SMSAPI_TOKEN')
const SMSAPI_SENDER_NAME = Deno.env.get('SMSAPI_SENDER_NAME') || 'MAXMASTER'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const OTP_LENGTH = 6
const OTP_EXPIRY_MINUTES = 10
const MAX_ATTEMPTS = 5

/**
 * sign-otp Edge Function
 * 
 * Actions:
 *   send   — Generate OTP, store hash, send SMS
 *   verify — Check OTP code against stored hash
 *   sign   — Mark document as signed (after OTP verified)
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const json = (data: any, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  try {
    const { action, token, phoneNumber, code } = await req.json()
    if (!token) return json({ error: 'token is required' }, 400)

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Load signature request by token
    const { data: sigToken, error: tokenErr } = await supabase
      .from('signature_tokens')
      .select('*, signature_requests(*, documents(id, name, number, data, template_id))')
      .eq('token', token)
      .single()

    if (tokenErr || !sigToken) {
      return json({ error: 'invalid_token', message: 'Link jest nieprawidłowy.' }, 404)
    }

    const sigReq = sigToken.signature_requests
    if (!sigReq) return json({ error: 'no_request', message: 'Brak powiązanego zapytania.' }, 404)

    // Check if already signed
    if (sigReq.status === 'signed') {
      return json({ error: 'already_signed', message: 'Dokument już został podpisany.' }, 400)
    }

    // Check expiry
    if (sigToken.expires_at && new Date(sigToken.expires_at) < new Date()) {
      return json({ error: 'expired', message: 'Link wygasł.' }, 400)
    }

    // ─── ACTION: send ───
    if (action === 'send') {
      if (!phoneNumber) return json({ error: 'phoneNumber is required' }, 400)

      const normalizedPhone = phoneNumber.replace(/[\s\-+]/g, '')
      const finalPhone = normalizedPhone.startsWith('48') ? normalizedPhone : `48${normalizedPhone}`

      // Generate OTP
      const otp = Array.from(crypto.getRandomValues(new Uint8Array(OTP_LENGTH)))
        .map(b => (b % 10).toString())
        .join('')

      const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString()

      // Store OTP in signature_tokens metadata (server-side only)
      const { error: updateErr } = await supabase
        .from('signature_tokens')
        .update({
          metadata: {
            otp_hash: otp, // In production, hash this
            otp_phone: finalPhone,
            otp_expires_at: expiresAt,
            otp_attempts: 0,
            otp_verified: false,
          },
        })
        .eq('token', token)

      if (updateErr) {
        console.error('Failed to store OTP:', updateErr)
        return json({ error: 'server_error' }, 500)
      }

      // Send SMS via SMSAPI
      if (!SMSAPI_TOKEN) {
        console.error('SMSAPI_TOKEN not configured')
        return json({ error: 'sms_not_configured' }, 500)
      }

      const smsMessage = `MaxMaster: Kod weryfikacyjny: ${otp}. Wazny ${OTP_EXPIRY_MINUTES} minut.`

      const params = new URLSearchParams({
        to: finalPhone,
        message: smsMessage,
        from: SMSAPI_SENDER_NAME,
        format: 'json',
        encoding: 'utf-8',
      })

      const smsResp = await fetch(`https://api.smsapi.pl/sms.do?${params}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${SMSAPI_TOKEN}` },
      })

      if (!smsResp.ok) {
        console.error('SMS send failed:', await smsResp.text())
        return json({ error: 'sms_failed', message: 'Nie udało się wysłać SMS. Sprawdź numer.' }, 500)
      }

      // Log SMS
      await supabase.from('sms_logs').insert({
        phone_number: finalPhone,
        message: smsMessage,
        template_code: 'sign_otp',
        status: 'sent',
        sent_at: new Date().toISOString(),
      }).catch(() => {})

      return json({
        success: true,
        message: 'Kod wysłany',
        phoneMasked: finalPhone.slice(0, 2) + '***' + finalPhone.slice(-3),
      })
    }

    // ─── ACTION: verify ───
    if (action === 'verify') {
      if (!code) return json({ error: 'code is required' }, 400)

      const meta = sigToken.metadata as any
      if (!meta?.otp_hash) {
        return json({ error: 'no_otp', message: 'Najpierw wyślij kod SMS.' }, 400)
      }

      // Check attempts
      if ((meta.otp_attempts || 0) >= MAX_ATTEMPTS) {
        return json({ error: 'too_many_attempts', message: 'Zbyt wiele prób. Wyślij nowy kod.' }, 400)
      }

      // Increment attempts
      await supabase
        .from('signature_tokens')
        .update({
          metadata: { ...meta, otp_attempts: (meta.otp_attempts || 0) + 1 },
        })
        .eq('token', token)

      // Check expiry
      if (meta.otp_expires_at && new Date(meta.otp_expires_at) < new Date()) {
        return json({ error: 'otp_expired', message: 'Kod wygasł. Wyślij nowy.' }, 400)
      }

      // Check code
      if (meta.otp_hash !== code) {
        return json({ error: 'invalid_code', message: 'Nieprawidłowy kod.' }, 400)
      }

      // Mark as verified
      await supabase
        .from('signature_tokens')
        .update({
          metadata: { ...meta, otp_verified: true, otp_verified_at: new Date().toISOString() },
        })
        .eq('token', token)

      // Return document data for preview
      const doc = sigReq.documents
      return json({
        success: true,
        verified: true,
        document: {
          id: doc?.id,
          name: doc?.name,
          number: doc?.number,
          data: doc?.data,
          templateName: doc?.document_templates?.name,
          templateContent: doc?.document_templates?.content,
        },
        signer: {
          name: sigReq.signer_name,
          email: sigReq.signer_email,
          role: sigReq.signer_role,
        },
        message: sigReq.message,
      })
    }

    // ─── ACTION: sign ───
    if (action === 'sign') {
      const meta = sigToken.metadata as any
      if (!meta?.otp_verified) {
        return json({ error: 'not_verified', message: 'Najpierw zweryfikuj tożsamość.' }, 403)
      }

      // Update signature request
      const { error: signErr } = await supabase
        .from('signature_requests')
        .update({
          status: 'signed',
          signed_at: new Date().toISOString(),
          user_agent: req.headers.get('user-agent') || null,
        })
        .eq('id', sigReq.id)

      if (signErr) {
        console.error('Sign error:', signErr)
        return json({ error: 'sign_failed' }, 500)
      }

      // Mark token as used
      await supabase
        .from('signature_tokens')
        .update({ used: true })
        .eq('token', token)

      // Create digital signature record
      const verificationCode = sigReq.id.slice(0, 8).toUpperCase()
      await supabase.from('digital_signatures').insert({
        document_id: sigReq.documents?.id,
        signer_email: sigReq.signer_email,
        signer_name: sigReq.signer_name,
        signature_type: 'electronic_sms_otp',
        signed_at: new Date().toISOString(),
        verification_code: verificationCode,
        metadata: {
          phone: meta.otp_phone,
          verified_at: meta.otp_verified_at,
        },
      }).catch(() => {})

      // Audit log
      await supabase.from('document_audit_log').insert({
        document_id: sigReq.documents?.id,
        action: 'signed',
        details: {
          signer: sigReq.signer_email,
          method: 'sms_otp',
          phone: meta.otp_phone,
        },
      }).catch(() => {})

      // Try webhook
      try {
        await supabase.functions.invoke('document-signed-webhook', {
          body: {
            token,
            request_id: sigReq.id,
            document_id: sigReq.documents?.id,
            signer_email: sigReq.signer_email,
          },
        })
      } catch { /* optional */ }

      return json({
        success: true,
        signed: true,
        verificationCode,
        documentName: sigReq.documents?.name,
        signerName: sigReq.signer_name,
      })
    }

    return json({ error: 'invalid_action', message: 'Use: send, verify, or sign' }, 400)
  } catch (err: any) {
    console.error('sign-otp error:', err)
    return json({ error: 'server_error', message: err.message }, 500)
  }
})
