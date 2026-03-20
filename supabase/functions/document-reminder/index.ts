import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const POSTMARK_KEY = Deno.env.get('POSTMARK_API_KEY') || Deno.env.get('POSTMARK_SERVER_TOKEN')
  const SMSAPI_TOKEN = Deno.env.get('SMSAPI_TOKEN')

  const sendEmail = async (to: string, subject: string, html: string) => {
    if (!POSTMARK_KEY || !to) return
    await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'X-Postmark-Server-Token': POSTMARK_KEY },
      body: JSON.stringify({ From: 'noreply@maxmaster.info', To: to, Subject: subject, HtmlBody: html })
    }).catch(() => {})
  }

  const sendSMS = async (phone: string, msg: string) => {
    if (!SMSAPI_TOKEN || !phone) return
    await fetch('https://api.smsapi.pl/sms.do', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${SMSAPI_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: phone, message: msg, from: 'MAXMASTER' })
    }).catch(() => {})
  }

  try {
    // Find all unsent documents that need reminders
    const now = new Date()

    // Get all pending signature_requests where no reminder was sent yet
    const { data: pendingRequests } = await supabase
      .from('signature_requests')
      .select('id, document_id, signer_email, signer_name, signer_phone, created_at, reminder_sent_at, documents(name, company_id)')
      .in('status', ['pending', 'sent'])
      .order('created_at', { ascending: true })

    let reminded = 0

    for (const req of (pendingRequests || [])) {
      const createdAt = new Date(req.created_at)
      const daysSince = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24))
      const lastReminder = req.reminder_sent_at ? new Date(req.reminder_sent_at) : null
      const daysSinceReminder = lastReminder ? Math.floor((now.getTime() - lastReminder.getTime()) / (1000 * 60 * 60 * 24)) : 999

      // Send if: 3 days and no reminder, or 7 days and reminder was >3 days ago
      const shouldRemind = (daysSince >= 3 && !req.reminder_sent_at) || (daysSince >= 7 && daysSinceReminder >= 3)
      if (!shouldRemind) continue

      const docName = (req.documents as any)?.name || 'dokument'
      const signLink = `https://denkrupka.github.io/maxmaster-preview/#/sign/${req.id}`

      if (req.signer_email) {
        await sendEmail(req.signer_email,
          `Przypomnienie: Dokument "${docName}" czeka na podpis`,
          `<p>Dzień dobry${req.signer_name ? ` ${req.signer_name}` : ''},</p>
           <p>Dokument <strong>${docName}</strong> czeka na Twój podpis od ${daysSince} dni.</p>
           <p><a href="${signLink}" style="background:#2563eb;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:8px;">Podpisz dokument</a></p>
           <p style="color:#9ca3af;font-size:12px;margin-top:16px;">Jeśli podpisałeś już ten dokument, zignoruj tę wiadomość.</p>`)
      }

      if (req.signer_phone) {
        await sendSMS(req.signer_phone, `Przypomnienie: Dokument "${docName.slice(0, 30)}" czeka na podpis. Kliknij: ${signLink}`)
      }

      // Update reminder_sent_at
      await supabase.from('signature_requests').update({ reminder_sent_at: now.toISOString() }).eq('id', req.id)
      reminded++
    }

    return new Response(JSON.stringify({ success: true, reminded }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
