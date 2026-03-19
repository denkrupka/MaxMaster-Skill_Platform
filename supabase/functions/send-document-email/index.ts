import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RequestBody {
  document_id?: string
  documentId?: string
  recipients: Array<{ email: string; name?: string }> | string[]
  subject: string
  body?: string
  attach_pdf?: boolean
  include_public_link?: boolean
}

function json(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('authorization') ?? '' } } }
    )

    const authToken = req.headers.get('authorization')?.replace('Bearer ', '') ?? ''
    const { data: { user } } = await supabase.auth.getUser(authToken)
    if (!user) return json(401, { error: 'Unauthorized' })

    const body = await req.json() as RequestBody
    const document_id = body.document_id ?? body.documentId
    const { recipients, subject, body: messageBody, attach_pdf = false, include_public_link = false } = body

    if (!document_id || !Array.isArray(recipients) || recipients.length === 0 || !subject?.trim()) {
      return json(400, { error: 'document_id, recipients, subject are required' })
    }

    const normalizedRecipients = recipients
      .map((r) => typeof r === 'string' ? { email: r.trim(), name: '' } : { email: r.email?.trim(), name: r.name?.trim() || '' })
      .filter((r) => !!r.email)

    if (normalizedRecipients.length === 0) return json(400, { error: 'No valid recipients' })

    const { data: employee } = await supabase
      .from('employees')
      .select('company_id, first_name, last_name')
      .eq('user_id', user.id)
      .single()
    if (!employee?.company_id) return json(400, { error: 'Company not found' })

    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('id, company_id, name, number, pdf_path')
      .eq('id', document_id)
      .single()
    if (docError || !document) return json(404, { error: 'Document not found' })
    if (document.company_id !== employee.company_id) return json(403, { error: 'Forbidden' })

    let publicLink: { token: string } | null = null
    if (include_public_link) {
      const { data: existingLink } = await supabase
        .from('document_public_links')
        .select('token')
        .eq('document_id', document_id)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle()

      if (existingLink?.token) {
        publicLink = { token: existingLink.token }
      } else {
        const { data: createdLink, error: linkError } = await supabase
          .from('document_public_links')
          .insert({ company_id: employee.company_id, document_id, created_by: user.id, is_active: true })
          .select('token')
          .single()
        if (linkError) throw linkError
        publicLink = createdLink
      }
    }

    const baseRows = normalizedRecipients.map((recipient) => ({
      company_id: employee.company_id,
      document_id,
      recipient_email: recipient.email,
      recipient_name: recipient.name || null,
      subject: subject.trim(),
      body: messageBody?.trim() || null,
      attach_pdf,
      include_public_link,
      status: 'queued',
      created_by: user.id,
      metadata: {
        requested_by_user_id: user.id,
        requested_by_name: [employee.first_name, employee.last_name].filter(Boolean).join(' ').trim() || null,
        public_link_token: publicLink?.token ?? null,
        pdf_path: document.pdf_path ?? null,
      },
    }))

    const { data: queuedRows, error: insertError } = await supabase
      .from('document_emails')
      .insert(baseRows)
      .select('id, recipient_email, subject, status')
    if (insertError) throw insertError

    const EMAIL_FROM = Deno.env.get('EMAIL_FROM') || 'MaxMaster <noreply@maxmaster.info>'
    const POSTMARK_API_KEY = Deno.env.get('POSTMARK_API_KEY')
    const PUBLIC_BASE_URL = Deno.env.get('DOCUMENT_PUBLIC_BASE_URL') || ''

    const results: Array<{ id: string; recipient_email: string; status: string; provider_message_id?: string | null; error?: string | null }> = []

    for (const row of queuedRows ?? []) {
      if (!POSTMARK_API_KEY) {
        results.push({ id: row.id, recipient_email: row.recipient_email, status: 'queued' })
        continue
      }

      await supabase.from('document_emails').update({ status: 'sending' }).eq('id', row.id)

      const publicUrl = include_public_link && publicLink?.token && PUBLIC_BASE_URL
        ? `${PUBLIC_BASE_URL.replace(/\/$/, '')}/${publicLink.token}`
        : null

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 680px; margin: 0 auto;">
          <h2>${subject}</h2>
          <p>Dokument: <strong>${document.name}</strong>${document.number ? ` (${document.number})` : ''}</p>
          ${messageBody ? `<div style="white-space: pre-wrap; margin: 16px 0;">${messageBody}</div>` : ''}
          ${publicUrl ? `<p>Link do dokumentu: <a href="${publicUrl}">${publicUrl}</a></p>` : ''}
          ${attach_pdf ? `<p><em>attach_pdf=true zapisano w kolejce. W Preview/dev attachment nie jest jeszcze dołączany binarnie; należy użyć document.pdf_path w następnym kroku integracji.</em></p>` : ''}
        </div>
      `

      try {
        const resp = await fetch('https://api.postmarkapp.com/email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-Postmark-Server-Token': POSTMARK_API_KEY,
          },
          body: JSON.stringify({
            From: EMAIL_FROM,
            To: row.recipient_email,
            Subject: subject.trim(),
            HtmlBody: html,
            MessageStream: 'outbound',
          }),
        })

        const providerResult = await resp.json()
        if (!resp.ok || providerResult.ErrorCode) throw new Error(providerResult.Message || 'Failed to send email via Postmark')

        await supabase.from('document_emails').update({
          status: 'sent',
          provider: 'postmark',
          provider_message_id: providerResult.MessageID || null,
          sent_at: new Date().toISOString(),
          error_message: null,
        }).eq('id', row.id)

        results.push({ id: row.id, recipient_email: row.recipient_email, status: 'sent', provider_message_id: providerResult.MessageID || null })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown send error'
        await supabase.from('document_emails').update({ status: 'failed', error_message: message }).eq('id', row.id)
        results.push({ id: row.id, recipient_email: row.recipient_email, status: 'failed', error: message })
      }
    }

    await supabase.rpc('log_document_event', {
      p_document_id: document_id,
      p_action: 'email_queued',
      p_actor_type: 'user',
      p_actor_id: user.id,
      p_actor_name: [employee.first_name, employee.last_name].filter(Boolean).join(' ').trim() || null,
      p_metadata: {
        recipients: normalizedRecipients.map((r) => r.email),
        queued_count: normalizedRecipients.length,
        attach_pdf,
        include_public_link,
        public_link_token: publicLink?.token ?? null,
      },
      p_user_agent: req.headers.get('user-agent'),
    })

    return json(200, { success: true, queued: results, public_link_token: publicLink?.token ?? null })
  } catch (error) {
    console.error('send-document-email error:', error)
    return json(500, { error: error instanceof Error ? error.message : 'Unknown error' })
  }
})
