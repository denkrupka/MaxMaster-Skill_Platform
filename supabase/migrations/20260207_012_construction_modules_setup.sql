-- =====================================================
-- Migration: Construction Modules Setup
-- Date: 2026-02-07
-- Description: Register construction modules and set up roles
-- =====================================================

-- 1. Add construction modules to modules table
INSERT INTO modules (code, name_pl, name_en, description_pl, description_en, available_roles, base_price_per_user, is_active, display_order, icon) VALUES
  ('estimates', 'Kosztorysowanie', 'Estimates',
   'Kosztorysowanie projektów z hierarchiczną strukturą etapów, pozycji i zasobów',
   'Project cost estimation with hierarchical stages, items and resources',
   ARRAY['company_admin', 'hr', 'coordinator'], 99.00, TRUE, 10, 'Calculator'),
  ('offers', 'Ofertowanie', 'Offers',
   'Tworzenie i zarządzanie ofertami handlowymi z szablonami i śledzeniem',
   'Creating and managing commercial offers with templates and tracking',
   ARRAY['company_admin', 'hr', 'coordinator'], 49.00, TRUE, 11, 'FileSpreadsheet'),
  ('drawings', 'Rysunki Techniczne', 'Technical Drawings',
   'Zarządzanie rysunkami technicznymi z adnotacjami i znacznikami',
   'Technical drawings management with annotations and markers',
   ARRAY['company_admin', 'hr', 'coordinator', 'brigadir'], 79.00, TRUE, 12, 'PenTool'),
  ('dms', 'Dokumenty (DMS)', 'Documents (DMS)',
   'System zarządzania dokumentami z wersjonowaniem i uprawnieniami',
   'Document management system with versioning and permissions',
   ARRAY['company_admin', 'hr', 'coordinator', 'brigadir', 'employee'], 59.00, TRUE, 13, 'FolderOpen'),
  ('gantt', 'Harmonogram', 'Schedule',
   'Harmonogramowanie projektów z wykresem Gantta i zależnościami',
   'Project scheduling with Gantt chart and dependencies',
   ARRAY['company_admin', 'hr', 'coordinator'], 69.00, TRUE, 14, 'GanttChartSquare'),
  ('finance', 'Finanse', 'Finance',
   'Operacje finansowe, rozliczenia i akty wykonawcze',
   'Financial operations, settlements and completion acts',
   ARRAY['company_admin', 'hr'], 89.00, TRUE, 15, 'Wallet'),
  ('procurement', 'Zaopatrzenie', 'Procurement',
   'Zarządzanie zamówieniami, dostawami i magazynem',
   'Order management, deliveries and warehouse',
   ARRAY['company_admin', 'hr', 'coordinator'], 79.00, TRUE, 16, 'ShoppingCart'),
  ('approvals', 'Uzgodnienia', 'Approvals',
   'Workflow zatwierdzania dokumentów i zmian',
   'Document and change approval workflow',
   ARRAY['company_admin', 'hr', 'coordinator'], 39.00, TRUE, 17, 'ClipboardCheck'),
  ('contractors', 'Kontrahenci', 'Contractors',
   'Zarządzanie kontrahentami, dostawcami i podwykonawcami',
   'Contractor, supplier and subcontractor management',
   ARRAY['company_admin', 'hr', 'coordinator'], 0.00, TRUE, 18, 'Building2')
ON CONFLICT (code) DO UPDATE SET
  name_pl = EXCLUDED.name_pl,
  name_en = EXCLUDED.name_en,
  description_pl = EXCLUDED.description_pl,
  description_en = EXCLUDED.description_en,
  available_roles = EXCLUDED.available_roles,
  base_price_per_user = EXCLUDED.base_price_per_user,
  display_order = EXCLUDED.display_order,
  icon = EXCLUDED.icon;

-- 2. Add construction roles
DO $$
BEGIN
  -- Add new role values if they don't exist
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'project_manager' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')) THEN
    ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'project_manager';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'estimator' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')) THEN
    ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'estimator';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'foreman' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')) THEN
    ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'foreman';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'subcontractor' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')) THEN
    ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'subcontractor';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'observer' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')) THEN
    ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'observer';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'accountant' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')) THEN
    ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'accountant';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Ignore errors if type doesn't exist or values already exist
  NULL;
END $$;

-- 3. Create project_members_extended for role-based access
CREATE TABLE IF NOT EXISTS project_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  permissions JSONB DEFAULT '{}'::jsonb,
  -- permissions: {estimates: {view: true, edit: true}, finance: {view: true, edit: false}, ...}
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, user_id)
);

ALTER TABLE project_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_roles_access" ON project_roles
  FOR ALL USING (project_id IN (
    SELECT p.id FROM projects p
    JOIN users u ON u.company_id = p.company_id
    WHERE u.id = auth.uid()
  ));

CREATE INDEX IF NOT EXISTS idx_project_roles_project ON project_roles(project_id);
CREATE INDEX IF NOT EXISTS idx_project_roles_user ON project_roles(user_id);

