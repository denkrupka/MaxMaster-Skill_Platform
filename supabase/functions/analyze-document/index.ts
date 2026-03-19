import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { document_id, analysis_type } = await req.json()
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { data: doc } = await supabase.from('documents')
      .select('title, content, document_type, status').eq('id', document_id).single()
    if (!doc) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const prompts: Record<string, string> = {
      overview: `Przeanalizuj dokument "${doc.title}" (typ: ${doc.document_type}). Podaj zwięzły przegląd w 3-5 zdaniach po polsku.`,
      risk: `Przeanalizuj ryzyka dokumentu "${doc.title}". Wymień max 5 głównych ryzyk prawnych i biznesowych po polsku.`,
      summary: `Napisz krótkie streszczenie dokumentu "${doc.title}" w 2-3 zdaniach po polsku.`,
      clauses: `Sprawdź kluczowe klauzule w dokumencie "${doc.title}". Wymień najważniejsze postanowienia po polsku.`,
    }
    const prompt = (prompts[analysis_type] || prompts.overview) + (doc.content ? `\n\nTreść:\n${String(doc.content).slice(0, 3000)}` : '')

    let result = ''

    // Try Gemini first
    const geminiKey = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GOOGLE_AI_API_KEY')
    // CLAUDE_API_KEY is the name used in Supabase Secrets (not ANTHROPIC_API_KEY)
    const claudeKey = Deno.env.get('CLAUDE_API_KEY') || Deno.env.get('ANTHROPIC_API_KEY')

    if (geminiKey) {
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 600 } })
      })
      const data = await resp.json()
      result = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    }

    // Fallback to Claude
    if (!result && claudeKey) {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': claudeKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-haiku-20240307', max_tokens: 600, messages: [{ role: 'user', content: prompt }] })
      })
      const data = await resp.json()
      result = data.content?.[0]?.text || ''
    }

    if (!result) result = `Brak klucza API (GEMINI_API_KEY lub CLAUDE_API_KEY) w Supabase Secrets.`

    return new Response(JSON.stringify({ ok: true, result, analysis_type }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
