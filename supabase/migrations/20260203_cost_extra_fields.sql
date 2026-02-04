-- Add extra fields to project_costs: issuer_nip, address fields, vat_rate, value_brutto
ALTER TABLE project_costs ADD COLUMN IF NOT EXISTS issuer_nip TEXT;
ALTER TABLE project_costs ADD COLUMN IF NOT EXISTS issuer_street TEXT;
ALTER TABLE project_costs ADD COLUMN IF NOT EXISTS issuer_building_number TEXT;
ALTER TABLE project_costs ADD COLUMN IF NOT EXISTS issuer_apartment_number TEXT;
ALTER TABLE project_costs ADD COLUMN IF NOT EXISTS issuer_city TEXT;
ALTER TABLE project_costs ADD COLUMN IF NOT EXISTS issuer_postal_code TEXT;
ALTER TABLE project_costs ADD COLUMN IF NOT EXISTS vat_rate NUMERIC(5,2);
ALTER TABLE project_costs ADD COLUMN IF NOT EXISTS value_brutto NUMERIC(14,2);