-- 4. Add construction-specific fields to projects
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'project_type'
  ) THEN
    ALTER TABLE projects ADD COLUMN project_type TEXT DEFAULT 'construction';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'contract_number'
  ) THEN
    ALTER TABLE projects ADD COLUMN contract_number TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'contract_date'
  ) THEN
    ALTER TABLE projects ADD COLUMN contract_date DATE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'warranty_months'
  ) THEN
    ALTER TABLE projects ADD COLUMN warranty_months INTEGER DEFAULT 24;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'default_currency_id'
  ) THEN
    ALTER TABLE projects ADD COLUMN default_currency_id INTEGER REFERENCES currencies(id) DEFAULT 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'default_nds_percent'
  ) THEN
    ALTER TABLE projects ADD COLUMN default_nds_percent NUMERIC(5,2) DEFAULT 23.00;
  END IF;
END $$;

-- 5. Create notification types for construction modules
INSERT INTO notification_types (code, name, description, channels, is_active) VALUES
  ('estimate_created', 'Kosztorys utworzony', 'Powiadomienie o utworzeniu kosztorysu', '["email", "push"]'::jsonb, TRUE),
  ('estimate_updated', 'Kosztorys zaktualizowany', 'Powiadomienie o zmianach w kosztorysie', '["push"]'::jsonb, TRUE),
  ('offer_sent', 'Oferta wysłana', 'Powiadomienie o wysłaniu oferty', '["email", "push"]'::jsonb, TRUE),
  ('offer_viewed', 'Oferta wyświetlona', 'Klient wyświetlił ofertę', '["push"]'::jsonb, TRUE),
  ('offer_accepted', 'Oferta zaakceptowana', 'Klient zaakceptował ofertę', '["email", "push"]'::jsonb, TRUE),
  ('offer_rejected', 'Oferta odrzucona', 'Klient odrzucił ofertę', '["email", "push"]'::jsonb, TRUE),
  ('ticket_assigned', 'Zadanie przypisane', 'Przypisano zadanie do użytkownika', '["email", "push"]'::jsonb, TRUE),
  ('ticket_status_changed', 'Status zadania zmieniony', 'Zmiana statusu zadania', '["push"]'::jsonb, TRUE),
  ('ticket_comment', 'Nowy komentarz', 'Dodano komentarz do zadania', '["push"]'::jsonb, TRUE),
  ('approval_requested', 'Prośba o zatwierdzenie', 'Nowa prośba o zatwierdzenie', '["email", "push"]'::jsonb, TRUE),
  ('approval_approved', 'Zatwierdzone', 'Dokument został zatwierdzony', '["email", "push"]'::jsonb, TRUE),
  ('approval_rejected', 'Odrzucone', 'Dokument został odrzucony', '["email", "push"]'::jsonb, TRUE),
  ('act_created', 'Akt utworzony', 'Utworzono nowy akt wykonawczy', '["email", "push"]'::jsonb, TRUE),
  ('order_delivered', 'Zamówienie dostarczone', 'Zamówienie zostało dostarczone', '["email", "push"]'::jsonb, TRUE),
  ('resource_over_budget', 'Przekroczenie budżetu', 'Cena zasobu przekracza planowany budżet', '["email", "push"]'::jsonb, TRUE)
ON CONFLICT (code) DO NOTHING;

-- 6. Create audit_log table for all modules
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,
  old_data JSONB,
  new_data JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_company_access" ON audit_log
  FOR SELECT USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_audit_log_company ON audit_log(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);

-- 7. Create function for audit logging
CREATE OR REPLACE FUNCTION log_audit_event(
  p_company_id UUID,
  p_user_id UUID,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_action TEXT,
  p_old_data JSONB DEFAULT NULL,
  p_new_data JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO audit_log (company_id, user_id, entity_type, entity_id, action, old_data, new_data)
  VALUES (p_company_id, p_user_id, p_entity_type, p_entity_id, p_action, p_old_data, p_new_data)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- 8. Create company settings for construction modules
CREATE TABLE IF NOT EXISTS company_construction_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE UNIQUE,
  default_currency_id INTEGER REFERENCES currencies(id) DEFAULT 1,
  default_nds_percent NUMERIC(5,2) DEFAULT 23.00,
  estimate_auto_numbering BOOLEAN DEFAULT TRUE,
  estimate_number_prefix TEXT DEFAULT 'EST-',
  offer_auto_numbering BOOLEAN DEFAULT TRUE,
  offer_number_prefix TEXT DEFAULT 'OFR-',
  offer_valid_days INTEGER DEFAULT 30,
  act_auto_numbering BOOLEAN DEFAULT TRUE,
  act_number_prefix TEXT DEFAULT 'ACT-',
  order_auto_numbering BOOLEAN DEFAULT TRUE,
  order_number_prefix TEXT DEFAULT 'ORD-',
  working_days_mask INTEGER DEFAULT 62, -- Mon-Fri
  default_holidays_country TEXT DEFAULT 'PL',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE company_construction_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_construction_settings_access" ON company_construction_settings
  FOR ALL USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE TRIGGER update_company_construction_settings_updated_at BEFORE UPDATE ON company_construction_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 9. Create default construction settings for existing companies
INSERT INTO company_construction_settings (company_id)
SELECT id FROM companies
WHERE id NOT IN (SELECT company_id FROM company_construction_settings)
ON CONFLICT DO NOTHING;
