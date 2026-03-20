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
    const { image_base64, image_url, document_type } = body

    const CLAUDE_KEY = Deno.env.get('CLAUDE_API_KEY') || Deno.env.get('ANTHROPIC_API_KEY')
    const GEMINI_KEY = Deno.env.get('GEMINI_API_KEY')

    const extractionPrompt = `Przeanalizuj ten dokument i wyciągnij z niego dane strukturalne.
Zwróć JSON z polami:
{
  "document_type": "faktura|umowa|protokol|kosztorys|inne",
  "title": "tytuł dokumentu",
  "date": "data w formacie YYYY-MM-DD",
  "company1": {
    "name": "",
    "nip": "",
    "address": "",
    "email": "",
    "phone": ""
  },
  "company2": {
    "name": "",
    "nip": "",
    "address": "",
    "email": "",
    "phone": ""
  },
  "amount": 0,
  "currency": "PLN",
  "invoice_number": "",
  "items": [{"name": "", "qty": 0, "unit": "", "price": 0, "total": 0}],
  "payment_date": "",
  "notes": "",
  "full_text": "pełny tekst dokumentu"
}
Zwróć TYLKO JSON bez żadnych komentarzy.`

    let result: any = null

    // Try Claude with vision
    if (CLAUDE_KEY && (image_base64 || image_url)) {
      const imageContent = image_base64
        ? { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image_base64 } }
        : { type: 'image', source: { type: 'url', url: image_url } }

      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': CLAUDE_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 2000,
          messages: [{ role: 'user', content: [imageContent, { type: 'text', text: extractionPrompt }] }]
        })
      })
      const d = await r.json()
      const text = d.content?.[0]?.text || ''
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/)
        if (jsonMatch) result = JSON.parse(jsonMatch[0])
      } catch {}
    }

    // Fallback to Gemini vision
    if (!result && GEMINI_KEY && (image_base64 || image_url)) {
      const parts: any[] = [{ text: extractionPrompt }]
      if (image_base64) parts.unshift({ inlineData: { mimeType: 'image/jpeg', data: image_base64 } })
      else if (image_url) parts.unshift({ fileData: { mimeType: 'image/jpeg', fileUri: image_url } })

      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts }] })
      })
      const d = await r.json()
      const text = d.candidates?.[0]?.content?.parts?.[0]?.text || ''
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/)
        if (jsonMatch) result = JSON.parse(jsonMatch[0])
      } catch {}
    }

    if (!result) throw new Error('Nie można przetworzyć dokumentu')

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
