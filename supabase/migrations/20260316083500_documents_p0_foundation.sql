-- Documents P0 foundation: compatibility + runtime contracts + email/audit/AI foundation

-- =====================================================
-- 1. Compatibility alias for legacy/wrong app queries
--    App currently queries `contractor_clients`, but real table is
--    `contractors_clients`. Create a read-only compatibility view.
-- =====================================================
CREATE OR REPLACE VIEW contractor_clients
WITH (security_invoker = true) AS
SELECT * FROM contractors_clients;

GRANT SELECT ON contractor_clients TO authenticated;
GRANT SELECT ON contractor_clients TO anon;

-- =====================================================
-- 2. Atomic numbering RPC used by edge function generate-document-number
-- =====================================================
CREATE OR REPLACE FUNCTION generate_next_document_number(
  p_company_id UUID,
  p_prefix TEXT,
  p_year INTEGER
) RETURNS TABLE(last_number INTEGER, document_number TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_number INTEGER;
BEGIN
  INSERT INTO document_numbering (company_id, prefix, year, last_number)
  VALUES (p_company_id, p_prefix, p_year, 1)
  ON CONFLICT (company_id, prefix, year)
  DO UPDATE SET
    last_number = document_numbering.last_number + 1,
    updated_at = now()
  RETURNING document_numbering.last_number INTO v_last_number;

  RETURN QUERY
  SELECT
    v_last_number,
    p_prefix || '/' || p_year::TEXT || '/' || LPAD(v_last_number::TEXT, 3, '0');
END;
$$;

-- =====================================================
-- 3. Audit logging RPC used by edge functions
-- =====================================================
CREATE OR REPLACE FUNCTION log_document_event(
  p_document_id UUID,
  p_action TEXT,
  p_actor_type TEXT DEFAULT 'user',
  p_actor_id UUID DEFAULT NULL,
  p_actor_name TEXT DEFAULT NULL,
  p_actor_email TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
  v_log_id UUID;
BEGIN
  SELECT company_id INTO v_company_id
  FROM documents
  WHERE id = p_document_id;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'document not found: %', p_document_id;
  END IF;

  INSERT INTO document_audit_log (
    company_id,
    document_id,
    action,
    actor_type,
    actor_id,
    actor_name,
    actor_email,
    metadata,
    ip_address,
    user_agent
  ) VALUES (
    v_company_id,
    p_document_id,
    p_action,
    p_actor_type,
    p_actor_id,
    p_actor_name,
    p_actor_email,
    COALESCE(p_metadata, '{}'::jsonb),
    p_ip_address,
    p_user_agent
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

CREATE OR REPLACE FUNCTION prevent_document_audit_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'document_audit_log is append-only: % not allowed', TG_OP;
END;
$$;

DROP TRIGGER IF EXISTS document_audit_no_update ON document_audit_log;
CREATE TRIGGER document_audit_no_update
  BEFORE UPDATE ON document_audit_log
  FOR EACH ROW EXECUTE FUNCTION prevent_document_audit_modification();

DROP TRIGGER IF EXISTS document_audit_no_delete ON document_audit_log;
CREATE TRIGGER document_audit_no_delete
  BEFORE DELETE ON document_audit_log
  FOR EACH ROW EXECUTE FUNCTION prevent_document_audit_modification();

-- =====================================================
-- 4. AI analyses foundation used by edge function analyze-document
-- =====================================================
CREATE TABLE IF NOT EXISTS document_ai_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  analysis_type TEXT NOT NULL,
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_ai_analyses_company_id
  ON document_ai_analyses(company_id);
CREATE INDEX IF NOT EXISTS idx_document_ai_analyses_document_id
  ON document_ai_analyses(document_id, created_at DESC);

ALTER TABLE document_ai_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "document_ai_analyses_select" ON document_ai_analyses;
CREATE POLICY "document_ai_analyses_select" ON document_ai_analyses
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM employees WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "document_ai_analyses_insert" ON document_ai_analyses;
CREATE POLICY "document_ai_analyses_insert" ON document_ai_analyses
  FOR INSERT WITH CHECK (
    company_id IN (
      SELECT company_id FROM employees WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- 5. Email sending foundation
-- =====================================================
CREATE TABLE IF NOT EXISTS document_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  subject TEXT NOT NULL,
  body TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (
    status IN ('queued', 'sending', 'sent', 'delivered', 'failed', 'cancelled')
  ),
  attach_pdf BOOLEAN NOT NULL DEFAULT false,
  include_public_link BOOLEAN NOT NULL DEFAULT false,
  provider TEXT,
  provider_message_id TEXT,
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_emails_company_id
  ON document_emails(company_id);
CREATE INDEX IF NOT EXISTS idx_document_emails_document_id
  ON document_emails(document_id);
CREATE INDEX IF NOT EXISTS idx_document_emails_status
  ON document_emails(status);
CREATE INDEX IF NOT EXISTS idx_document_emails_created_at
  ON document_emails(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_document_emails_queue
  ON document_emails(status, created_at)
  WHERE status IN ('queued', 'failed');

ALTER TABLE document_emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "document_emails_select" ON document_emails;
CREATE POLICY "document_emails_select" ON document_emails
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM employees WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "document_emails_insert" ON document_emails;
CREATE POLICY "document_emails_insert" ON document_emails
  FOR INSERT WITH CHECK (
    company_id IN (
      SELECT company_id FROM employees WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "document_emails_update" ON document_emails;
CREATE POLICY "document_emails_update" ON document_emails
  FOR UPDATE USING (
    company_id IN (
      SELECT company_id FROM employees WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM employees WHERE user_id = auth.uid()
    )
  );

-- No DELETE policy on purpose: keep email/audit trail append-mostly.

DROP TRIGGER IF EXISTS update_document_emails_updated_at ON document_emails;
CREATE TRIGGER update_document_emails_updated_at
  BEFORE UPDATE ON document_emails
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
