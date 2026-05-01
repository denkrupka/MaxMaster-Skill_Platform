import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || '';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

const FORMAT_INSTRUCTION = '\n\nOdpowiedz po polsku. Formatuj odpowiedź czytelnie: używaj numeracji (1., 2.), myślników dla punktów, pogrubienia dla nagłówków sekcji. NIE używaj znaków markdown takich jak #, *, ```. Pisz czystym tekstem z numeracją i wcięciami.';

const PROMPTS: Record<string, (content: string, template: string) => string> = {
  review: (c, t) => `Przeanalizuj dokument typu "${t}" pod kątem kompletności, poprawności i potencjalnych problemów.\n\nTreść dokumentu:\n${c}${FORMAT_INSTRUCTION}\n\nPodaj:\n1) Ogólna ocena (1-10)\n2) Brakujące elementy\n3) Potencjalne problemy\n4) Rekomendacje`,
  risk: (c, t) => `Przeanalizuj ryzyka prawne i finansowe w dokumencie typu "${t}":\n\n${c}${FORMAT_INSTRUCTION}\n\nPodaj:\n1) Ryzyka prawne\n2) Ryzyka finansowe\n3) Brakujące zabezpieczenia\n4) Rekomendacje zmian`,
  summary: (c, t) => `Napisz zwięzłe podsumowanie dokumentu typu "${t}":\n\n${c}${FORMAT_INSTRUCTION}\n\nMaksymalnie 5 zdań.`,
  suggestion: (c, t) => `Zaproponuj ulepszenia dokumentu typu "${t}":\n\n${c}${FORMAT_INSTRUCTION}\n\nPodaj konkretne sugestie zmian tekstu.`,
  clause_check: (c, t) => `Sprawdź klauzule dokumentu typu "${t}" pod kątem zgodności z polskim prawem budowlanym:\n\n${c}${FORMAT_INSTRUCTION}\n\nPodaj:\n1) Klauzule OK\n2) Klauzule problematyczne\n3) Brakujące klauzule obowiązkowe`,
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { document_id, company_id, analysis_type, document_content, template_name } = await req.json();
    if (!document_id || !analysis_type || !document_content) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const promptFn = PROMPTS[analysis_type];
    if (!promptFn) return new Response(JSON.stringify({ error: 'Unknown analysis type' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const contentStr = typeof document_content === 'string' ? document_content : JSON.stringify(document_content, null, 2);
    const prompt = promptFn(contentStr, template_name || 'dokument');

    // Вызов Gemini API
    const geminiRes = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 4096 }
      })
    });

    if (!geminiRes.ok) throw new Error(`Gemini API error: ${geminiRes.status}`);
    const geminiData = await geminiRes.json();
    const resultText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || 'Brak odpowiedzi';
    const tokensUsed = geminiData.usageMetadata?.totalTokenCount || 0;

    // Сохраняем результат
    const adminClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: analysis, error: insertErr } = await adminClient.from('document_ai_analyses').insert({
      company_id, document_id, analysis_type,
      prompt, result: { text: resultText, raw: geminiData },
      model: 'gemini-2.0-flash', tokens_used: tokensUsed, created_by: user.id
    }).select('id').single();

    if (insertErr) throw insertErr;

    return new Response(JSON.stringify({ id: analysis.id, result: { text: resultText, tokens_used: tokensUsed } }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
