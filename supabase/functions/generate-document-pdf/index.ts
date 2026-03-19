// Edge Function: generate-document-pdf
// Preview/dev contract only: renders HTML, returns data URL, stores future pdf_path placeholder.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  document_id?: string;
  documentId?: string;
}

function json(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function sanitizeData(data: Record<string, unknown>): Record<string, string> {
  const clean: Record<string, string> = {};
  for (const [key, value] of Object.entries(data ?? {})) {
    clean[key] = String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }
  return clean;
}

function renderTemplate(template: { content?: Array<{ title?: string; body?: string }> } | null, data: Record<string, unknown>): string {
  const safe = sanitizeData(data);
  const sections = Array.isArray(template?.content) ? template!.content! : [];

  if (sections.length === 0) {
    return `<pre style="white-space: pre-wrap; line-height: 1.6;">${safe['content'] ?? JSON.stringify(data ?? {}, null, 2)}</pre>`;
  }

  return sections.map((section) => {
    let body = section.body ?? '';
    for (const [key, value] of Object.entries(safe)) body = body.replaceAll(`{{${key}}}`, value);
    const title = section.title ? `<h2 style="color:#1e40af;margin-top:24px;margin-bottom:12px;font-size:18px;">${section.title}</h2>` : '';
    return `${title}\n<p style="line-height:1.6;margin-bottom:12px;">${body}</p>`;
  }).join('\n\n');
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
    if (!document_id) return json(400, { error: 'document_id is required' });

    const { data: { user } } = await supabase.auth.getUser(req.headers.get('authorization')?.replace('Bearer ', '') ?? '');
    if (!user) return json(401, { error: 'Unauthorized' });

    const { data: employee } = await supabase.from('employees').select('company_id, first_name, last_name').eq('user_id', user.id).single();
    if (!employee?.company_id) return json(400, { error: 'Company not found' });

    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('id, company_id, name, number, data, template_id, document_templates(*)')
      .eq('id', document_id)
      .single();

    if (docError || !document) return json(404, { error: 'Document not found' });
    if (document.company_id !== employee.company_id) return json(403, { error: 'Forbidden' });

    const htmlContent = renderTemplate(document.document_templates as { content?: Array<{ title?: string; body?: string }> } | null, (document.data as Record<string, unknown>) ?? {});
    const generatedAt = new Date().toLocaleString('pl-PL');
    const fullHtml = `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <title>${document.name}</title>
  <style>
    @page { margin: 2cm; }
    body { font-family: Arial, sans-serif; font-size: 12pt; line-height: 1.6; color: #333; }
    h1 { color: #1e40af; font-size: 24px; margin-bottom: 20px; }
    p { margin-bottom: 12px; text-align: justify; }
    .header { border-bottom: 2px solid #1e40af; padding-bottom: 10px; margin-bottom: 30px; }
    .footer { margin-top: 40px; padding-top: 10px; border-top: 1px solid #ccc; font-size: 10pt; color: #666; }
    .document-number { font-size: 10pt; color: #666; }
  </style>
</head>
<body>
  <div class="header">
    <div class="document-number">Nr dokumentu: ${document.number || '—'}</div>
    <h1>${document.name}</h1>
  </div>
  ${htmlContent}
  <div class="footer">Wygenerowano: ${generatedAt} | System MaxMaster</div>
</body>
</html>`;

    const url = `data:text/html;base64,${btoa(fullHtml)}`;
    const pdfPath = `${document.company_id}/${new Date().getFullYear()}/${document.id}.pdf`;

    const { error: updateError } = await supabase
      .from('documents')
      .update({ pdf_path: pdfPath })
      .eq('id', document_id);
    if (updateError) throw updateError;

    await supabase.rpc('log_document_event', {
      p_document_id: document_id,
      p_action: 'pdf_generated',
      p_actor_type: 'user',
      p_actor_id: user.id,
      p_actor_name: [employee.first_name, employee.last_name].filter(Boolean).join(' ').trim() || null,
      p_metadata: { pdf_path: pdfPath, mode: 'preview-html-data-url' },
      p_user_agent: req.headers.get('user-agent'),
    });

    return json(200, {
      success: true,
      mode: 'preview-html-data-url',
      url,
      pdf_url: url,
      path: pdfPath,
      pdf_path: pdfPath,
      document_id,
    });
  } catch (error) {
    console.error('Error generating PDF:', error);
    return json(500, { error: error instanceof Error ? error.message : 'Unknown error' });
  }
});
