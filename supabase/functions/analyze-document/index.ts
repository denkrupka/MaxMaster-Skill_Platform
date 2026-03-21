import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const body = await req.json()
    const { document_id, analysis_type, action, content: userContent, context } = body
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // Load document from DB if document_id provided
    let doc: any = null
    if (document_id) {
      const { data } = await supabase.from('documents')
        .select('name, data, status, parties, project_id, company_id')
        .eq('id', document_id).single()
      doc = data
    }

    const docTitle = context?.title || doc?.name || 'Dokument'
    const docContent = userContent || (doc?.data?.content ? String(doc.data.content).slice(0, 6000) : '')
    const docParties = context?.parties || doc?.parties || {}

    // Determine action type
    const effectiveAction = action || analysis_type || 'overview'
    const isGenerate = effectiveAction === 'generate' || effectiveAction === 'generate_contract' || effectiveAction === 'generuj'

    let prompt = ''
    let maxTokens = 800

    if (isGenerate) {
      // ── GENERATE FULL DOCUMENT ──
      maxTokens = 4000
      const partiesInfo = docParties.party1?.name || docParties.party2?.name
        ? `\nStrona 1 (Zamawiający): ${docParties.party1?.name || '{{nazwa_zamawiajacego}}'}, NIP: ${docParties.party1?.nip || '{{nip_zamawiajacego}}'}, adres: ${docParties.party1?.address || '{{adres_zamawiajacego}}'}\nStrona 2 (Wykonawca): ${docParties.party2?.name || '{{nazwa_wykonawcy}}'}, NIP: ${docParties.party2?.nip || '{{nip_wykonawcy}}'}, adres: ${docParties.party2?.address || '{{adres_wykonawcy}}'}`
        : ''

      prompt = `Jesteś ekspertem prawnym specjalizującym się w polskim prawie budowlanym i umowach cywilnych.
Na podstawie tytułu dokumentu "${docTitle}" i kontekstu firmy budowlanej w Polsce, wygeneruj KOMPLETNY GOTOWY tekst umowy w języku polskim.
${partiesInfo}
${userContent ? `\nDodatkowy kontekst od użytkownika:\n${userContent}\n` : ''}
WYMAGANIA:
- Pełny tekst umowy gotowy do podpisu
- Formatowanie HTML: użyj <h2> dla nagłówków, <p> dla paragrafów, <strong> dla pogrubień, <ol>/<li> dla list
- Paragrafy oznacz jako § 1, § 2 itd.
- Język: profesjonalny, prawniczy, po polsku
- Struktura: strony umowy → przedmiot → termin → wynagrodzenie → warunki płatności → obowiązki stron → odpowiedzialność i kary umowne → gwarancja → rozwiązanie umowy → postanowienia końcowe → podpisy
- Użyj placeholderów dla brakujących danych: {{nazwa_firmy}}, {{nip}}, {{adres}}, {{kwota_netto}}, {{kwota_brutto}}, {{data_rozpoczecia}}, {{data_zakonczenia}}, {{nr_umowy}}
- Dostosuj do polskiego prawa budowlanego (Prawo budowlane, Kodeks cywilny)
- Uwzględnij kary umowne (0.1-0.5% za dzień zwłoki), gwarancję (min. 36 miesięcy), protokół odbioru

WAŻNE: Zwróć TYLKO tekst umowy w HTML. Żadnej analizy, żadnych pytań, żadnych komentarzy, żadnych bloków kodu. Sam czysty HTML dokumentu.`
    } else {
      // ── ANALYSIS PROMPTS ──
      const prompts: Record<string, string> = {
        overview: `Przeanalizuj dokument "${docTitle}". Podaj zwięzły przegląd w 3-5 zdaniach po polsku. Wymień kluczowe elementy: strony, przedmiot, terminy, kwoty.`,
        risk: `Przeanalizuj ryzyka dokumentu "${docTitle}". Wymień max 5 głównych ryzyk prawnych i biznesowych po polsku. Dla każdego podaj: opis ryzyka, poziom (wysoki/średni/niski), rekomendację.`,
        summary: `Napisz krótkie streszczenie dokumentu "${docTitle}" w 2-3 zdaniach po polsku. Wymień najważniejsze ustalenia.`,
        clauses: `Sprawdź kluczowe klauzule w dokumencie "${docTitle}". Wymień najważniejsze postanowienia po polsku: terminy, kary, gwarancje, warunki płatności, rozwiązanie umowy.`,
        review: `Dokonaj przeglądu prawnego dokumentu "${docTitle}". Oceń kompletność, zgodność z prawem polskim, brakujące klauzule, potencjalne problemy.`,
        clause_check: `Sprawdź czy dokument "${docTitle}" zawiera wszystkie wymagane klauzule dla umowy budowlanej w Polsce: kary umowne, gwarancja, ubezpieczenie OC, protokół odbioru, harmonogram, warunki płatności.`,
      }
      prompt = (prompts[effectiveAction] || prompts.overview)
      if (docContent) prompt += `\n\nTreść dokumentu:\n${docContent}`
    }

    let result = ''

    // Try Gemini first
    const geminiKey = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GOOGLE_AI_API_KEY')
    const claudeKey = Deno.env.get('CLAUDE_API_KEY') || Deno.env.get('ANTHROPIC_API_KEY')

    if (geminiKey) {
      const model = isGenerate ? 'gemini-1.5-pro' : 'gemini-1.5-flash'
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: maxTokens } })
      })
      const data = await resp.json()
      result = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    }

    // Fallback to Claude
    if (!result && claudeKey) {
      const model = isGenerate ? 'claude-sonnet-4-20250514' : 'claude-haiku-20240307'
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': claudeKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] })
      })
      const data = await resp.json()
      result = data.content?.[0]?.text || ''
    }

    if (!result) result = 'Brak klucza API (GEMINI_API_KEY lub CLAUDE_API_KEY) w Supabase Secrets.'

    // For generate action, clean up markdown code fences if present
    if (isGenerate) {
      result = result.replace(/^```html?\n?/i, '').replace(/\n?```$/i, '').trim()
    }

    return new Response(JSON.stringify({ ok: true, result, analysis_type: effectiveAction }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
