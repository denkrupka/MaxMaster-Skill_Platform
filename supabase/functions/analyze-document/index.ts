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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    
    const { data: doc } = await supabase.from('documents')
      .select('title, content, document_type, status')
      .eq('id', document_id).single()
    
    if (!doc) return new Response(JSON.stringify({ error: 'Document not found' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
    
    const prompts: Record<string, string> = {
      overview: `Przeanalizuj dokument "${doc.title}" typu ${doc.document_type}. Podaj krótki przegląd (3-5 zdań).`,
      risk: `Przeanalizuj ryzyka prawne i biznesowe dokumentu "${doc.title}". Wymień max 5 głównych ryzyk.`,
      summary: `Napisz streszczenie dokumentu "${doc.title}" w 2-3 zdaniach.`,
      clauses: `Sprawdź kluczowe klauzule w dokumencie "${doc.title}". Wymień ważne postanowienia.`,
    }
    
    const prompt = prompts[analysis_type] || prompts.overview
    const docContext = doc.content ? `\n\nTreść dokumentu:\n${String(doc.content).slice(0, 2000)}` : ''
    
    // Try OpenAI
    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    let result = ''
    
    if (openaiKey) {
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt + docContext }],
          max_tokens: 500,
        })
      })
      const data = await resp.json()
      result = data.choices?.[0]?.message?.content || 'Brak odpowiedzi'
    } else {
      result = `Analiza dokumentu "${doc.title}":\n\nTyp: ${doc.document_type}\nStatus: ${doc.status}\n\nAby korzystać z analizy AI, skonfiguruj klucz OPENAI_API_KEY w Supabase Secrets.`
    }
    
    // Save to document_ai_analyses
    await supabase.from('document_ai_analyses').upsert({
      document_id,
      analysis_type,
      result,
      created_at: new Date().toISOString(),
    }).catch(() => {})
    
    return new Response(JSON.stringify({ ok: true, result, analysis_type }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
