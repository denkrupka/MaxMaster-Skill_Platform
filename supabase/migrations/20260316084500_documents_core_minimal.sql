-- Documents core minimal foundation for preview/dev
-- Safe IF NOT EXISTS bootstrap because repo currently lacks the base Documents migration.

DO $$ BEGIN
  CREATE TYPE document_template_type AS ENUM ('contract', 'protocol', 'annex', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE document_status AS ENUM ('draft', 'sent', 'signed', 'completed', 'archived', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

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

CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES document_templates(id) ON DELETE RESTRICT,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  contractor_id UUID REFERENCES contractors_clients(id) ON DELETE SET NULL,
  number TEXT,
  name TEXT NOT NULL,
  status document_status NOT NULL DEFAULT 'draft',
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  pdf_path TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_version INTEGER NOT NULL DEFAULT 1,
  approval_status TEXT DEFAULT 'none'
);

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

CREATE TABLE IF NOT EXISTS signature_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  signer_name TEXT NOT NULL,
  signer_email TEXT NOT NULL,
  signer_role TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'opened', 'signed', 'declined', 'expired', 'cancelled')),
  signing_token UUID NOT NULL DEFAULT gen_random_uuid(),
  pin_hash TEXT,
  expires_at TIMESTAMPTZ,
  last_opened_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,
  decline_reason TEXT,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(signing_token)
);

CREATE INDEX IF NOT EXISTS idx_document_templates_company_id ON document_templates(company_id);
CREATE INDEX IF NOT EXISTS idx_documents_company_id ON documents(company_id);
CREATE INDEX IF NOT EXISTS idx_documents_template_id ON documents(template_id);
CREATE INDEX IF NOT EXISTS idx_documents_project_id ON documents(project_id);
CREATE INDEX IF NOT EXISTS idx_documents_contractor_id ON documents(contractor_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_number ON documents(number);
CREATE INDEX IF NOT EXISTS idx_document_audit_log_document_id ON document_audit_log(document_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_document_versions_document_id ON document_versions(document_id, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_document_public_links_document_id ON document_public_links(document_id);
CREATE INDEX IF NOT EXISTS idx_signature_requests_document_id ON signature_requests(document_id);
CREATE INDEX IF NOT EXISTS idx_signature_requests_signing_token ON signature_requests(signing_token);
CREATE INDEX IF NOT EXISTS idx_signature_requests_status ON signature_requests(status);

ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_numbering ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_public_links ENABLE ROW LEVEL SECURITY;
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

DROP POLICY IF EXISTS "signature_requests_company_access" ON signature_requests;
CREATE POLICY "signature_requests_company_access" ON signature_requests
  FOR ALL USING (company_id IN (SELECT company_id FROM employees WHERE user_id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM employees WHERE user_id = auth.uid()));

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
