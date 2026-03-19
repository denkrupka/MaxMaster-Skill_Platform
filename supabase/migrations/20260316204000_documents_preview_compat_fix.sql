-- Preview/dev compatibility fix for Documents + Signing
-- Purpose:
-- 1) make PostgREST-visible schema compatible with already shipped UI
-- 2) fix document_templates.type mismatch
-- 3) expose contractor_clients compatibility layer reliably
-- 4) align signature_requests contract around canonical signing_token
-- 5) add secure backend foundation for external signing by token

-- -----------------------------------------------------
-- 0. Prereqs / helper enum values
-- -----------------------------------------------------
DO $$ BEGIN
  CREATE TYPE document_template_type AS ENUM ('contract', 'protocol', 'annex', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Some preview UI still uses `viewed`; DB contract uses `opened`.
-- Keep canonical lifecycle in DB while allowing compatibility aliases.

-- -----------------------------------------------------
-- 1. Core tables: create if missing, then patch if existing
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS document_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type document_template_type NOT NULL DEFAULT 'other',
  description TEXT,
  content JSONB NOT NULL DEFAULT '[]'::jsonb,
  variables JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE document_templates
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS content JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS variables JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'document_templates'
      AND column_name = 'type'
  ) THEN
    BEGIN
      ALTER TABLE document_templates
        ALTER COLUMN type TYPE document_template_type
        USING CASE
          WHEN type::text IN ('contract', 'protocol', 'annex', 'other') THEN type::text::document_template_type
          ELSE 'other'::document_template_type
        END;
    EXCEPTION WHEN others THEN
      -- Leave type as-is if it is already compatible or contains legacy values that cannot be cast in one step.
      NULL;
    END;
  ELSE
    ALTER TABLE document_templates
      ADD COLUMN type document_template_type NOT NULL DEFAULT 'other';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_document_templates_company_id ON document_templates(company_id);

-- -----------------------------------------------------
-- 2. Contractor compatibility layer for PostgREST schema cache
-- -----------------------------------------------------
CREATE OR REPLACE VIEW contractor_clients
WITH (security_invoker = true) AS
SELECT * FROM contractors_clients;

GRANT SELECT ON contractor_clients TO authenticated;
GRANT SELECT ON contractor_clients TO anon;

-- -----------------------------------------------------
-- 3. Documents / supporting tables required by preview DMS
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES document_templates(id) ON DELETE RESTRICT,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  contractor_id UUID REFERENCES contractors_clients(id) ON DELETE SET NULL,
  number TEXT,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  pdf_path TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_version INTEGER NOT NULL DEFAULT 1,
  approval_status TEXT DEFAULT 'none'
);

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES document_templates(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contractor_id UUID REFERENCES contractors_clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS number TEXT,
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS data JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS pdf_path TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS current_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'none';

CREATE INDEX IF NOT EXISTS idx_documents_company_id ON documents(company_id);
CREATE INDEX IF NOT EXISTS idx_documents_template_id ON documents(template_id);
CREATE INDEX IF NOT EXISTS idx_documents_project_id ON documents(project_id);
CREATE INDEX IF NOT EXISTS idx_documents_contractor_id ON documents(contractor_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);

CREATE TABLE IF NOT EXISTS document_numbering (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  prefix TEXT NOT NULL,
  year INTEGER NOT NULL,
  last_number INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, prefix, year)
);

CREATE TABLE IF NOT EXISTS document_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  actor_type TEXT NOT NULL DEFAULT 'user',
  actor_id UUID,
  actor_name TEXT,
  actor_email TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  pdf_path TEXT,
  change_summary TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(document_id, version_number)
);

CREATE TABLE IF NOT EXISTS document_public_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  token UUID NOT NULL DEFAULT gen_random_uuid(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  max_views INTEGER,
  view_count INTEGER NOT NULL DEFAULT 0,
  pin_hash TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(token)
);

CREATE TABLE IF NOT EXISTS document_ai_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  analysis_type TEXT NOT NULL,
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS document_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  subject TEXT NOT NULL,
  body TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sending', 'sent', 'delivered', 'failed', 'cancelled')),
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

-- -----------------------------------------------------
-- 4. signature_requests: canonical signing_token + compatibility fields
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS signature_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  signer_name TEXT NOT NULL,
  signer_email TEXT NOT NULL,
  signer_role TEXT,
  recipient_name TEXT,
  recipient_email TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'opened', 'viewed', 'signed', 'declined', 'expired', 'cancelled')),
  signing_token UUID NOT NULL DEFAULT gen_random_uuid(),
  token UUID,
  pin_hash TEXT,
  expires_at TIMESTAMPTZ,
  last_opened_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  decline_reason TEXT,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(signing_token),
  UNIQUE(token)
);

