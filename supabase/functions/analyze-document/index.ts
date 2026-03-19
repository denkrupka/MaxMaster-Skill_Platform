// Edge Function: analyze-document
// request: { document_id, analysis_type?, document_content?, template_name? }
// response: { result: { text }, id, analysis_id, document_id, analysis_type }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  document_id?: string;
  documentId?: string;
  analysis_type?: 'review' | 'risk' | 'summary' | 'clause_check';
  analysisType?: 'review' | 'risk' | 'summary' | 'clause_check';
  document_content?: Record<string, unknown>;
  documentContent?: Record<string, unknown>;
  template_name?: string;
  templateName?: string;
}

const ANALYSIS_PROMPTS: Record<string, string> = {
  review: `Przeanalizuj poniższy dokument budowlany i wskaż:\n1. Brakujące klauzule lub informacje\n2. Niejasne sformułowania\n3. Sugestie poprawy\n4. Zgodność ze standardami branżowymi`,
  risk: `Przeanalizuj poniższy dokument pod kątem ryzyk:\n1. Ryzyka prawne\n2. Ryzyka finansowe\n3. Ryzyka terminowe\n4. Zalecenia zabezpieczeń`,
  summary: `Przygotuj zwięzłe podsumowanie dokumentu:\n1. Główne punkty\n2. Kluczowe daty i kwoty\n3. Strony i ich obowiązki\n4. Najważniejsze terminy`,
  clause_check: `Sprawdź klauzule dokumentu:\n1. Zgodność z polskim prawem budowlanym\n2. Standardowe klauzule umowne\n3. Klauzule nietypowe lub ryzykowne\n4. Rekomendacje prawne`,
};

function json(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('authorization') ?? '' } } }
    );

    const body = await req.json() as RequestBody;
    const document_id = body.document_id ?? body.documentId;
    const analysis_type = body.analysis_type ?? body.analysisType ?? 'summary';

    if (!document_id) return json(400, { error: 'document_id is required' });

    const { data: { user } } = await supabase.auth.getUser(req.headers.get('authorization')?.replace('Bearer ', '') ?? '');
    if (!user) return json(401, { error: 'Unauthorized' });

    const { data: employee } = await supabase
      .from('employees')
      .select('company_id, first_name, last_name')
      .eq('user_id', user.id)
      .single();
    if (!employee?.company_id) return json(400, { error: 'Company not found' });

    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('id, company_id, name, data, document_templates(name)')
      .eq('id', document_id)
      .single();
    if (docError || !document) return json(404, { error: 'Document not found' });
    if (document.company_id !== employee.company_id) return json(403, { error: 'Forbidden' });

    const document_content = body.document_content ?? body.documentContent ?? (document.data as Record<string, unknown>) ?? {};
    const template_name = body.template_name ?? body.templateName ?? (document.document_templates as { name?: string } | null)?.name ?? document.name ?? 'Document';

    const basePrompt = ANALYSIS_PROMPTS[analysis_type] || ANALYSIS_PROMPTS.summary;
    const contentText = Object.entries(document_content).map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`).join('\n');
    const prompt = `${basePrompt}\n\nTyp dokumentu: ${template_name}\n\nZawartość:\n${contentText}`;

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    let analysisResult = '';
    let provider = 'fallback';

    if (geminiApiKey) {
      const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      });

      if (geminiResponse.ok) {
        const geminiData = await geminiResponse.json();
        analysisResult = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (analysisResult) provider = 'gemini';
      }
    }

    if (!analysisResult) {
      analysisResult = `Analiza dokumentu "${template_name}" (typ: ${analysis_type}):\n\nDokument zawiera ${Object.keys(document_content).length} pól.\n\nUwagi:\n- Dokument wymaga weryfikacji przez specjalistę\n- Zalecana jest kontrola prawna\n- Sprawdź zgodność z obowiązującymi przepisami`;
    }

    const { data: analysis, error: insertError } = await supabase
      .from('document_ai_analyses')
      .insert({
        document_id,
        company_id: employee.company_id,
        analysis_type,
        result: { text: analysisResult, prompt, provider },
        created_by: user.id,
      })
      .select('id')
      .single();
    if (insertError) throw insertError;

    await supabase.rpc('log_document_event', {
      p_document_id: document_id,
      p_action: 'analyzed',
      p_actor_type: 'user',
      p_actor_id: user.id,
      p_actor_name: [employee.first_name, employee.last_name].filter(Boolean).join(' ').trim() || null,
      p_metadata: { analysis_type, analysis_id: analysis.id, provider },
      p_user_agent: req.headers.get('user-agent'),
    });

    return json(200, { result: { text: analysisResult }, id: analysis.id, analysis_id: analysis.id, document_id, analysis_type });
  } catch (error) {
    console.error('Error analyzing document:', error);
    return json(500, { error: error instanceof Error ? error.message : 'Unknown error' });
  }
});
