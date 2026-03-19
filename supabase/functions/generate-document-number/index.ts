// Edge Function: generate-document-number
// Contract:
// request: { template_type?: string, templateType?: string, project_id?: string, projectId?: string, year?: number }
// response: { success: true, number: string, document_number: string, prefix: string, year: number, last_number: number, template_type: string, project_id?: string|null }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  template_type?: string;
  templateType?: string;
  project_id?: string;
  projectId?: string;
  year?: number;
}

const TYPE_PREFIXES: Record<string, string> = {
  contract: 'CON',
  protocol: 'PRO',
  annex: 'ANX',
  other: 'DOC',
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
    const template_type = body.template_type ?? body.templateType ?? 'other';
    const project_id = body.project_id ?? body.projectId ?? null;
    const year = body.year ?? new Date().getFullYear();

    const { data: { user } } = await supabase.auth.getUser(
      req.headers.get('authorization')?.replace('Bearer ', '') ?? ''
    );
    if (!user) return json(401, { error: 'Unauthorized' });

    const { data: employee, error: employeeError } = await supabase
      .from('employees')
      .select('company_id')
      .eq('user_id', user.id)
      .single();

    if (employeeError || !employee?.company_id) return json(400, { error: 'Company not found' });

    const prefix = TYPE_PREFIXES[template_type] || 'DOC';

    const { data, error } = await supabase.rpc('generate_next_document_number', {
      p_company_id: employee.company_id,
      p_prefix: prefix,
      p_year: year,
    });

    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;
    const number = row?.document_number;
    const last_number = row?.last_number;

    if (!number) throw new Error('Failed to generate document number');

    return json(200, {
      success: true,
      number,
      document_number: number,
      prefix,
      year,
      last_number,
      template_type,
      project_id,
    });
  } catch (error) {
    console.error('Error generating document number:', error);
    return json(500, { error: error instanceof Error ? error.message : 'Unknown error' });
  }
});
