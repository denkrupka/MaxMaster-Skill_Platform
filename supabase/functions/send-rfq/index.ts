import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { rfq_id, token, contractor_email, contractor_name, title, description, deadline, items } = await req.json()
    const POSTMARK_KEY = Deno.env.get('POSTMARK_API_KEY') || Deno.env.get('POSTMARK_SERVER_TOKEN')
    if (!POSTMARK_KEY) throw new Error('No email key')

    const rfqLink = `https://denkrupka.github.io/maxmaster-preview/#/rfq/respond/${token}`
    const deadlineText = deadline ? `Termin składania ofert: <strong>${new Date(deadline).toLocaleDateString('pl-PL')}</strong><br/>` : ''
    const itemsHtml = items?.length ? `
      <p><strong>Pozycje do wyceny:</strong></p>
      <table style="width:100%;border-collapse:collapse;">
        <tr style="background:#f3f4f6;"><th style="padding:6px;text-align:left;font-size:12px;">Nazwa</th><th style="padding:6px;font-size:12px;">Ilość</th><th style="padding:6px;font-size:12px;">Jedn.</th></tr>
        ${items.map((i: any) => `<tr><td style="padding:6px;border-bottom:1px solid #e5e7eb;font-size:12px;">${i.name}</td><td style="padding:6px;border-bottom:1px solid #e5e7eb;font-size:12px;text-align:center;">${i.qty}</td><td style="padding:6px;border-bottom:1px solid #e5e7eb;font-size:12px;text-align:center;">${i.unit}</td></tr>`).join('')}
      </table>` : ''

    await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'X-Postmark-Server-Token': POSTMARK_KEY },
      body: JSON.stringify({
        From: 'noreply@maxmaster.info',
        To: contractor_email,
        Subject: `Zapytanie ofertowe: ${title}`,
        HtmlBody: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
            <h2 style="color:#1d4ed8;">Zapytanie ofertowe</h2>
            <p>Dzień dobry${contractor_name ? ` ${contractor_name}` : ''},</p>
            <p>Zapraszamy do złożenia oferty na: <strong>${title}</strong></p>
            ${description ? `<p>${description}</p>` : ''}
            ${deadlineText}
            ${itemsHtml}
            <p style="margin-top:24px;">
              <a href="${rfqLink}" style="background:#2563eb;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">
                Złóż ofertę
              </a>
            </p>
            <p style="color:#9ca3af;font-size:12px;margin-top:16px;">MaxMaster · System zarządzania budową</p>
          </div>`
      })
    })

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
