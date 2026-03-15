-- Documents Module - Stage 2 Migration
-- Run this in Supabase SQL Editor

-- =====================================================
-- 1. Document Reminders Table
-- =====================================================
CREATE TABLE IF NOT EXISTS document_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES employees(id),
  reminder_date TIMESTAMPTZ NOT NULL,
  reminder_type TEXT NOT NULL DEFAULT 'email' CHECK (reminder_type IN ('email', 'notification', 'both')),
  message TEXT,
  is_sent BOOLEAN NOT NULL DEFAULT false,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_reminders_document ON document_reminders(document_id);
CREATE INDEX IF NOT EXISTS idx_document_reminders_company ON document_reminders(company_id);
CREATE INDEX IF NOT EXISTS idx_document_reminders_date ON document_reminders(reminder_date) WHERE is_sent = false;

-- RLS
ALTER TABLE document_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "document_reminders_select" ON document_reminders
  FOR SELECT USING (company_id IN (
    SELECT company_id FROM employees WHERE user_id = auth.uid()
  ));

CREATE POLICY "document_reminders_insert" ON document_reminders
  FOR INSERT WITH CHECK (company_id IN (
    SELECT company_id FROM employees WHERE user_id = auth.uid()
  ));

CREATE POLICY "document_reminders_delete" ON document_reminders
  FOR DELETE USING (company_id IN (
    SELECT company_id FROM employees WHERE user_id = auth.uid()
  ));

-- =====================================================
-- 2. Document Verification Codes Table (for QR)
-- =====================================================
CREATE TABLE IF NOT EXISTS document_verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  verification_code TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(document_id, verification_code)
);

CREATE INDEX IF NOT EXISTS idx_doc_verification_codes_document ON document_verification_codes(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_verification_codes_code ON document_verification_codes(verification_code);

-- RLS
ALTER TABLE document_verification_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "document_verification_codes_select" ON document_verification_codes
  FOR SELECT USING (company_id IN (
    SELECT company_id FROM employees WHERE user_id = auth.uid()
  ));

CREATE POLICY "document_verification_codes_insert" ON document_verification_codes
  FOR INSERT WITH CHECK (company_id IN (
    SELECT company_id FROM employees WHERE user_id = auth.uid()
  ));

-- =====================================================
-- 3. Add linked_invoice_id to documents
-- =====================================================
ALTER TABLE documents 
  ADD COLUMN IF NOT EXISTS linked_invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_documents_linked_invoice ON documents(linked_invoice_id);

-- =====================================================
-- 4. Document Comments Table (if not exists)
-- =====================================================
CREATE TABLE IF NOT EXISTS document_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES employees(id),
  author_name TEXT NOT NULL,
  content TEXT NOT NULL,
  field_key TEXT,
  parent_id UUID REFERENCES document_comments(id) ON DELETE CASCADE,
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_by UUID REFERENCES employees(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_comments_document ON document_comments(document_id);
CREATE INDEX IF NOT EXISTS idx_document_comments_parent ON document_comments(parent_id);

-- RLS
ALTER TABLE document_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "document_comments_select" ON document_comments
  FOR SELECT USING (company_id IN (
    SELECT company_id FROM employees WHERE user_id = auth.uid()
  ));

CREATE POLICY "document_comments_insert" ON document_comments
  FOR INSERT WITH CHECK (company_id IN (
    SELECT company_id FROM employees WHERE user_id = auth.uid()
  ));

CREATE POLICY "document_comments_update" ON document_comments
  FOR UPDATE USING (company_id IN (
    SELECT company_id FROM employees WHERE user_id = auth.uid()
  ));

-- =====================================================
-- 5. Document AI Analyses Table (if not exists)
-- =====================================================
CREATE TABLE IF NOT EXISTS document_ai_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  analysis_type TEXT NOT NULL,
  result JSONB NOT NULL,
  created_by UUID NOT NULL REFERENCES employees(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_ai_analyses_document ON document_ai_analyses(document_id);

-- RLS
ALTER TABLE document_ai_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "document_ai_analyses_select" ON document_ai_analyses
  FOR SELECT USING (company_id IN (
    SELECT company_id FROM employees WHERE user_id = auth.uid()
  ));

CREATE POLICY "document_ai_analyses_insert" ON document_ai_analyses
  FOR INSERT WITH CHECK (company_id IN (
    SELECT company_id FROM employees WHERE user_id = auth.uid()
  ));

-- =====================================================
-- 6. Document Automations Table (if not exists)
-- =====================================================
CREATE TABLE IF NOT EXISTS document_automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES employees(id),
  name TEXT NOT NULL,
  trigger_event TEXT NOT NULL,
  trigger_config JSONB DEFAULT '{}',
  action_type TEXT NOT NULL,
  action_config JSONB DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_automations_company ON document_automations(company_id);
CREATE INDEX IF NOT EXISTS idx_document_automations_active ON document_automations(company_id, is_active) WHERE is_active = true;

-- RLS
ALTER TABLE document_automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "document_automations_select" ON document_automations
  FOR SELECT USING (company_id IN (
    SELECT company_id FROM employees WHERE user_id = auth.uid()
  ));

CREATE POLICY "document_automations_insert" ON document_automations
  FOR INSERT WITH CHECK (company_id IN (
    SELECT company_id FROM employees WHERE user_id = auth.uid()
  ));

CREATE POLICY "document_automations_update" ON document_automations
  FOR UPDATE USING (company_id IN (
    SELECT company_id FROM employees WHERE user_id = auth.uid()
  ));

CREATE POLICY "document_automations_delete" ON document_automations
  FOR DELETE USING (company_id IN (
    SELECT company_id FROM employees WHERE user_id = auth.uid()
  ));

-- =====================================================
-- 7. Update existing tables from Stage 2 schema
-- =====================================================

-- Add columns to documents table
ALTER TABLE documents 
  ADD COLUMN IF NOT EXISTS current_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'none' CHECK (approval_status IN ('none', 'pending', 'in_review', 'approved', 'rejected'));

-- Add columns to digital_signatures
ALTER TABLE digital_signatures
  ADD COLUMN IF NOT EXISTS request_id UUID REFERENCES signature_requests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sign_method TEXT DEFAULT 'manual' CHECK (sign_method IN ('manual', 'email_link')),
  ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- =====================================================
-- 8. Create log_document_event function
-- =====================================================
CREATE OR REPLACE FUNCTION log_document_event(
  p_document_id UUID,
  p_action TEXT,
  p_actor_type TEXT DEFAULT 'user',
  p_actor_id UUID DEFAULT NULL,
  p_actor_name TEXT DEFAULT NULL,
  p_actor_email TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}',
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
    FROM documents WHERE id = p_document_id;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'document not found: %', p_document_id;
  END IF;

  INSERT INTO document_audit_log (
    company_id, document_id, action, actor_type,
    actor_id, actor_name, actor_email, metadata,
    ip_address, user_agent
  ) VALUES (
    v_company_id, p_document_id, p_action, p_actor_type,
    p_actor_id, p_actor_name, p_actor_email, p_metadata,
    p_ip_address, p_user_agent
  ) RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

-- =====================================================
-- 9. Prevent audit log modification
-- =====================================================
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only: % not allowed', TG_OP;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS audit_no_update ON document_audit_log;
DROP TRIGGER IF EXISTS audit_no_delete ON document_audit_log;

CREATE TRIGGER audit_no_update
  BEFORE UPDATE ON document_audit_log
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();

CREATE TRIGGER audit_no_delete
  BEFORE DELETE ON document_audit_log
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();

-- Success message
SELECT 'Documents Module Stage 2 migration completed successfully!' as result;