ALTER TABLE signature_requests
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS signer_name TEXT,
  ADD COLUMN IF NOT EXISTS signer_email TEXT,
  ADD COLUMN IF NOT EXISTS signer_role TEXT,
  ADD COLUMN IF NOT EXISTS recipient_name TEXT,
  ADD COLUMN IF NOT EXISTS recipient_email TEXT,
  ADD COLUMN IF NOT EXISTS message TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS signing_token UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS token UUID,
  ADD COLUMN IF NOT EXISTS pin_hash TEXT,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_opened_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS declined_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS decline_reason TEXT,
  ADD COLUMN IF NOT EXISTS ip_address INET,
  ADD COLUMN IF NOT EXISTS user_agent TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE signature_requests
SET
  recipient_name = COALESCE(NULLIF(trim(recipient_name), ''), signer_name),
  recipient_email = COALESCE(NULLIF(trim(recipient_email), ''), signer_email)
WHERE recipient_name IS NULL OR recipient_email IS NULL;

UPDATE signature_requests
SET token = signing_token
WHERE token IS NULL;

UPDATE signature_requests
SET signing_token = token
WHERE signing_token IS NULL
  AND token IS NOT NULL;

UPDATE signature_requests
SET status = 'opened'
WHERE status = 'viewed';

UPDATE signature_requests
SET viewed_at = COALESCE(viewed_at, last_opened_at)
WHERE viewed_at IS NULL
  AND last_opened_at IS NOT NULL;

UPDATE signature_requests
SET last_opened_at = COALESCE(last_opened_at, viewed_at)
WHERE last_opened_at IS NULL
  AND viewed_at IS NOT NULL;

