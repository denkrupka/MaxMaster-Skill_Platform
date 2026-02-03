-- Add extra fields to project_costs: issuer_nip, issuer_address, vat_rate, value_brutto
ALTER TABLE project_costs ADD COLUMN IF NOT EXISTS issuer_nip TEXT;
ALTER TABLE project_costs ADD COLUMN IF NOT EXISTS issuer_address TEXT;
ALTER TABLE project_costs ADD COLUMN IF NOT EXISTS vat_rate NUMERIC(5,2);
ALTER TABLE project_costs ADD COLUMN IF NOT EXISTS value_brutto NUMERIC(14,2);
