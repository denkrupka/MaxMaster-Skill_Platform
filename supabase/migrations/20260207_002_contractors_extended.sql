-- =====================================================
-- Migration: Extended Contractors Module
-- Date: 2026-02-07
-- Description: Unified contractors table with groups
-- =====================================================

-- 1. Contractor Groups
CREATE TABLE IF NOT EXISTS contractor_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Unified Contractors table
CREATE TYPE contractor_entity_type AS ENUM ('individual', 'legal_entity');
CREATE TYPE contractor_type AS ENUM ('customer', 'contractor', 'supplier');

CREATE TABLE IF NOT EXISTS contractors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  group_id UUID REFERENCES contractor_groups(id) ON DELETE SET NULL,
  contractor_entity_type contractor_entity_type NOT NULL DEFAULT 'legal_entity',
  contractor_type contractor_type NOT NULL DEFAULT 'contractor',
  name TEXT NOT NULL,
  short_name TEXT,
  contact_person TEXT,
  position TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  -- Identifiers (RU)
  inn TEXT,
  kpp TEXT,
  ogrn TEXT,
  -- Identifiers (PL)
  nip TEXT,
  regon TEXT,
  -- Addresses
  legal_address TEXT,
  actual_address TEXT,
  -- Bank details
  bank_name TEXT,
  bank_bik TEXT,
  bank_account TEXT,
  bank_corr_account TEXT,
  -- Meta
  notes TEXT,
  created_by_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- 3. Contractor Contacts (дополнительные контакты)
CREATE TABLE IF NOT EXISTS contractor_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT,
  position TEXT,
  phone TEXT,
  email TEXT,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Contractor Documents
CREATE TABLE IF NOT EXISTS contractor_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  uploaded_by_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Enable RLS
ALTER TABLE contractor_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE contractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE contractor_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contractor_documents ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies
CREATE POLICY "contractor_groups_company_access" ON contractor_groups
  FOR ALL USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY "contractors_company_access" ON contractors
  FOR ALL USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY "contractor_contacts_access" ON contractor_contacts
  FOR ALL USING (contractor_id IN (
    SELECT id FROM contractors WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  ));

CREATE POLICY "contractor_documents_access" ON contractor_documents
  FOR ALL USING (contractor_id IN (
    SELECT id FROM contractors WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  ));

-- 7. Indexes
CREATE INDEX IF NOT EXISTS idx_contractor_groups_company ON contractor_groups(company_id);
CREATE INDEX IF NOT EXISTS idx_contractors_company ON contractors(company_id);
CREATE INDEX IF NOT EXISTS idx_contractors_group ON contractors(group_id);
CREATE INDEX IF NOT EXISTS idx_contractors_type ON contractors(contractor_type);
CREATE INDEX IF NOT EXISTS idx_contractors_deleted ON contractors(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contractor_contacts_contractor ON contractor_contacts(contractor_id);
CREATE INDEX IF NOT EXISTS idx_contractor_documents_contractor ON contractor_documents(contractor_id);

-- 8. Triggers
CREATE TRIGGER update_contractor_groups_updated_at BEFORE UPDATE ON contractor_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contractors_updated_at BEFORE UPDATE ON contractors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 9. Add contractor_id to estimate_resources if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimate_resources' AND column_name = 'contractor_id'
  ) THEN
    ALTER TABLE estimate_resources ADD COLUMN contractor_id UUID REFERENCES contractors(id) ON DELETE SET NULL;
  END IF;
END $$;