UPDATE signature_requests
SET completed_at = COALESCE(completed_at, signed_at, declined_at)
WHERE completed_at IS NULL
  AND (signed_at IS NOT NULL OR declined_at IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_signature_requests_document_id ON signature_requests(document_id);
CREATE INDEX IF NOT EXISTS idx_signature_requests_signing_token ON signature_requests(signing_token);
CREATE INDEX IF NOT EXISTS idx_signature_requests_status ON signature_requests(status);

DO $$ BEGIN
  ALTER TABLE signature_requests
    ADD CONSTRAINT signature_requests_signing_token_key UNIQUE (signing_token);
EXCEPTION WHEN duplicate_table THEN NULL;
WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE signature_requests
    ADD CONSTRAINT signature_requests_token_key UNIQUE (token);
EXCEPTION WHEN duplicate_table THEN NULL;
WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION sync_signature_request_compat_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.signer_name := COALESCE(NULLIF(trim(NEW.signer_name), ''), NULLIF(trim(NEW.recipient_name), ''));
  NEW.signer_email := COALESCE(NULLIF(trim(NEW.signer_email), ''), NULLIF(trim(NEW.recipient_email), ''));
  NEW.recipient_name := COALESCE(NULLIF(trim(NEW.recipient_name), ''), NEW.signer_name);
  NEW.recipient_email := COALESCE(NULLIF(trim(NEW.recipient_email), ''), NEW.signer_email);

  NEW.signing_token := COALESCE(NEW.signing_token, NEW.token, gen_random_uuid());
  NEW.token := COALESCE(NEW.token, NEW.signing_token);

  IF NEW.status = 'viewed' THEN
    NEW.status := 'opened';
  END IF;

  IF NEW.last_opened_at IS NULL AND NEW.viewed_at IS NOT NULL THEN
    NEW.last_opened_at := NEW.viewed_at;
  END IF;

  IF NEW.viewed_at IS NULL AND NEW.last_opened_at IS NOT NULL THEN
    NEW.viewed_at := NEW.last_opened_at;
  END IF;

  IF NEW.status = 'opened' AND NEW.last_opened_at IS NULL THEN
    NEW.last_opened_at := now();
    NEW.viewed_at := COALESCE(NEW.viewed_at, NEW.last_opened_at);
  END IF;

  IF NEW.status IN ('signed', 'declined', 'expired', 'cancelled') THEN
    NEW.completed_at := COALESCE(NEW.completed_at, NEW.signed_at, NEW.declined_at, now());
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS signature_requests_sync_compat_fields ON signature_requests;
CREATE TRIGGER signature_requests_sync_compat_fields
  BEFORE INSERT OR UPDATE ON signature_requests
  FOR EACH ROW EXECUTE FUNCTION sync_signature_request_compat_fields();

-- -----------------------------------------------------
-- 5. Secure backend foundation for external sign flow
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION get_signature_request_by_token(p_signing_token UUID)
RETURNS TABLE (
  id UUID,
  company_id UUID,
  document_id UUID,
  signer_name TEXT,
  signer_email TEXT,
  recipient_name TEXT,
  recipient_email TEXT,
  status TEXT,
  signing_token UUID,
  token UUID,
  expires_at TIMESTAMPTZ,
  last_opened_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  decline_reason TEXT,
  message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    sr.id,
    sr.company_id,
    sr.document_id,
    sr.signer_name,
    sr.signer_email,
    sr.recipient_name,
    sr.recipient_email,
    sr.status,
    sr.signing_token,
    sr.token,
    sr.expires_at,
    sr.last_opened_at,
    sr.viewed_at,
    sr.signed_at,
    sr.declined_at,
    sr.completed_at,
    sr.decline_reason,
    sr.message,
    sr.metadata,
    sr.created_at
  FROM signature_requests sr
  WHERE sr.signing_token = p_signing_token
    AND sr.status IN ('pending', 'opened', 'signed', 'declined', 'expired', 'cancelled')
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION mark_signature_request_opened_by_token(p_signing_token UUID)
RETURNS TABLE (
  id UUID,
  status TEXT,
  last_opened_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE signature_requests sr
  SET
    status = CASE WHEN sr.status = 'pending' THEN 'opened' ELSE sr.status END,
    last_opened_at = COALESCE(sr.last_opened_at, now()),
    viewed_at = COALESCE(sr.viewed_at, now())
  WHERE sr.signing_token = p_signing_token
    AND sr.status IN ('pending', 'opened')
    AND (sr.expires_at IS NULL OR sr.expires_at > now())
  RETURNING sr.id, sr.status, sr.last_opened_at, sr.viewed_at;
END;
$$;

REVOKE ALL ON FUNCTION get_signature_request_by_token(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION mark_signature_request_opened_by_token(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_signature_request_by_token(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION mark_signature_request_opened_by_token(UUID) TO anon, authenticated, service_role;

-- -----------------------------------------------------
-- 6. RLS / triggers / helper functions
-- -----------------------------------------------------
ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_numbering ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_public_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_ai_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE signature_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "document_templates_company_access" ON document_templates;
CREATE POLICY "document_templates_company_access" ON document_templates
  FOR ALL USING (company_id IN (SELECT company_id FROM employees WHERE user_id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM employees WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "documents_company_access" ON documents;
CREATE POLICY "documents_company_access" ON documents
  FOR ALL USING (company_id IN (SELECT company_id FROM employees WHERE user_id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM employees WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "document_numbering_company_access" ON document_numbering;
CREATE POLICY "document_numbering_company_access" ON document_numbering
  FOR ALL USING (company_id IN (SELECT company_id FROM employees WHERE user_id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM employees WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "document_audit_log_company_select" ON document_audit_log;
CREATE POLICY "document_audit_log_company_select" ON document_audit_log
  FOR SELECT USING (company_id IN (SELECT company_id FROM employees WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "document_versions_company_access" ON document_versions;
CREATE POLICY "document_versions_company_access" ON document_versions
  FOR ALL USING (company_id IN (SELECT company_id FROM employees WHERE user_id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM employees WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "document_public_links_company_access" ON document_public_links;
CREATE POLICY "document_public_links_company_access" ON document_public_links
  FOR ALL USING (company_id IN (SELECT company_id FROM employees WHERE user_id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM employees WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "document_ai_analyses_select" ON document_ai_analyses;
CREATE POLICY "document_ai_analyses_select" ON document_ai_analyses
  FOR SELECT USING (company_id IN (SELECT company_id FROM employees WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "document_ai_analyses_insert" ON document_ai_analyses;
CREATE POLICY "document_ai_analyses_insert" ON document_ai_analyses
  FOR INSERT WITH CHECK (company_id IN (SELECT company_id FROM employees WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "document_emails_select" ON document_emails;
CREATE POLICY "document_emails_select" ON document_emails
  FOR SELECT USING (company_id IN (SELECT company_id FROM employees WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "document_emails_insert" ON document_emails;
CREATE POLICY "document_emails_insert" ON document_emails
  FOR INSERT WITH CHECK (company_id IN (SELECT company_id FROM employees WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "document_emails_update" ON document_emails;
CREATE POLICY "document_emails_update" ON document_emails
  FOR UPDATE USING (company_id IN (SELECT company_id FROM employees WHERE user_id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM employees WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "signature_requests_company_access" ON signature_requests;
CREATE POLICY "signature_requests_company_access" ON signature_requests
  FOR ALL USING (company_id IN (SELECT company_id FROM employees WHERE user_id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM employees WHERE user_id = auth.uid()));

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
  SELECT v_last_number, p_prefix || '/' || p_year::TEXT || '/' || LPAD(v_last_number::TEXT, 3, '0');
END;
$$;

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

DROP TRIGGER IF EXISTS update_document_templates_updated_at ON document_templates;
CREATE TRIGGER update_document_templates_updated_at
  BEFORE UPDATE ON document_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_documents_updated_at ON documents;
CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_document_numbering_updated_at ON document_numbering;
CREATE TRIGGER update_document_numbering_updated_at
  BEFORE UPDATE ON document_numbering
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_document_emails_updated_at ON document_emails;
CREATE TRIGGER update_document_emails_updated_at
  BEFORE UPDATE ON document_emails
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------
-- 7. Make PostgREST pick up compatibility objects after apply
-- -----------------------------------------------------
NOTIFY pgrst, 'reload schema';
