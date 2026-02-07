-- =====================================================
-- Extended fields for kosztorys_requests
-- NIP, address breakdown, object_code, internal_notes
-- Multiple representatives support
-- =====================================================

-- Add new columns to kosztorys_requests
ALTER TABLE kosztorys_requests
ADD COLUMN IF NOT EXISTS nip VARCHAR(20),
ADD COLUMN IF NOT EXISTS company_street VARCHAR(255),
ADD COLUMN IF NOT EXISTS company_street_number VARCHAR(20),
ADD COLUMN IF NOT EXISTS company_city VARCHAR(100),
ADD COLUMN IF NOT EXISTS company_postal_code VARCHAR(20),
ADD COLUMN IF NOT EXISTS company_country VARCHAR(100) DEFAULT 'Polska',
ADD COLUMN IF NOT EXISTS internal_notes TEXT,
ADD COLUMN IF NOT EXISTS object_code VARCHAR(50),
ADD COLUMN IF NOT EXISTS object_street VARCHAR(255),
ADD COLUMN IF NOT EXISTS object_street_number VARCHAR(20),
ADD COLUMN IF NOT EXISTS object_city VARCHAR(100),
ADD COLUMN IF NOT EXISTS object_postal_code VARCHAR(20),
ADD COLUMN IF NOT EXISTS object_country VARCHAR(100) DEFAULT 'Polska';

-- Create index on NIP for faster lookups
CREATE INDEX IF NOT EXISTS idx_kosztorys_requests_nip ON kosztorys_requests(nip);

-- Create index on object_code
CREATE INDEX IF NOT EXISTS idx_kosztorys_requests_object_code ON kosztorys_requests(object_code);

-- =====================================================
-- Table for multiple company representatives (contacts)
-- =====================================================
CREATE TABLE IF NOT EXISTS kosztorys_request_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES kosztorys_requests(id) ON DELETE CASCADE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(255),
    position VARCHAR(100),
    is_primary BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for faster lookups by request_id
CREATE INDEX IF NOT EXISTS idx_kosztorys_request_contacts_request_id
ON kosztorys_request_contacts(request_id);

-- Ensure only one primary contact per request
CREATE UNIQUE INDEX IF NOT EXISTS idx_kosztorys_request_contacts_primary
ON kosztorys_request_contacts(request_id)
WHERE is_primary = true;

-- Enable RLS
ALTER TABLE kosztorys_request_contacts ENABLE ROW LEVEL SECURITY;

-- RLS Policy for contacts
DROP POLICY IF EXISTS "kosztorys_request_contacts_all" ON kosztorys_request_contacts;
CREATE POLICY "kosztorys_request_contacts_all" ON kosztorys_request_contacts FOR ALL
    USING (request_id IN (
        SELECT id FROM kosztorys_requests
        WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
    ));

-- =====================================================
-- Table for object types (rodzaj) - user-manageable
-- =====================================================
CREATE TABLE IF NOT EXISTS kosztorys_object_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(company_id, code)
);

-- Enable RLS
ALTER TABLE kosztorys_object_types ENABLE ROW LEVEL SECURITY;

-- RLS Policy
DROP POLICY IF EXISTS "kosztorys_object_types_all" ON kosztorys_object_types;
CREATE POLICY "kosztorys_object_types_all" ON kosztorys_object_types FOR ALL
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

-- Insert default object types
INSERT INTO kosztorys_object_types (company_id, code, name, sort_order)
SELECT c.id, 'industrial', 'Przemysłowe', 1
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM kosztorys_object_types kot
    WHERE kot.company_id = c.id AND kot.code = 'industrial'
);

INSERT INTO kosztorys_object_types (company_id, code, name, sort_order)
SELECT c.id, 'residential', 'Mieszkaniowe', 2
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM kosztorys_object_types kot
    WHERE kot.company_id = c.id AND kot.code = 'residential'
);

INSERT INTO kosztorys_object_types (company_id, code, name, sort_order)
SELECT c.id, 'office', 'Biurowe', 3
FROM companies c
WHERE NOT EXISTS (
    SELECT 1 FROM kosztorys_object_types kot
    WHERE kot.company_id = c.id AND kot.code = 'office'
);

-- =====================================================
-- Table for object categories (typ) - user-manageable
-- =====================================================
CREATE TABLE IF NOT EXISTS kosztorys_object_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    object_type_id UUID REFERENCES kosztorys_object_types(id) ON DELETE SET NULL,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(company_id, code)
);

-- Enable RLS
ALTER TABLE kosztorys_object_categories ENABLE ROW LEVEL SECURITY;

-- RLS Policy
DROP POLICY IF EXISTS "kosztorys_object_categories_all" ON kosztorys_object_categories;
CREATE POLICY "kosztorys_object_categories_all" ON kosztorys_object_categories FOR ALL
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

-- Add object_type_id and object_category_id to requests
ALTER TABLE kosztorys_requests
ADD COLUMN IF NOT EXISTS object_type_id UUID REFERENCES kosztorys_object_types(id),
ADD COLUMN IF NOT EXISTS object_category_id UUID REFERENCES kosztorys_object_categories(id);

-- Migrate existing contact_person data to contacts table
-- Only run if contact_person has data and no contacts exist yet
INSERT INTO kosztorys_request_contacts (request_id, first_name, last_name, phone, email, is_primary)
SELECT
    r.id,
    SPLIT_PART(r.contact_person, ' ', 1) as first_name,
    COALESCE(NULLIF(SUBSTRING(r.contact_person FROM POSITION(' ' IN r.contact_person) + 1), ''), '-') as last_name,
    r.phone,
    r.email,
    true
FROM kosztorys_requests r
WHERE r.contact_person IS NOT NULL
AND r.contact_person != ''
AND NOT EXISTS (
    SELECT 1 FROM kosztorys_request_contacts c WHERE c.request_id = r.id
);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_kosztorys_request_contacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_kosztorys_request_contacts_updated_at ON kosztorys_request_contacts;
CREATE TRIGGER trigger_kosztorys_request_contacts_updated_at
    BEFORE UPDATE ON kosztorys_request_contacts
    FOR EACH ROW
    EXECUTE FUNCTION update_kosztorys_request_contacts_updated_at();
