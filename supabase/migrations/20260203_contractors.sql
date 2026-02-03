-- ============================================================
-- Contractors: Clients & Subcontractors
-- ============================================================

-- 1. Clients table
CREATE TABLE IF NOT EXISTS contractors_clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  nip TEXT,
  address_street TEXT,
  address_city TEXT,
  address_postal_code TEXT,
  address_country TEXT DEFAULT 'PL',
  email TEXT,
  phone TEXT,
  note TEXT,
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE contractors_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contractors_clients_company_access" ON contractors_clients
  FOR ALL USING (company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  ));

-- 2. Client contacts table
CREATE TABLE IF NOT EXISTS contractor_client_contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES contractors_clients(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  position TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE contractor_client_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contractor_client_contacts_company_access" ON contractor_client_contacts
  FOR ALL USING (company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  ));

-- 3. Subcontractors table
CREATE TABLE IF NOT EXISTS contractors_subcontractors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  workers_count INTEGER DEFAULT 0,
  email TEXT,
  phone TEXT,
  skills TEXT,
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE contractors_subcontractors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contractors_subcontractors_company_access" ON contractors_subcontractors
  FOR ALL USING (company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  ));

-- 4. Subcontractor workers table
CREATE TABLE IF NOT EXISTS subcontractor_workers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  subcontractor_id UUID NOT NULL REFERENCES contractors_subcontractors(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  position TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE subcontractor_workers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subcontractor_workers_company_access" ON subcontractor_workers
  FOR ALL USING (company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  ));
