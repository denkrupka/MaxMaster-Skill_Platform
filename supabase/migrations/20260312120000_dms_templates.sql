-- =============================================================
-- DMS: Document Templates & Instances + E-Signing + Track Changes
-- =============================================================

-- Шаблоны документов
CREATE TABLE IF NOT EXISTS document_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text DEFAULT 'general',
  description text,
  content text NOT NULL, -- HTML с переменными {{variable}}
  variables jsonb DEFAULT '[]', -- [{name, label, type, required}]
  is_builtin boolean DEFAULT false, -- системные шаблоны
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Экземпляры документов из шаблонов
CREATE TABLE IF NOT EXISTS document_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  template_id uuid REFERENCES document_templates(id),
  name text NOT NULL,
  content text NOT NULL, -- заполненный HTML
  status text DEFAULT 'draft' CHECK (status IN ('draft','sent','signed','rejected','expired')),
  sign_token text UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  variables_values jsonb DEFAULT '{}',
  project_id uuid,
  contractor_id uuid,
  signer_name text,
  signer_email text,
  signer_phone text,
  created_by uuid REFERENCES auth.users(id),
  signed_at timestamptz,
  signature_data text, -- base64 подписи
  signature_ip text,
  signed_pdf_path text,
  ai_analysis jsonb, -- результаты AI анализа
  tags text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Версии документов (track changes)
CREATE TABLE IF NOT EXISTS document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES document_instances(id) ON DELETE CASCADE,
  version_number int NOT NULL,
  content text NOT NULL,
  diff_data jsonb, -- данные о изменениях
  changed_by uuid REFERENCES auth.users(id),
  change_type text DEFAULT 'edit' CHECK (change_type IN ('edit','suggestion','accept','reject','sign')),
  change_notes text,
  created_at timestamptz DEFAULT now()
);

-- Предложения изменений от клиента
CREATE TABLE IF NOT EXISTS document_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES document_instances(id) ON DELETE CASCADE,
  suggest_token text, -- токен доступа клиента
  position_start int,
  position_end int,
  original_text text,
  suggested_text text,
  comment text,
  status text DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
  created_at timestamptz DEFAULT now()
);

-- SMS коды для верификации подписи
CREATE TABLE IF NOT EXISTS document_sign_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES document_instances(id) ON DELETE CASCADE,
  phone text NOT NULL,
  code text NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  used boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_sign_codes ENABLE ROW LEVEL SECURITY;

-- Policies: templates
CREATE POLICY "templates_company_access" ON document_templates
  FOR ALL USING (
    company_id = (SELECT company_id FROM users WHERE id = auth.uid())
    OR is_builtin = true
  );

-- Policies: instances
CREATE POLICY "instances_company_access" ON document_instances
  FOR ALL USING (
    company_id = (SELECT company_id FROM users WHERE id = auth.uid())
  );

-- Policies: versions
CREATE POLICY "versions_access" ON document_versions
  FOR ALL USING (
    document_id IN (
      SELECT id FROM document_instances
      WHERE company_id = (SELECT company_id FROM users WHERE id = auth.uid())
    )
  );

-- Policies: suggestions (клиент по токену через public RPC)
CREATE POLICY "suggestions_access" ON document_suggestions
  FOR ALL USING (true); -- публичный доступ через токен, контроль на уровне RPC

-- Policies: sign codes
CREATE POLICY "sign_codes_access" ON document_sign_codes
  FOR ALL USING (true);

-- Функции
CREATE OR REPLACE FUNCTION update_document_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER document_instances_updated_at
  BEFORE UPDATE ON document_instances
  FOR EACH ROW EXECUTE FUNCTION update_document_updated_at();

CREATE TRIGGER document_templates_updated_at
  BEFORE UPDATE ON document_templates
  FOR EACH ROW EXECUTE FUNCTION update_document_updated_at();

-- Индексы
CREATE INDEX IF NOT EXISTS idx_doc_instances_company ON document_instances(company_id);
CREATE INDEX IF NOT EXISTS idx_doc_instances_status ON document_instances(status);
CREATE INDEX IF NOT EXISTS idx_doc_instances_token ON document_instances(sign_token);
CREATE INDEX IF NOT EXISTS idx_doc_templates_company ON document_templates(company_id);
CREATE INDEX IF NOT EXISTS idx_doc_versions_document ON document_versions(document_id);

-- Встроенные шаблоны (будут вставлены при первом использовании через app)
