import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const CONTRACT_PROMPTS: Record<string, string> = {
  umowa_o_roboty: 'umowy o roboty budowlane zgodnie z polskim prawem budowlanym',
  umowa_zlecenie: 'umowy zlecenia zgodnie z Kodeksem Cywilnym (art. 734-751)',
  umowa_o_dzielo: 'umowy o dzieło zgodnie z Kodeksem Cywilnym (art. 627-646)',
  umowa_najmu: 'umowy najmu zgodnie z Kodeksem Cywilnym',
  protokol_odbioru: 'protokołu odbioru robót budowlanych',
  aneks: 'aneksu do umowy',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { contractType, description, party1, party2, amount, deadline } = await req.json()

    const CLAUDE_KEY = Deno.env.get('CLAUDE_API_KEY') || Deno.env.get('ANTHROPIC_API_KEY')
    const GEMINI_KEY = Deno.env.get('GEMINI_API_KEY')

    const today = new Date().toLocaleDateString('pl-PL')
    const amountText = amount ? `Wartość wynagrodzenia: ${Number(amount).toLocaleString('pl-PL')} PLN netto` : ''
    const deadlineText = deadline ? `Termin realizacji: ${new Date(deadline).toLocaleDateString('pl-PL')}` : ''

    const prompt = `Napisz profesjonalną treść ${CONTRACT_PROMPTS[contractType] || 'umowy'} w języku polskim.

Zakres/opis: ${description}
${party1?.name ? `Zamawiający: ${party1.name}${party1.nip ? ` (NIP: ${party1.nip})` : ''}` : ''}
${party2?.name ? `Wykonawca: ${party2.name}` : ''}
${amountText}
${deadlineText}
Data: ${today}

Wymagania:
- Pełna treść umowy gotowa do podpisania
- Wszystkie standardowe paragrafy dla tego typu umowy
- Zgodność z polskim prawem
- Format HTML z nagłówkami <h2>, paragrafami <p>, listami <ul> gdzie potrzeba
- Miejsca na podpisy na końcu
- Nie używaj placeholderów — wpisz rzeczywiste dane z powyższego kontekstu
- Długość: 800-1500 słów`

    let content = ''

    // Try Claude first
    if (CLAUDE_KEY) {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': CLAUDE_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 3000,
          messages: [{ role: 'user', content: prompt }]
        })
      })
      const d = await r.json()
      content = d.content?.[0]?.text || ''
    }

    // Fallback to Gemini
    if (!content && GEMINI_KEY) {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      })
      const d = await r.json()
      content = d.candidates?.[0]?.content?.parts?.[0]?.text || ''
    }

    if (!content) throw new Error('AI nie odpowiedział')

    // Save to documents table
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // Get company_id from JWT
    const authHeader = req.headers.get('Authorization')
    let company_id = null
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '')
      const { data: { user } } = await supabase.auth.getUser(token)
      if (user) {
        const { data: profile } = await supabase.from('user_profiles').select('company_id').eq('user_id', user.id).single()
        company_id = profile?.company_id
      }
    }

    const docName = `${CONTRACT_PROMPTS[contractType]?.split(' ')[0] || 'Dokument'} — ${party2?.name || party1?.name || 'szkic'} — ${today}`

    const { data: doc, error: docErr } = await supabase.from('documents').insert({
      name: docName,
      content,
      status: 'draft',
      company_id,
      created_at: new Date().toISOString(),
      parties: { party1, party2 },
    }).select('id').single()

    if (docErr) throw docErr

    return new Response(JSON.stringify({ document_id: doc.id, name: docName }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
