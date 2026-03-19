// Edge Function: log-document-event
// request: { document_id, action, metadata?, actor_type?, actor_name?, actor_email? }
// response: { success: true, log_id, document_id, action }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  document_id?: string;
  documentId?: string;
  action?: string;
  metadata?: Record<string, unknown>;
  actor_type?: string;
  actorType?: string;
  actor_name?: string;
  actorName?: string;
  actor_email?: string;
  actorEmail?: string;
}

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
    const action = body.action;
    if (!document_id || !action) return json(400, { error: 'document_id and action are required' });

    const { data: { user } } = await supabase.auth.getUser(req.headers.get('authorization')?.replace('Bearer ', '') ?? '');

    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('id')
      .eq('id', document_id)
      .single();
    if (docError || !document) return json(404, { error: 'Document not found' });

    let actorName = body.actor_name ?? body.actorName ?? null;
    if (user && !actorName) {
      const { data: employee } = await supabase
        .from('employees')
        .select('first_name, last_name')
        .eq('user_id', user.id)
        .single();
      actorName = employee ? [employee.first_name, employee.last_name].filter(Boolean).join(' ').trim() : null;
    }

    const { data: logId, error } = await supabase.rpc('log_document_event', {
      p_document_id: document_id,
      p_action: action,
      p_actor_type: body.actor_type ?? body.actorType ?? (user ? 'user' : 'system'),
      p_actor_id: user?.id ?? null,
      p_actor_name: actorName,
      p_actor_email: body.actor_email ?? body.actorEmail ?? null,
      p_metadata: body.metadata ?? {},
      p_ip_address: null,
      p_user_agent: req.headers.get('user-agent'),
    });
    if (error) throw error;

    return json(200, { success: true, log_id: logId, document_id, action });
  } catch (error) {
    console.error('Error logging event:', error);
    return json(500, { error: error instanceof Error ? error.message : 'Unknown error' });
  }
});
